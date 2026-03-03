// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx  
// Versión: V6
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V6:
// - Dropdown con inspecciones separadas por año (headers de año)
// - Formato corto "2 mar 26" en lugar de "2025 marzo 2"
// - Notas filtradas SOLO para la fecha de inspección seleccionada
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { todayFolderName } from "../../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

// ─── Helper: parsear fecha de carpeta a objeto Date ───
const parseFolderDate = (folderName, year) => {
  // folderName ejemplo: "2 mar 26"
  const parts = folderName.split(" ");
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const monthMap = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
  };
  const monthShort = parts[1].toLowerCase();
  const monthIndex = monthMap[monthShort];
  
  if (monthIndex === undefined) return null;
  
  return new Date(parseInt(year), monthIndex, day);
};

const InspectionPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [allInspections, setAllInspections] = useState([]); // Array de todas las inspecciones
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // Fecha para filtrar notas
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const uploadRef = useRef(null);

  // ─── Cargar TODAS las inspecciones de TODOS los años ───
  useEffect(() => {
    const loadAllInspections = async () => {
      setLoading(true);
      try {
        if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
          setAllInspections([]);
          setLoading(false);
          return;
        }

        // 1. Buscar carpeta de la propiedad
        const propFolder = await drive.searchFolderByAddress(
          property.address,
          property.owner,
          DRIVE_ROOT_FOLDER
        );

        if (!propFolder) {
          setStatus("No se encontró la carpeta de la propiedad");
          setAllInspections([]);
          setLoading(false);
          return;
        }

        // 2. Buscar carpeta INSPECCIONES
        const inspecFolder = await drive.findSubfolder(propFolder.id, "INSPEC");

        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCIONES para esta propiedad");
          setAllInspections([]);
          setLoading(false);
          return;
        }

        // 3. Listar TODOS los años
        const allFiles = await drive.listAllFiles(inspecFolder.id);
        
        const years = (allFiles || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
          .sort((a, b) => b.name.localeCompare(a.name));

        // 4. Para cada año, cargar todas las fechas
        const inspectionsByYear = [];
        
        for (const year of years) {
          try {
            const dateFiles = await drive.listAllFiles(year.id);
            const dates = (dateFiles || [])
              .filter(f => f.mimeType === "application/vnd.google-apps.folder");
            
            if (dates.length === 0) continue;

            // Parsear y ordenar fechas dentro del año
            const parsedDates = dates.map(date => ({
              id: date.id,
              folderName: date.name, // "2 mar 26"
              year: year.name,
              yearId: year.id,
              sortDate: parseFolderDate(date.name, year.name) || new Date(0),
            }))
            .sort((a, b) => b.sortDate - a.sortDate); // Más reciente primero

            inspectionsByYear.push({
              year: year.name,
              inspections: parsedDates,
            });
          } catch (err) {
            console.error(`[InspectionPanel] Error loading dates for year ${year.name}:`, err);
          }
        }

        setAllInspections(inspectionsByYear);

        // 5. Auto-seleccionar la inspección más reciente
        if (inspectionsByYear.length > 0 && inspectionsByYear[0].inspections.length > 0) {
          const firstInspection = inspectionsByYear[0].inspections[0];
          setSelectedInspection(firstInspection.id);
          setSelectedDate(firstInspection.sortDate);
        }
      } catch (err) {
        console.error("[InspectionPanel] Error loading inspections:", err);
        setStatus("Error al cargar inspecciones: " + err.message);
      }
      setLoading(false);
    };

    loadAllInspections();
  }, [property.address, property.owner, drive?.token, drive?.listAllFiles, drive?.searchFolderByAddress, drive?.findSubfolder]);

  // ─── Cargar fotos cuando se selecciona una inspección ───
  useEffect(() => {
    if (!selectedInspection || !drive?.listAllFiles) return;

    const loadPhotos = async () => {
      try {
        const files = await drive.listAllFiles(selectedInspection);
        const images = (files || [])
          .filter(f => f.mimeType && f.mimeType.startsWith('image/'))
          .map(f => ({
            id: f.id,
            title: f.name,
            google_drive_file_id: f.id,
            mime_type: f.mimeType,
            file_type: (f.name || "").split(".").pop().toLowerCase(),
          }));
        setPhotos(images);
      } catch (err) {
        console.error("[InspectionPanel] Error loading photos:", err);
        setPhotos([]);
      }
    };

    loadPhotos();
  }, [selectedInspection, drive?.listAllFiles]);

  // ─── Cargar notas FILTRADAS por fecha de inspección seleccionada ───
  useEffect(() => {
    const loadNotes = async () => {
      if (!selectedDate) {
        setNotes([]);
        return;
      }

      try {
        // Convertir la fecha a formato YYYY-MM-DD
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        // Buscar notas SOLO para esa fecha específica
        const notesData = await supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}&note_date=eq.${dateStr}`,
          order: "created_at.desc",
        });
        setNotes(notesData || []);
      } catch (err) {
        console.error("[InspectionPanel] Error loading notes:", err);
        setNotes([]);
      }
    };

    loadNotes();
  }, [property.address, selectedDate]);

  // ─── Upload fotos ───
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !drive?.uploadPhotos || !drive?.searchFolderByAddress) return;

    setUploading(true);
    setStatus(`Subiendo ${files.length} fotos...`);

    try {
      const propFolder = await drive.searchFolderByAddress(
        property.address,
        property.owner,
        DRIVE_ROOT_FOLDER
      );

      if (!propFolder) {
        setStatus("No se encontró carpeta de la propiedad");
        setUploading(false);
        return;
      }

      const result = await drive.uploadPhotos(
        files,
        propFolder.id,
        property.address,
        (cur, total, name) => setStatus(`Subiendo ${cur}/${total}...`)
      );

      setStatus(`✓ ${result.results.length} fotos subidas`);

      // Refresh fotos si estamos viendo una fecha
      if (selectedInspection && drive.listAllFiles) {
        const refreshed = await drive.listAllFiles(selectedInspection);
        const images = (refreshed || [])
          .filter(f => f.mimeType && f.mimeType.startsWith('image/'))
          .map(f => ({
            id: f.id,
            title: f.name,
            google_drive_file_id: f.id,
            mime_type: f.mimeType,
            file_type: (f.name || "").split(".").pop().toLowerCase(),
          }));
        setPhotos(images);
      }

      setTimeout(() => setStatus(""), 4000);
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
    setUploading(false);
  };

  // ─── Agregar nota (para la fecha seleccionada) ───
  const handleAddNote = useCallback(() => {
    if (!selectedDate) {
      alert("Selecciona una fecha de inspección primero");
      return;
    }

    const note = prompt("Nota de inspección:");
    if (!note?.trim()) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    supaInsert("inspection_notes", {
      property_address: property.address,
      note_date: dateStr,
      note_text: note.trim(),
      created_by: "MEW",
    })
      .then(() => {
        // Recargar solo las notas de esta fecha
        supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}&note_date=eq.${dateStr}`,
          order: "created_at.desc",
        }).then(rows => setNotes(rows || []));
        setStatus("✓ Nota guardada");
        setTimeout(() => setStatus(""), 3000);
      })
      .catch(err => {
        console.error(err);
        setStatus("Error al guardar nota");
      });
  }, [property.address, selectedDate]);

  // ─── Manejar cambio de inspección seleccionada ───
  const handleInspectionChange = (inspectionId) => {
    setSelectedInspection(inspectionId);
    
    // Encontrar la fecha correspondiente
    for (const yearGroup of allInspections) {
      const found = yearGroup.inspections.find(insp => insp.id === inspectionId);
      if (found) {
        setSelectedDate(found.sortDate);
        break;
      }
    }
  };

  if (loading && allInspections.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spinner />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
            {status || "Cargando inspecciones..."}
          </p>
        </div>
      </Card>
    );
  }

  if (allInspections.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
          {status || "No hay inspecciones registradas"}
        </div>
      </Card>
    );
  }

  return (
    <div>
      {galleryImages && (
        <PhotoGallery
          images={galleryImages}
          startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          mob={mob}
          token={drive?.token}
          propertyAddress={property.address}
        />
      )}

      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />

      {/* Botones */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "flex-end" }}>
        <button onClick={() => uploadRef.current?.click()} disabled={uploading} style={{
          padding: "8px 16px",
          background: uploading ? C.surface2 : C.accent,
          color: uploading ? C.textMuted : "white",
          border: "none",
          borderRadius: 8,
          cursor: uploading ? "default" : "pointer",
          fontFamily: "DM Sans",
          fontSize: 13,
          fontWeight: 600,
        }}>
          📸 Subir
        </button>
        <button onClick={handleAddNote} style={{
          padding: "8px 16px",
          background: `${C.green}15`,
          border: `1px solid ${C.green}40`,
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "DM Sans",
          fontSize: 13,
          color: C.green,
          fontWeight: 600,
        }}>
          📝 Nota
        </button>
      </div>

      {status && (
        <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: status.startsWith("✓") ? `${C.green}15` : `${C.accent}15`, border: `1px solid ${status.startsWith("✓") ? C.green : C.accent}40` }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: status.startsWith("✓") ? C.green : status.startsWith("Error") ? C.red : C.accent }}>{status}</span>
        </div>
      )}

      {/* ✅ NUEVO: Dropdown con inspecciones separadas por año */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
          Inspección:
        </label>
        <select
          value={selectedInspection || ""}
          onChange={(e) => handleInspectionChange(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontFamily: "DM Sans",
            fontSize: 13,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: C.surface2,
            color: C.text,
            cursor: "pointer",
          }}
        >
          {allInspections.map(yearGroup => (
            <optgroup key={yearGroup.year} label={`─── ${yearGroup.year} ───`}>
              {yearGroup.inspections.map(insp => (
                <option key={insp.id} value={insp.id}>
                  {insp.folderName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Notas (solo para esta fecha) */}
      {notes.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            📝 Notas de esta inspección
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((n, i) => (
              <div key={n.id || i} style={{
                background: C.surface2,
                borderRadius: 8,
                padding: "8px 12px",
                borderLeft: `3px solid ${C.accent}`,
              }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginBottom: 4 }}>
                  {new Date(n.note_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {n.created_by}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text }}>{n.note_text}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fotos */}
      {selectedInspection && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            📁 {photos.length} fotos
          </div>

          {photos.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 6 }}>
              {photos.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => {
                    setGalleryImages(photos);
                    setGalleryStart(idx);
                  }}
                  style={{
                    background: C.surface2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    overflow: "hidden",
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <AuthImage
                    fileId={img.google_drive_file_id}
                    token={drive?.token}
                    alt={img.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
                No hay fotos en esta fecha
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InspectionPanel;
