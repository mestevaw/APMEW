// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx  
// Versión: 4.0 - Busca en Drive como SupaExplorer
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { todayFolderName } from "../../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const InspectionPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [yearFolders, setYearFolders] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [dateFolders, setDateFolders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const uploadRef = useRef(null);

  // ─── Cargar años desde Drive DIRECTAMENTE (como SupaExplorer) ───
  useEffect(() => {
    const loadYears = async () => {
      setLoading(true);
      try {
        if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
          setYearFolders([]);
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
          setYearFolders([]);
          setLoading(false);
          return;
        }

        // 2. Buscar carpeta INSPECCIONES (busca con "INSPEC" para detectar tanto INSPECCION como INSPECCIONES)
        const inspecFolder = await drive.findSubfolder(propFolder.id, "INSPEC");

        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCIONES para esta propiedad");
          setYearFolders([]);
          setLoading(false);
          return;
        }

        // 3. Listar años dentro de INSPECCIONES (busca directamente en Drive API)
        const allFiles = await drive.listAllFiles(inspecFolder.id);
        
        const years = (allFiles || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
          .map(f => ({ id: f.id, name: f.name }))
          .sort((a, b) => b.name.localeCompare(a.name));

        setYearFolders(years);

        // Auto-seleccionar año actual
        const currentYear = new Date().getFullYear().toString();
        const current = years.find(y => y.name === currentYear);
        if (current) {
          setSelectedYear(current.id);
        } else if (years.length > 0) {
          setSelectedYear(years[0].id);
        }
      } catch (err) {
        console.error("[InspectionPanel] Error loading years:", err);
        setStatus("Error al cargar años: " + err.message);
      }
      setLoading(false);
    };

    loadYears();
  }, [property.address, property.owner, drive?.token, drive?.listAllFiles, drive?.searchFolderByAddress, drive?.findSubfolder]);

  // ─── Cargar fechas cuando se selecciona un año ───
  useEffect(() => {
    if (!selectedYear || !drive?.listAllFiles) return;

    const loadDates = async () => {
      setLoading(true);
      try {
        const files = await drive.listAllFiles(selectedYear);
        const dates = (files || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder")
          .sort((a, b) => b.name.localeCompare(a.name));

        setDateFolders(dates);

        // Auto-seleccionar fecha de hoy o más reciente
        const today = todayFolderName();
        const todayFolder = dates.find(d => d.name === today);
        if (todayFolder) {
          setSelectedDate(todayFolder.id);
        } else if (dates.length > 0) {
          setSelectedDate(dates[0].id);
        } else {
          setSelectedDate(null);
        }
      } catch (err) {
        console.error("[InspectionPanel] Error loading dates:", err);
        setDateFolders([]);
      }
      setLoading(false);
    };

    loadDates();
  }, [selectedYear, drive?.listAllFiles]);

  // ─── Cargar fotos cuando se selecciona fecha ───
  useEffect(() => {
    if (!selectedDate || !drive?.listAllFiles) return;

    const loadPhotos = async () => {
      try {
        const files = await drive.listAllFiles(selectedDate);
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
  }, [selectedDate, drive?.listAllFiles]);

  // ─── Cargar notas ───
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const notesData = await supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}`,
          order: "note_date.desc",
        });
        setNotes(notesData || []);
      } catch (err) {
        console.error("[InspectionPanel] Error loading notes:", err);
      }
    };

    loadNotes();
  }, [property.address]);

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
      if (selectedDate && drive.listAllFiles) {
        const refreshed = await drive.listAllFiles(selectedDate);
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

  // ─── Agregar nota ───
  const handleAddNote = useCallback(() => {
    const note = prompt("Nota de inspección:");
    if (!note?.trim()) return;

    const dateStr = new Date().toISOString().slice(0, 10);
    supaInsert("inspection_notes", {
      property_address: property.address,
      note_date: dateStr,
      note_text: note.trim(),
      created_by: "MEW",
    })
      .then(() => {
        supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}`,
          order: "note_date.desc",
        }).then(rows => setNotes(rows || []));
        setStatus("✓ Nota guardada");
        setTimeout(() => setStatus(""), 3000);
      })
      .catch(err => {
        console.error(err);
        setStatus("Error al guardar nota");
      });
  }, [property.address]);

  if (loading && yearFolders.length === 0) {
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

  if (yearFolders.length === 0) {
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

      {/* Selector de Año */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
          Año:
        </label>
        <select
          value={selectedYear || ""}
          onChange={(e) => setSelectedYear(e.target.value)}
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
          {yearFolders.map(year => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de Fecha */}
      {dateFolders.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
            Fecha:
          </label>
          <select
            value={selectedDate || ""}
            onChange={(e) => setSelectedDate(e.target.value)}
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
            {dateFolders.map(date => (
              <option key={date.id} value={date.id}>
                {date.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notas */}
      {notes.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            📝 Notas de Inspección
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
      {selectedDate && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            🖼️ {photos.length} fotos
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
