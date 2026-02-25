// ═══════════════════════════════════════════
// Archivo: src/pages/InspectionsPage.jsx
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaInsert } from "../lib/supabase";
import { isImage } from "../lib/helpers";
import { Card, Spinner } from "../components/UI";
import { PROPERTIES, OWNER_COLORS } from "./dashboard/constants";
import AuthImage from "./dashboard/AuthImage";
import PhotoGallery from "./dashboard/PhotoGallery";

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const todayName = () => {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

export const InspectionsPage = ({ mob, drive }) => {
  const activeProps = PROPERTIES.filter(p => !p.sold);
  const [selected, setSelected] = useState(null);       // selected property
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");              // status text
  const [dateFolderId, setDateFolderId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const uploadRef = useRef(null);

  // ─── Navigate to INSPECCION/year/today for selected property ───
  useEffect(() => {
    if (!selected || !drive?.token) return;
    let cancelled = false;

    const navigate = async () => {
      setLoading(true);
      setStatus("Buscando carpeta de la propiedad...");
      setDateFolderId(null);
      setPhotos([]);
      setNotes([]);

      try {
        // 1. Find property folder in Drive
        const propFolder = await drive.searchFolderByAddress(
          selected.address, selected.owner, DRIVE_ROOT_FOLDER
        );
        if (cancelled) return;
        if (!propFolder) {
          setStatus("No se encontró la carpeta de la propiedad en Drive.");
          setLoading(false);
          return;
        }

        // 2. Find INSPECCION subfolder
        setStatus("Buscando carpeta INSPECCION...");
        const inspecFolder = await drive.findSubfolder(propFolder.id, "INSPEC");
        if (cancelled) return;
        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCION para esta propiedad.");
          setLoading(false);
          return;
        }

        // 3. Find year folder
        const year = new Date().getFullYear().toString();
        setStatus(`Buscando carpeta ${year}...`);
        const yearFolder = await drive.findSubfolder(inspecFolder.id, year);
        if (cancelled) return;
        if (!yearFolder) {
          setStatus(`No hay carpeta de inspecciones para ${year}.`);
          setLoading(false);
          return;
        }

        // 4. Find today's date folder
        const today = todayName();
        setStatus(`Buscando inspección de hoy (${today})...`);
        const dateFolder = await drive.findSubfolder(yearFolder.id, today);
        if (cancelled) return;

        if (dateFolder) {
          setDateFolderId(dateFolder.id);
          setStatus("");

          // 5. List photos in today's folder
          const files = await drive.listAllFiles(dateFolder.id);
          if (cancelled) return;
          const imgs = (files || [])
            .filter(f => isImage(f.mimeType))
            .map(f => ({
              id: f.id, title: f.name, google_drive_file_id: f.id,
              mime_type: f.mimeType, file_type: (f.name || "").split(".").pop().toLowerCase(),
            }));
          setPhotos(imgs);
        } else {
          // No folder for today — show most recent inspection
          setStatus("No hay inspección de hoy. Mostrando la más reciente...");
          const allDates = await drive.listAllFiles(yearFolder.id);
          if (cancelled) return;
          const folders = (allDates || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder")
            .sort((a, b) => b.name.localeCompare(a.name)); // most recent first by name

          if (folders.length > 0) {
            const recentFolder = folders[0];
            setDateFolderId(recentFolder.id);
            setStatus(`Mostrando: ${recentFolder.name}`);
            const files = await drive.listAllFiles(recentFolder.id);
            if (cancelled) return;
            const imgs = (files || [])
              .filter(f => isImage(f.mimeType))
              .map(f => ({
                id: f.id, title: f.name, google_drive_file_id: f.id,
                mime_type: f.mimeType, file_type: (f.name || "").split(".").pop().toLowerCase(),
              }));
            setPhotos(imgs);
          } else {
            setStatus("No hay inspecciones registradas este año.");
          }
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
  }, [selected, drive?.token]);

  // ─── Upload handler ───
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !drive?.token || !drive?.uploadPhotos || !selected) return;

    setUploading(true);
    setUploadMsg(`Subiendo ${files.length} fotos...`);

    try {
      // Find property folder
      const propFolder = await drive.searchFolderByAddress(
        selected.address, selected.owner, DRIVE_ROOT_FOLDER
      );
      if (!propFolder) throw new Error("No se encontró la carpeta de la propiedad");

      const { results, skipped = 0 } = await drive.uploadPhotos(
        files, propFolder.id, selected.address,
        (cur, total, name) => setUploadMsg(`Subiendo ${cur}/${total}... ${name}`)
      );
      const newUploads = results.filter(r => !r.skipped).length;
      const msg = skipped > 0
        ? `✓ ${newUploads} nuevas, ${skipped} ya existían`
        : `✓ ${results.length} fotos subidas`;
      setUploadMsg(msg);

      // Refresh the view
      setSelected({ ...selected }); // trigger re-fetch
    } catch (err) {
      setUploadMsg("Error: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
    setTimeout(() => setUploadMsg(""), 6000);
  };

  // ─── Add note ───
  const handleAddNote = () => {
    const note = prompt("Nota de inspección:");
    if (!note || !note.trim() || !selected) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    supaInsert("inspection_notes", {
      property_address: selected.address,
      note_date: dateStr,
      note_text: note.trim(),
      created_by: "MEW",
    })
      .then(() => {
        setUploadMsg("✓ Nota guardada");
        // Refresh notes
        supaFetch("inspection_notes", {
          filters: `property_address=eq.${encodeURIComponent(selected.address)}`,
          order: "note_date.desc",
        }).then(rows => setNotes(rows || []));
      })
      .catch(err => setUploadMsg("Error: " + err.message));
    setTimeout(() => setUploadMsg(""), 4000);
  };

  // ─── Render ───
  if (!drive?.token) {
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

  return (
    <div>
      {/* Photo Gallery */}
      {galleryImages && (
        <PhotoGallery
          images={galleryImages} startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          mob={mob} token={drive.token}
          propertyAddress={selected?.address}
        />
      )}

      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Inspecciones</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 20 }}>
        Fotos y notas de inspecciones · {todayName()}
      </p>

      {/* Property selector */}
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
          {/* Back + property header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setSelected(null); setDateFolderId(null); setPhotos([]); setNotes([]); setStatus(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>
              {I.back}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: mob ? 16 : 18, fontWeight: 700, color: C.text }}>{selected.address}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: OWNER_COLORS[selected.owner] || C.textDim }}>{selected.owner}</div>
            </div>
            {/* Action buttons */}
            <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />
            <button onClick={() => uploadRef.current?.click()} disabled={uploading} style={{
              padding: "6px 12px", background: `${C.accent}15`, border: `1px solid ${C.accent}40`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.accent,
            }}>📸 Subir fotos</button>
            <button onClick={handleAddNote} style={{
              padding: "6px 12px", background: `${C.blue}15`, border: `1px solid ${C.blue}40`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.blue,
            }}>📝 Nota</button>
          </div>

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

          {/* Loading */}
          {loading && (
            <Card style={{ textAlign: "center", padding: 30 }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>{status || "Cargando..."}</p>
            </Card>
          )}

          {/* Status (non-loading) */}
          {!loading && status && !dateFolderId && (
            <Card style={{ textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>{status}</p>
            </Card>
          )}

          {/* Notes section */}
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

          {/* Photos */}
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
                        <AuthImage fileId={img.google_drive_file_id} token={drive.token} alt={img.title}
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

export default InspectionsPage;
