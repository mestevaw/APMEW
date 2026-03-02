// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx  
// Versión: 2.0 - Basado en InspectionsPage
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { isImage, todayFolderName } from "../../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const InspectionPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [dateFolderId, setDateFolderId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  const driveToken = drive?.token;
  const searchFolderByAddress = drive?.searchFolderByAddress;
  const findSubfolder = drive?.findSubfolder;
  const listAllFiles = drive?.listAllFiles;
  const uploadPhotos = drive?.uploadPhotos;

  // ─── Navigate to INSPECCION ───
  useEffect(() => {
    if (!driveToken) return;
    let cancelled = false;

    const navigate = async () => {
      setLoading(true);
      setStatus("Buscando carpeta de la propiedad...");
      setDateFolderId(null);
      setPhotos([]);
      setNotes([]);
      setAvailableDates([]);

      try {
        const propFolder = await searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
        if (cancelled) return;
        if (!propFolder) {
          setStatus("No se encontró la carpeta de la propiedad en Drive.");
          setLoading(false);
          return;
        }

        setStatus("Buscando carpeta INSPECCION...");
        const inspecFolder = await findSubfolder(propFolder.id, "INSPEC");
        if (cancelled) return;
        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCION para esta propiedad.");
          setLoading(false);
          return;
        }

        setStatus("Cargando historial de inspecciones...");
        const allYears = await listAllFiles(inspecFolder.id);
        if (cancelled) return;
        
        const yearFolders = (allYears || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
          .sort((a, b) => b.name.localeCompare(a.name));

        let allDateFolders = [];
        for (const yearFolder of yearFolders) {
          const datesInYear = await listAllFiles(yearFolder.id);
          if (cancelled) return;
          const dateFolders = (datesInYear || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder")
            .map(f => ({ ...f, year: yearFolder.name }));
          allDateFolders = [...allDateFolders, ...dateFolders];
        }
        
        allDateFolders.sort((a, b) => b.name.localeCompare(a.name));
        setAvailableDates(allDateFolders);

        const currentYear = new Date().getFullYear().toString();
        const today = todayFolderName();
        let targetDateFolder = null;

        if (selectedDate) {
          targetDateFolder = allDateFolders.find(f => f.id === selectedDate);
        } else {
          const currentYearFolder = yearFolders.find(y => y.name === currentYear);
          if (currentYearFolder) {
            setStatus(`Buscando inspección de hoy (${today})...`);
            targetDateFolder = await findSubfolder(currentYearFolder.id, today);
          }
        }

        const loadPhotosFromFolder = async (folderId) => {
          const files = await listAllFiles(folderId);
          if (cancelled) return [];
          return (files || [])
            .filter(f => isImage(f.mimeType))
            .map(f => ({
              id: f.id, title: f.name, google_drive_file_id: f.id,
              mime_type: f.mimeType, file_type: (f.name || "").split(".").pop().toLowerCase(),
            }));
        };

        if (targetDateFolder) {
          setDateFolderId(targetDateFolder.id);
          setStatus(selectedDate ? `Mostrando: ${targetDateFolder.name}` : "");
          const imgs = await loadPhotosFromFolder(targetDateFolder.id);
          if (!cancelled) setPhotos(imgs);
        } else if (!selectedDate) {
          setStatus("No hay inspección de hoy. Mostrando la más reciente...");
          
          if (allDateFolders.length > 0) {
            const recentFolder = allDateFolders[0];
            setDateFolderId(recentFolder.id);
            setStatus(`Mostrando: ${recentFolder.name} (${recentFolder.year})`);
            const imgs = await loadPhotosFromFolder(recentFolder.id);
            if (!cancelled) setPhotos(imgs);
          } else {
            setStatus("No hay inspecciones registradas.");
          }
        } else {
          setStatus("No se encontró la inspección seleccionada.");
        }

        const notesData = await supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(property.address)}`,
          order: "note_date.desc",
        });
        if (!cancelled) setNotes(notesData || []);

      } catch (err) {
        console.error("[InspectionPanel]", err);
        if (!cancelled) setStatus("Error: " + err.message);
      }
      if (!cancelled) setLoading(false);
    };

    navigate();
    return () => { cancelled = true; };
  }, [driveToken, searchFolderByAddress, findSubfolder, listAllFiles, selectedDate, property.address, property.owner]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !driveToken || !uploadPhotos) return;
    
    setUploading(true);
    setStatus(`Subiendo ${files.length} fotos...`);
    
    try {
      const propFolder = await searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
      if (!propFolder) {
        setStatus("No se encontró carpeta de la propiedad");
        setUploading(false);
        return;
      }

      const result = await uploadPhotos(files, propFolder.id, property.address, 
        (cur, total, name) => setStatus(`Subiendo ${cur}/${total}... ${name}`)
      );

      setStatus(`✓ ${result.results.length} fotos subidas`);
      
      if (dateFolderId) {
        const imgs = await listAllFiles(dateFolderId);
        const filtered = (imgs || [])
          .filter(f => isImage(f.mimeType))
          .map(f => ({
            id: f.id, title: f.name, google_drive_file_id: f.id,
            mime_type: f.mimeType, file_type: (f.name || "").split(".").pop().toLowerCase(),
          }));
        setPhotos(filtered);
      }
      
      setTimeout(() => setStatus(""), 4000);
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
    setUploading(false);
  };

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
      .catch(err => console.error(err));
  }, [property.address]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spinner />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
            {status || "Cargando..."}
          </p>
        </div>
      </Card>
    );
  }

  const byYear = {};
  availableDates.forEach(folder => {
    if (!byYear[folder.year]) byYear[folder.year] = [];
    byYear[folder.year].push(folder);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {galleryImages && (
        <PhotoGallery
          images={galleryImages}
          startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          mob={mob}
          token={driveToken}
          propertyAddress={property.address}
        />
      )}

      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />

      {/* Botones de acción */}
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

      {/* Dropdown de fechas */}
      {availableDates.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
            Ver inspección:
          </label>
          <select
            value={selectedDate || ""}
            onChange={(e) => setSelectedDate(e.target.value || null)}
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
            <option value="">Hoy / Más reciente</option>
            {years.map(year => (
              <optgroup key={year} label={year}>
                {byYear[year].map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </optgroup>
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
                background: C.surface2, borderRadius: 8, padding: "8px 12px",
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
      {!loading && dateFolderId && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            {selectedDate ? (
              <span>🖼️ {photos.length} fotos</span>
            ) : (
              <span>Mostrando: {photos.length > 0 ? `${photos.length} fotos` : "Sin fotos"}</span>
            )}
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
                    token={driveToken}
                    alt={img.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
                {status || "No hay fotos en esta inspección"}
              </p>
            </div>
          )}
        </Card>
      )}

      {!loading && !dateFolderId && status && (
        <Card style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>{status}</p>
        </Card>
      )}
    </div>
  );
};

export default InspectionPanel;
