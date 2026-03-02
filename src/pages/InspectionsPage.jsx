// ═══════════════════════════════════════════
// Archivo: src/pages/InspectionsPage.jsx
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaInsert } from "../lib/supabase";
import { isImage, todayFolderName } from "../lib/helpers";
import { Card, Spinner } from "../components/UI";
import { PROPERTIES, OWNER_COLORS } from "./dashboard/constants";
import AuthImage from "./dashboard/AuthImage";
import PhotoGallery from "./dashboard/PhotoGallery";
import { BulkPhotoUpload } from "../components/BulkPhotoUpload";

export const InspectionsPage = ({ mob, drive }) => {
  const activeProps = PROPERTIES.filter(p => !p.sold);
  const [selected, setSelected]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState("");
  const [dateFolderId, setDateFolderId]   = useState(null);
  const [photos, setPhotos]               = useState([]);
  const [notes, setNotes]                 = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart]   = useState(0);
  const [uploading, setUploading]         = useState(false);
  const [uploadMsg, setUploadMsg]         = useState("");
  const uploadRef = useRef(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate]     = useState(null);

  // Extraemos token para evitar que el objeto `drive` (nueva ref cada render)
  // dispare el efecto innecesariamente.
  const driveToken = drive?.token;

  // ─── Stable references a funciones de drive ───
  const searchFolderByAddress = drive?.searchFolderByAddress;
  const findSubfolder         = drive?.findSubfolder;
  const listAllFiles          = drive?.listAllFiles;

  // ─── Navigate to INSPECCION/year/today para la propiedad seleccionada ───
  useEffect(() => {
    if (!selected || !driveToken) return;
    let cancelled = false;

    const navigate = async () => {
      setLoading(true);
      setStatus("Buscando carpeta de la propiedad...");
      setDateFolderId(null);
      setPhotos([]);
      setNotes([]);
      setAvailableDates([]);

      try {
        // 1. Find property folder in Drive
        const propFolder = await searchFolderByAddress(selected.address, selected.owner, DRIVE_ROOT_FOLDER);
        if (cancelled) return;
        if (!propFolder) {
          setStatus("No se encontró la carpeta de la propiedad en Drive.");
          setLoading(false);
          return;
        }

        // 2. INSPECCION subfolder
        setStatus("Buscando carpeta INSPECCION...");
        const inspecFolder = await findSubfolder(propFolder.id, "INSPEC");
        if (cancelled) return;
        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCION para esta propiedad.");
          setLoading(false);
          return;
        }

        // 3. Cargar TODOS los años disponibles
        setStatus("Cargando historial de inspecciones...");
        const allYears = await listAllFiles(inspecFolder.id);
        if (cancelled) return;
        
        const yearFolders = (allYears || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
          .sort((a, b) => b.name.localeCompare(a.name)); // Años más recientes primero

        // 3.5. Cargar todas las fechas de todos los años
        let allDateFolders = [];
        for (const yearFolder of yearFolders) {
          const datesInYear = await listAllFiles(yearFolder.id);
          if (cancelled) return;
          const dateFolders = (datesInYear || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder")
            .map(f => ({ ...f, year: yearFolder.name })); // Agregar info del año
          allDateFolders = [...allDateFolders, ...dateFolders];
        }
        
        // Ordenar todas las fechas por nombre (más reciente primero)
        allDateFolders.sort((a, b) => b.name.localeCompare(a.name));
        setAvailableDates(allDateFolders);

        // 4. Determinar qué fecha mostrar
        const currentYear = new Date().getFullYear().toString();
        const today = todayFolderName();
        let targetDateFolder = null;

        if (selectedDate) {
          // Usar fecha seleccionada del dropdown
          targetDateFolder = allDateFolders.find(f => f.id === selectedDate);
        } else {
          // Buscar inspección de hoy en el año actual
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
          // No hay inspección de hoy — mostrar la más reciente de cualquier año
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

        // 6. Fetch notes from Supabase
        const notesData = await supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(selected.address)}`,
          order: "note_date.desc",
        });
        if (!cancelled) setNotes(notesData || []);

      } catch (err) {
        console.error("[InspectionsPage]", err);
        if (!cancelled) setStatus("Error: " + err.message);
      }
      if (!cancelled) setLoading(false);
    };

    navigate();
    return () => { cancelled = true; };
  }, [selected, driveToken, searchFolderByAddress, findSubfolder, listAllFiles, selectedDate]);

  // ─── Upload handler ───
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !driveToken || !drive?.uploadPhotos || !selected) return;

    setUploading(true);
    setUploadMsg(`Subiendo ${files.length} fotos...`);

    try {
      const propFolder = await searchFolderByAddress(selected.address, selected.owner, DRIVE_ROOT_FOLDER);
      if (!propFolder) throw new Error("No se encontró la carpeta de la propiedad");

      const { results, skipped = 0 } = await drive.uploadPhotos(
        files, propFolder.id, selected.address,
        (cur, total, name) => setUploadMsg(`Subiendo ${cur}/${total}... ${name}`)
      );
      const newUploads = results.filter(r => !r.skipped).length;
      setUploadMsg(skipped > 0
        ? `✓ ${newUploads} nuevas, ${skipped} ya existían`
        : `✓ ${results.length} fotos subidas`
      );

      // Refresh
      setSelected({ ...selected });
    } catch (err) {
      setUploadMsg("Error: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
    setTimeout(() => setUploadMsg(""), 6000);
  };

  // ─── Add note ───
  const handleAddNote = useCallback(() => {
    const note = prompt("Nota de inspección:");
    if (!note?.trim() || !selected) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    supaInsert("inspection_notes", {
      property_address: selected.address,
      note_date: dateStr,
      note_text: note.trim(),
      created_by: "MEW",
    })
      .then(() => {
        setUploadMsg("✓ Nota guardada");
        supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(selected.address)}`,
          order: "note_date.desc",
        }).then(rows => setNotes(rows || []));
      })
      .catch(err => setUploadMsg("Error: " + err.message));
    setTimeout(() => setUploadMsg(""), 4000);
  }, [selected]);

  // ─── Render: sin token ───
  if (!driveToken) {
    return (
      <div>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Inspecciones</h1>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 20 }}>Conecta Google Drive para ver inspecciones.</p>
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>Inicia sesión con Google Drive primero</p>
        </Card>
      </div>
    );
  }

  // ─── Render principal ───
  return (
    <div>
      {galleryImages && (
        <PhotoGallery
          images={galleryImages} startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          mob={mob} token={driveToken}
          propertyAddress={selected?.address}
        />
      )}

      {showBulkUpload && (
        <BulkPhotoUpload
          drive={drive}
          onClose={() => setShowBulkUpload(false)}
          onComplete={(results) => {
            setUploadMsg(`✓ ${results.success} fotos subidas, ${results.failed} fallidas`);
            setTimeout(() => setUploadMsg(""), 6000);
            // Refresh la vista
            if (selected) setSelected({ ...selected });
          }}
          mob={mob}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0 }}>Inspecciones</h1>
        <button onClick={() => setShowBulkUpload(true)} style={{
          padding: "8px 16px", background: C.accent, color: "white",
          border: "none", borderRadius: 8, cursor: "pointer", 
          fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>📤 Subir Fotos</button>
      </div>
      <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 20 }}>
        Fotos y notas de inspecciones · {todayFolderName()}
      </p>

      {/* Selector de propiedad */}
      {!selected ? (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.textDim, marginBottom: 12 }}>Selecciona una propiedad:</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activeProps.map(p => (
              <button key={p.address} onClick={() => setSelected(p)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: "transparent", border: "none", cursor: "pointer", borderRadius: 8,
                width: "100%", textAlign: "left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: OWNER_COLORS[p.owner] || C.accent, fontSize: 16 }}>🏠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: C.text }}>{p.address}</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: OWNER_COLORS[p.owner] || C.textDim }}>{p.owner}</div>
                </div>
                <span style={{ color: C.textMuted, fontSize: 12 }}>→</span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div>
          {/* Back + header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setSelected(null); setDateFolderId(null); setPhotos([]); setNotes([]); setStatus(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>
              {I.back}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: mob ? 16 : 18, fontWeight: 700, color: C.text }}>{selected.address}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: OWNER_COLORS[selected.owner] || C.textDim }}>{selected.owner}</div>
            </div>
            <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />
            <button onClick={() => uploadRef.current?.click()} disabled={uploading} style={{
              padding: "6px 12px", background: `${C.accent}15`, border: `1px solid ${C.accent}40`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.accent,
            }}>📸 Subir</button>
            <button onClick={handleAddNote} style={{
              padding: "6px 12px", background: `${C.green}15`, border: `1px solid ${C.green}40`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.green,
            }}>📝 Nota</button>
          </div>

          {/* Dropdown de fechas de inspección */}
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
                  padding: "8px 12px",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.surface2,
                  color: C.text,
                }}
              >
                <option value="">Hoy / Más reciente</option>
                {(() => {
                  // Agrupar por año
                  const byYear = {};
                  availableDates.forEach(folder => {
                    const year = folder.year || "Sin año";
                    if (!byYear[year]) byYear[year] = [];
                    byYear[year].push(folder);
                  });
                  
                  // Ordenar años descendente
                  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
                  
                  return years.map(year => (
                    <optgroup key={year} label={year}>
                      {byYear[year].map(folder => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>
          )}

          {/* Upload message */}
          {uploadMsg && (
            <div style={{
              padding: "8px 14px", marginBottom: 12, borderRadius: 8,
              background: uploadMsg.startsWith("✓") ? `${C.green}15` : `${C.accent}15`,
              border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : C.accent}40`,
            }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent }}>{uploadMsg}</span>
            </div>
          )}

          {loading && (
            <Card style={{ textAlign: "center", padding: 30 }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>{status || "Cargando..."}</p>
            </Card>
          )}

          {!loading && status && !dateFolderId && (
            <Card style={{ textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>{status}</p>
            </Card>
          )}

          {/* Notas */}
          {!loading && notes.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>📝 Notas de Inspección</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notes.map((n, i) => (
                  <div key={n.id || i} style={{
                    background: C.surface2, borderRadius: 8, padding: "8px 12px",
                    borderLeft: `3px solid ${C.accent}`,
                  }}>
                    <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginBottom: 4 }}>
                      {n.note_date ? new Date(n.note_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : ""}
                      {n.created_by ? ` · ${n.created_by}` : ""}
                    </div>
                    <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.note_text}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Fotos */}
          {!loading && dateFolderId && (
            <Card>
              {status && <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.accent, marginBottom: 10 }}>{status}</div>}
              {photos.length > 0 ? (
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 8 }}>🖼️ {photos.length} fotos</div>
                  <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 6 }}>
                    {photos.map((img, idx) => (
                      <button key={img.id} onClick={() => { setGalleryImages(photos); setGalleryStart(idx); }} style={{
                        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
                        cursor: "pointer", overflow: "hidden", aspectRatio: "1", display: "flex",
                        alignItems: "center", justifyContent: "center", padding: 0, transition: "border-color 0.2s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                        <AuthImage fileId={img.google_drive_file_id} token={driveToken} alt={img.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>No hay fotos en esta inspección</p>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
