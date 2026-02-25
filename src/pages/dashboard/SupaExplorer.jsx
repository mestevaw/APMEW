// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/SupaExplorer.jsx
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch } from "../../lib/supabase";
import { getFileIcon, getFileExt, isImage, getThumbnailUrl } from "../../lib/helpers";
import { Card, Badge, Spinner } from "../../components/UI";
import { FilePreviewModal } from "../../components/FilePreviewModal";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const SupaExplorer = ({ rootFolderId, mob, drive, propertyAddress }) => {
  const [currentFolder, setCurrentFolder] = useState(rootFolderId);
  const [breadcrumb, setBreadcrumb] = useState([{ id: rootFolderId, name: "Inicio" }]);
  const [subfolders, setSubfolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);

  useEffect(() => { setCurrentFolder(rootFolderId); setBreadcrumb([{ id: rootFolderId, name: "Inicio" }]); }, [rootFolderId]);

  useEffect(() => {
    const load = async () => {
      if (!currentFolder || currentFolder === "undefined") { setLoading(false); return; }
      setLoading(true);
      try {
        // ── FIX v1.0: Si hay token de Drive, usar API directamente (siempre up-to-date) ──
        // Antes: caía a Supabase si la carpeta estaba vacía (allFiles.length > 0).
        // Ahora: confía en Drive si responde (allFiles !== null), incluso si está vacía.
        if (drive?.token && drive?.listAllFiles && currentFolder) {
          const allFiles = await drive.listAllFiles(currentFolder);
          if (allFiles) {
            const driveFolders = allFiles
              .filter(f => f.mimeType === "application/vnd.google-apps.folder")
              .map(f => ({ id: f.id, name: f.name, google_drive_id: f.id }))
              .sort((a, b) => a.name.localeCompare(b.name));
            const driveFiles = allFiles
              .filter(f => f.mimeType !== "application/vnd.google-apps.folder")
              .map(f => ({
                id: f.id, title: f.name, google_drive_file_id: f.id,
                mime_type: f.mimeType, file_type: (f.name || "").split(".").pop().toLowerCase(),
              }))
              .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            setSubfolders(driveFolders);
            setDocs(driveFiles);
            setLoading(false);
            return;
          }
        }
        // Fallback: read from Supabase index
        const [folders, files] = await Promise.all([
          supaFetch("drive_folders", { filters: `parent_drive_id=eq.${currentFolder}`, order: "name" }),
          supaFetch("documents", { filters: `parent_folder_drive_id=eq.${currentFolder}`, order: "title" }),
        ]);
        setSubfolders(folders || []);
        setDocs(files || []);
      } catch (e) { console.error(e); setSubfolders([]); setDocs([]); }
      setLoading(false);
    };
    load();
  }, [currentFolder, drive?.token]);

  const navigateToFolder = (driveId, folderName) => {
    setCurrentFolder(driveId);
    setBreadcrumb(prev => [...prev, { id: driveId, name: folderName }]);
  };
  const navigateToBreadcrumb = (index) => {
    setCurrentFolder(breadcrumb[index].id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };

  const imageFiles = docs.filter(d => isImage(d.mime_type));
  const nonImageFiles = docs.filter(d => !isImage(d.mime_type));

  const openImage = (imgDoc, idx) => {
    setGalleryImages(imageFiles);
    setGalleryStart(idx);
  };

  const isInspectionContext = breadcrumb.some(b => (b.name || "").toUpperCase().includes("INSPEC"));

  return (
    <div>
      {/* Photo gallery */}
      {galleryImages && (
        <PhotoGallery images={galleryImages} startIndex={galleryStart} onClose={() => setGalleryImages(null)} mob={mob} token={drive?.token} propertyAddress={isInspectionContext ? propertyAddress : null} />
      )}

      {/* File preview modal (non-image) */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />

      {/* Breadcrumb */}
      {breadcrumb.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {breadcrumb.map((b, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <span style={{ color: C.textMuted, fontSize: 12 }}>/</span>}
              <button onClick={() => navigateToBreadcrumb(i)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, color: i === breadcrumb.length - 1 ? C.accent : C.textDim, fontWeight: i === breadcrumb.length - 1 ? 600 : 400, padding: "2px 4px" }}>{b.name}</button>
            </span>
          ))}
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}><Spinner /><p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>Cargando...</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {breadcrumb.length > 1 && (
              <button onClick={() => navigateToBreadcrumb(breadcrumb.length - 2)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {I.back}<span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>.. Regresar</span>
              </button>
            )}
            {subfolders.map(f => (
              <button key={f.id} onClick={() => navigateToFolder(f.google_drive_id, f.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: C.accent }}>{I.folder}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: C.text, flex: 1 }}>{f.name}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted }}>Carpeta</span>
              </button>
            ))}
            {nonImageFiles.map(d => (
              <button key={d.id} onClick={() => d.google_drive_file_id && setPreviewFile({ id: d.google_drive_file_id, name: d.title })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 16 }}>{getFileIcon(d.mime_type)}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, flex: 1 }}>{d.title}</span>
                <Badge color={C.blue}>{d.file_type || getFileExt(d.mime_type) || "file"}</Badge>
              </button>
            ))}
            {/* Image grid with gallery */}
            {imageFiles.length > 0 && (
              <div style={{ padding: "12px 0 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>🖼️ {imageFiles.length} fotos</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3, 1fr)" : "repeat(4, 1fr)", gap: 6 }}>
                  {imageFiles.map((img, idx) => (
                    <button key={img.id} onClick={() => openImage(img, idx)} style={{
                      background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
                      cursor: "pointer", overflow: "hidden", aspectRatio: "1", display: "flex",
                      alignItems: "center", justifyContent: "center", padding: 0, transition: "border-color 0.2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      {drive?.token ? (
                        <AuthImage fileId={img.google_drive_file_id} token={drive.token} alt={img.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 24 }}>📷</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {subfolders.length === 0 && docs.length === 0 && !loading && (
              <div style={{ textAlign: "center", padding: 30 }}><p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>Carpeta vacía</p></div>
            )}
          </div>
        )}
      </Card>
      <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>{subfolders.length} carpetas, {docs.length} archivos</div>
    </div>
  );
};

export default SupaExplorer;
