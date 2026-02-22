// Archivo: src/pages/DocumentsPage.jsx
// Versión: 4.0
// Fecha: 2026-02-20

import { useState, useEffect, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaUpdate, supaInsert, supaDelete, supaUpsert } from "../lib/supabase";
import { Card, Badge, Btn, Spinner, Table } from "../components/UI";

// ─── Helpers ───
const isFolder = (f) => f.mimeType === "application/vnd.google-apps.folder";

const getFileIcon = (mime) => {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("document") || mime.includes("word")) return "📝";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("video")) return "🎥";
  if (mime.includes("audio")) return "🎵";
  return "📄";
};

const getFileExt = (mime) => {
  if (!mime) return "";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("sheet")) return "sheets";
  if (mime.includes("excel")) return "xlsx";
  if (mime.includes("document")) return "doc";
  if (mime.includes("word")) return "docx";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("image")) return "img";
  return "";
};

const guessCategoryFromPath = (path) => {
  const p = path.toLowerCase();
  if (p.includes("seguro")) return "seguros";
  if (p.includes("inversion") || p.includes("capital")) return "inversiones";
  if (p.includes("impuesto") || p.includes("fiscal") || p.includes("sat")) return "impuestos";
  if (p.includes("legal") || p.includes("notari")) return "legal";
  if (p.includes("propiedad") || p.includes("argo") || p.includes("progreso")) return "propiedades";
  return "otro";
};

// Google Drive preview URL
const getPreviewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;

// ─── Carpetas ocultas (agrega aquí las que quieras esconder) ───
const HIDDEN_FOLDERS = [
  // "nombre_carpeta_obsoleta",
  // "otra_carpeta_vieja",
];

// ─── Component ───
export const DocumentsPage = ({ documents, mob, reload, drive }) => {
  const [tab, setTab] = useState("drive");
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb] = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [files, setFiles] = useState([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [previewFile, setPreviewFile] = useState(null); // { id, name }
  const { token, gisLoaded, signIn, signOut, listAllFiles } = drive;

  // Load folder contents
  useEffect(() => {
    if (!token || tab !== "drive") return;
    const load = async () => {
      setLoadingDrive(true);
      try { const f = await listAllFiles(currentFolder); setFiles(f || []); }
      catch (e) { console.error(e); setFiles([]); }
      setLoadingDrive(false);
    };
    load();
  }, [token, currentFolder, tab]);

  // ─── Incremental sync (auto, only indexes missing folders/files) ───
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

  const runSync = async (incremental = true) => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncMsg(incremental ? "Verificando cambios..." : "Sincronización completa...");
    let totalFiles = 0, totalFolders = 0, skipped = 0;

    // Load existing indexed folder IDs for dedup
    let knownFolders = new Set();
    let knownFiles = new Set();
    if (incremental) {
      try {
        const existingFolders = await supaFetch("drive_folders", { order: "id" });
        if (existingFolders) existingFolders.forEach(f => knownFolders.add(f.google_drive_id));
        const existingDocs = await supaFetch("documents", { filters: "synced_from_drive=eq.true", order: "id" });
        if (existingDocs) existingDocs.forEach(d => knownFiles.add(d.google_drive_file_id));
      } catch (e) { console.error("Could not load existing index", e); }
      setSyncMsg(`Índice actual: ${knownFolders.size} carpetas, ${knownFiles.size} archivos. Buscando nuevos...`);
    }

    const syncFolder = async (folderId, path) => {
      const items = await listAllFiles(folderId);
      if (!items) return;
      for (const f of items) {
        if (isFolder(f)) {
          if (incremental && knownFolders.has(f.id)) {
            skipped++;
            // Still recurse into known folders to find new children
            await syncFolder(f.id, path + "/" + f.name);
          } else {
            await supaUpsert("drive_folders", { google_drive_id: f.id, name: f.name, parent_drive_id: folderId, folder_path: path + "/" + f.name });
            totalFolders++;
            knownFolders.add(f.id);
            if (totalFolders % 3 === 0) setSyncMsg(`Nuevos: ${totalFolders} carpetas, ${totalFiles} archivos...`);
            await syncFolder(f.id, path + "/" + f.name);
          }
        } else {
          if (incremental && knownFiles.has(f.id)) {
            skipped++;
          } else {
            const doc = { title: f.name, google_drive_file_id: f.id, google_drive_url: f.webViewLink, folder_path: path, parent_folder_drive_id: folderId, mime_type: f.mimeType, file_type: getFileExt(f.mimeType), category: guessCategoryFromPath(path), synced_from_drive: true, last_synced_at: new Date().toISOString() };
            const existing = await supaFetch("documents", { filters: `google_drive_file_id=eq.${f.id}` });
            if (existing && existing.length > 0) await supaUpdate("documents", existing[0].id, doc);
            else await supaInsert("documents", doc);
            totalFiles++;
            knownFiles.add(f.id);
          }
        }
      }
    };
    try {
      await syncFolder(DRIVE_ROOT_FOLDER, "APMEW");
      if (totalFolders === 0 && totalFiles === 0) {
        setSyncMsg("✓ Todo al día — no hay cambios nuevos");
      } else {
        setSyncMsg(`✓ ${totalFolders} carpetas y ${totalFiles} archivos nuevos indexados`);
        reload();
      }
    } catch (e) { console.error(e); setSyncMsg("Error: " + e.message); }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 8000);
  };

  // Auto-sync once on first connect (incremental)
  useEffect(() => {
    if (!token || syncedRef.current) return;
    syncedRef.current = true;
    runSync(true);
  }, [token]);

  const navigateToFolder = (folderId, folderName) => {
    setCurrentFolder(folderId);
    setBreadcrumb(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index) => {
    setCurrentFolder(breadcrumb[index].id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };

  // Filter hidden folders
  const allFolders = files.filter(isFolder);
  const folders = allFolders.filter(f => !HIDDEN_FOLDERS.some(h => f.name.toLowerCase() === h.toLowerCase()));
  const docs = files.filter(f => !isFolder(f));
  const currentPath = breadcrumb.map(b => b.name).join("/");

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 20px", fontFamily: "DM Sans", fontSize: 14,
      fontWeight: tab === id ? 600 : 400, color: tab === id ? C.accent : C.textDim,
      background: tab === id ? C.accentGlow : "transparent",
      border: `1px solid ${tab === id ? C.accent + "40" : C.border}`, borderRadius: 8, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Documentos</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Google Drive + índice en Supabase</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <TabBtn id="drive" label="📁 Google Drive" />
        <TabBtn id="indexed" label="🗂️ Indexados" />
        {token && <button onClick={() => runSync(false)} disabled={syncing} style={{
          fontFamily: "DM Sans", fontSize: 12, color: syncing ? C.textDim : C.blue,
          background: syncing ? C.surface2 : `${C.blue}15`, border: `1px solid ${syncing ? C.border : C.blue}40`,
          borderRadius: 8, padding: "6px 14px", cursor: syncing ? "default" : "pointer", marginLeft: 4,
        }}>{syncing ? "⏳ Sincronizando..." : "🔄 Re-sincronizar todo"}</button>}
        {syncMsg && <span style={{ fontFamily: "DM Sans", fontSize: 13, color: syncMsg.startsWith("✓") ? C.green : syncMsg.startsWith("Error") ? C.red : C.accent, marginLeft: 8 }}>{syncMsg}</span>}
      </div>

      {/* ─── Preview modal ─── */}
      {previewFile && (
        <>
          <div onClick={() => setPreviewFile(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: mob ? "2%" : "5%", left: mob ? "2%" : "10%", right: mob ? "2%" : "10%", bottom: mob ? "2%" : "5%", zIndex: 1001, display: "flex", flexDirection: "column", background: C.surface, borderRadius: 16, border: `1px solid ${C.accent}40`, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{previewFile.name}</span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <a href={`https://drive.google.com/file/d/${previewFile.id}/view`} target="_blank" rel="noopener" style={{ fontFamily: "DM Sans", fontSize: 12, color: C.blue, textDecoration: "none", padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 6 }}>Abrir en Drive ↗</a>
                <button onClick={() => setPreviewFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.close}</button>
              </div>
            </div>
            <iframe
              src={getPreviewUrl(previewFile.id)}
              style={{ flex: 1, border: "none", background: "#fff" }}
              allow="autoplay"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </>
      )}

      {tab === "drive" && (
        <div>
          {!token ? (
            <Card style={{ textAlign: "center", padding: mob ? 30 : 50 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 16, color: C.text, marginBottom: 8 }}>Conecta tu Google Drive</p>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 24 }}>Inicia sesión para navegar las carpetas de APMEW</p>
              <Btn onClick={signIn} disabled={!gisLoaded} style={{ margin: "0 auto" }}>{I.google} <span style={{ marginLeft: 6 }}>Iniciar sesión con Google</span></Btn>
            </Card>
          ) : (
            <div>
              {/* Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                {breadcrumb.map((b, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {i > 0 && <span style={{ color: C.textMuted, fontSize: 12 }}>/</span>}
                    <button onClick={() => navigateToBreadcrumb(i)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, color: i === breadcrumb.length - 1 ? C.accent : C.textDim, fontWeight: i === breadcrumb.length - 1 ? 600 : 400, padding: "2px 4px" }}>{b.name}</button>
                  </span>
                ))}
              </div>

              {/* File list */}
              <Card>
                {loadingDrive ? (
                  <div style={{ textAlign: "center", padding: 30 }}>
                    <Spinner />
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>Cargando carpeta...</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {breadcrumb.length > 1 && (
                      <button onClick={() => navigateToBreadcrumb(breadcrumb.length - 2)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {I.back}<span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>.. Regresar</span>
                      </button>
                    )}
                    {folders.map(f => (
                      <button key={f.id} onClick={() => navigateToFolder(f.id, f.name)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%", textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ color: C.accent }}>{I.folder}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: C.text, flex: 1 }}>{f.name}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted }}>Carpeta</span>
                      </button>
                    ))}
                    {docs.map(f => (
                      <button key={f.id} onClick={() => setPreviewFile({ id: f.id, name: f.name })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, textDecoration: "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 16 }}>{getFileIcon(f.mimeType)}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, flex: 1 }}>{f.name}</span>
                        <Badge color={C.blue}>{getFileExt(f.mimeType) || "file"}</Badge>
                      </button>
                    ))}
                    {folders.length === 0 && docs.length === 0 && (
                      <div style={{ textAlign: "center", padding: 30 }}>
                        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>Carpeta vacía</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>{folders.length} carpetas, {docs.length} archivos</div>
            </div>
          )}
        </div>
      )}

      {tab === "indexed" && (
        <div>
          <Card>
            {documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay documentos indexados</p>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginTop: 4 }}>Conecta Google Drive para sincronizar automáticamente</p>
              </div>
            ) : (
              <Table columns={[
                { label: "Título", key: "title", bold: true },
                { label: "Carpeta", key: "folder_path", color: () => C.textDim, render: r => r.folder_path || "—" },
                { label: "Tipo", key: "file_type", render: r => r.file_type ? <Badge color={C.blue}>{r.file_type}</Badge> : "—" },
                { label: "Ver", key: "google_drive_file_id", render: r => r.google_drive_file_id ? (
                  <button onClick={() => setPreviewFile({ id: r.google_drive_file_id, name: r.title })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.blue }}>Vista previa</button>
                ) : "—" },
              ]} data={documents} onDelete={(row) => { if (confirm("¿Eliminar del índice?")) { supaDelete("documents", row.id).then(reload); } }} mob={mob} />
            )}
          </Card>
          {documents.length > 0 && <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>{documents.length} documentos indexados</div>}
        </div>
      )}
    </div>
  );
};
