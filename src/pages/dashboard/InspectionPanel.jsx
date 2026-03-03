// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx  
// Versión: V9
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V9:
// - "Inspección:" → "Inspección del:"
// - Dropdown y nota en misma línea (layout horizontal)
// - "+ Meter Nota" → "+ Agregar Nota"
// - Controles más compactos
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const parseInspectionPath = (folderPath) => {
  const parts = folderPath.split('/');
  if (parts.length < 6) return null;
  
  const inspIdx = parts.findIndex(p => p.toLowerCase().includes('inspeccion'));
  if (inspIdx === -1 || inspIdx + 2 >= parts.length) return null;
  
  const year = parts[inspIdx + 1];
  const date = parts[inspIdx + 2];
  
  if (!/^\d{4}$/.test(year)) return null;
  
  return { year, date, folderPath };
};

const parseFolderDate = (folderName, year) => {
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
  const [allInspections, setAllInspections] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState(null); // Solo UNA nota por fecha
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [status, setStatus] = useState("");

  // ─── Cargar inspecciones desde Supabase ───
  useEffect(() => {
    const loadAllInspections = async () => {
      setLoading(true);
      
      try {
        setStatus("Cargando desde índice...");
        const folders = await supaFetch("drive_folders", {
          filters: `folder_path=ilike.*${property.address}*INSPECCION*`,
          order: "folder_path.desc"
        });

        if (folders && folders.length > 0) {
          const parsed = folders
            .map(f => parseInspectionPath(f.folder_path))
            .filter(Boolean);

          if (parsed.length > 0) {
            const byYear = {};
            parsed.forEach(p => {
              if (!byYear[p.year]) byYear[p.year] = [];
              byYear[p.year].push({
                id: p.folderPath,
                folderName: p.date,
                year: p.year,
                sortDate: parseFolderDate(p.date, p.year) || new Date(0),
              });
            });

            const inspectionsByYear = Object.entries(byYear)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, inspections]) => ({
                year,
                inspections: inspections.sort((a, b) => b.sortDate - a.sortDate)
              }));

            setAllInspections(inspectionsByYear);

            if (inspectionsByYear.length > 0 && inspectionsByYear[0].inspections.length > 0) {
              const first = inspectionsByYear[0].inspections[0];
              setSelectedInspection(first.id);
              setSelectedDate(first.sortDate);
            }

            setLoading(false);
            setStatus("");
            return;
          }
        }

        // Fallback a Drive API
        await loadFromDrive();

      } catch (err) {
        console.error("[InspectionPanel] Error:", err);
        setStatus("Error: " + err.message);
        setLoading(false);
      }
    };

    const loadFromDrive = async () => {
      if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
        setAllInspections([]);
        setLoading(false);
        return;
      }

      setStatus("Cargando desde Drive...");

      const propFolder = await drive.searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
      if (!propFolder) {
        setStatus("No se encontró la carpeta de la propiedad");
        setAllInspections([]);
        setLoading(false);
        return;
      }

      const inspecFolder = await drive.findSubfolder(propFolder.id, "INSPEC");
      if (!inspecFolder) {
        setStatus("No existe carpeta INSPECCIONES");
        setAllInspections([]);
        setLoading(false);
        return;
      }

      const allFiles = await drive.listAllFiles(inspecFolder.id);
      const years = (allFiles || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
        .sort((a, b) => b.name.localeCompare(a.name));

      const inspectionsByYear = [];
      for (const year of years) {
        const dateFiles = await drive.listAllFiles(year.id);
        const dates = (dateFiles || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder");
        
        if (dates.length === 0) continue;

        const parsedDates = dates.map(date => ({
          id: date.id,
          folderName: date.name,
          year: year.name,
          sortDate: parseFolderDate(date.name, year.name) || new Date(0),
        })).sort((a, b) => b.sortDate - a.sortDate);

        inspectionsByYear.push({ year: year.name, inspections: parsedDates });
      }

      setAllInspections(inspectionsByYear);
      if (inspectionsByYear.length > 0 && inspectionsByYear[0].inspections.length > 0) {
        const first = inspectionsByYear[0].inspections[0];
        setSelectedInspection(first.id);
        setSelectedDate(first.sortDate);
      }

      setLoading(false);
      setStatus("");
    };

    loadAllInspections();
  }, [property.address, property.owner, drive?.token]);

  // ─── Cargar fotos ───
  useEffect(() => {
    if (!selectedInspection || !drive?.listAllFiles) return;

    const loadPhotos = async () => {
      try {
        let folderId = selectedInspection;
        
        if (selectedInspection.includes('/')) {
          const folder = await supaFetch("drive_folders", {
            filters: `folder_path=eq.${encodeURIComponent(selectedInspection)}`
          });
          if (folder && folder[0]) {
            folderId = folder[0].google_drive_id;
          }
        }

        const files = await drive.listAllFiles(folderId);
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

  // ─── Cargar nota de esta fecha ───
  useEffect(() => {
    const loadNote = async () => {
      if (!selectedDate) {
        setNote(null);
        return;
      }

      try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const notesData = await supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}&note_date=eq.${dateStr}`,
          order: "created_at.desc",
          limit: 1
        });
        setNote(notesData && notesData[0] ? notesData[0] : null);
      } catch (err) {
        console.error("[InspectionPanel] Error loading note:", err);
        setNote(null);
      }
    };

    loadNote();
  }, [property.address, selectedDate]);

  // ─── Agregar nota ───
  const handleAddNote = useCallback(() => {
    if (!selectedDate) {
      alert("Selecciona una fecha de inspección primero");
      return;
    }

    const noteText = prompt("Nota de inspección:");
    if (!noteText?.trim()) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    supaInsert("inspection_notes", {
      property_address: property.address,
      note_date: dateStr,
      note_text: noteText.trim(),
      created_by: "MEW",
    })
      .then(() => {
        // Recargar nota
        supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}&note_date=eq.${dateStr}`,
          order: "created_at.desc",
          limit: 1
        }).then(rows => setNote(rows && rows[0] ? rows[0] : null));
        setStatus("✓ Nota guardada");
        setTimeout(() => setStatus(""), 3000);
      })
      .catch(err => {
        console.error(err);
        setStatus("Error al guardar nota");
      });
  }, [property.address, selectedDate]);

  // ─── Cambiar inspección ───
  const handleInspectionChange = (inspectionId) => {
    setSelectedInspection(inspectionId);
    
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

      {status && (
        <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: status.startsWith("✓") ? `${C.green}15` : `${C.accent}15`, border: `1px solid ${status.startsWith("✓") ? C.green : C.accent}40` }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: status.startsWith("✓") ? C.green : status.startsWith("Error") ? C.red : C.accent }}>{status}</span>
        </div>
      )}

      {/* ✅ Layout horizontal: Dropdown + Nota/Botón en misma línea */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        {/* Dropdown de inspección (izquierda) */}
        <div style={{ flex: "0 0 auto" }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
            Inspección del:
          </label>
          <select
            value={selectedInspection || ""}
            onChange={(e) => handleInspectionChange(e.target.value)}
            style={{
              width: 200,
              padding: "8px 10px",
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

        {/* Nota o botón (derecha) */}
        <div style={{ flex: 1 }}>
          {note ? (
            <Card style={{ background: `${C.accent}05`, border: `1px solid ${C.accent}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>
                  📝 Nota · {new Date(note.note_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>
                  {note.created_by}
                </div>
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text }}>
                {note.note_text}
              </div>
            </Card>
          ) : (
            <button
              onClick={handleAddNote}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: `${C.green}10`,
                border: `1px dashed ${C.green}60`,
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: C.green,
                fontWeight: 600,
                transition: "all 0.2s",
                marginTop: 20,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${C.green}20`;
                e.currentTarget.style.borderStyle = "solid";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${C.green}10`;
                e.currentTarget.style.borderStyle = "dashed";
              }}
            >
              + Agregar Nota
            </button>
          )}
        </div>
      </div>

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
                    useThumbnail={true}
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
