import { useState, useEffect } from "react";
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

// ─── Component ───
export const DocumentsPage = ({ documents, mob, reload, drive }) => {
  const [tab, setTab] = useState("drive");
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb] = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [files, setFiles] = useState([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

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

  const navigateToFolder = (folderId, folderName) => {
    setCurrentFolder(folderId);
    setBreadcrumb(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index) => {
    setCurrentFolder(breadcrumb[index].id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };

  const folders = files.filter(isFolder);
  const docs = files.filter(f => !isFolder(f));
  const currentPath = breadcrumb.map(b => b.name).join("/");

  // Sync current folder
  const syncToSupabase = async () => {
    setSyncing(true); setSyncMsg("Sincronizando...");
    let count = 0;
    try {
      for (const f of folders) {
        await supaUpsert("drive_folders", { google_drive_id: f.id, name: f.name, parent_drive_id: currentFolder, folder_path: currentPath + "/" + f.name });
      }
      for (const f of docs) {
        const doc = { title: f.name, google_drive_file_id: f.id, google_drive_url: f.webViewLink, folder_path: currentPath, parent_folder_drive_id: currentFolder, mime_type: f.mimeType, file_type: getFileExt(f.mimeType), category: guessCategoryFromPath(currentPath), synced_from_drive: true, last_synced_at: new Date().toISOString() };
        const existing = await supaFetch("documents", { filters: `google_drive_file_id=eq.${f.id}` });
        if (existing && existing.length > 0) await supaUpdate("documents", existing[0].id, doc);
        else await supaInsert("documents", doc);
        count++;
      }
      setSyncMsg(`✓ ${count} archivos + ${folders.length} carpetas sincronizados`);
      reload();
    } catch (e) { console.error(e); setSyncMsg("Error al sincronizar"); }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  };

  // Recursive sync
  const syncAllRecursive = async () => {
    setSyncing(true); setSyncMsg("Sincronizando todo recursivamente...");
    let totalFiles = 0, totalFolders = 0;
    const syncFolder = async (folderId, path) => {
      const items = await listAllFiles(folderId);
      if (!items) return;
      for (const f of items) {
        if (isFolder(f)) {
          await supaUpsert("drive_folders", { google_drive_id: f.id, name: f.name, parent_drive_id: folderId, folder_path: path + "/" + f.name });
          totalFolders++;
          setSyncMsg(`Sincronizando... ${totalFolders} carpetas, ${totalFiles} archivos`);
          await syncFolder(f.id, path + "/" + f.name);
        } else {
          const doc = { title: f.name, google_drive_file_id: f.id, google_drive_url: f.webViewLink, folder_path: path, parent_folder_drive_id: folderId, mime_type: f.mimeType, file_type: getFileExt(f.mimeType), category: guessCategoryFromPath(path), synced_from_drive: true, last_synced_at: new Date().toISOString() };
          const existing = await supaFetch("documents", { filters: `google_drive_file_id=eq.${f.id}` });
          if (existing && existing.length > 0) await supaUpdate("documents", existing[0].id, doc);
          else await supaInsert("documents", doc);
          totalFiles++;
          setSyncMsg(`Sincronizando... ${totalFolders} carpetas, ${totalFiles} archivos`);
        }
      }
    };
    try {
      await syncFolder(DRIVE_ROOT_FOLDER, "APMEW");
      setSyncMsg(`✓ Completo: ${totalFolders} carpetas, ${totalFiles} archivos`);
      reload();
    } catch (e) { console.error(e); setSyncMsg("Error: " + e.message); }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 6000);
  };

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

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <TabBtn id="drive" label="📁 Google Drive" />
        <TabBtn id="indexed" label="🗂️ Indexados en Supabase" />
      </div>

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
              {/* Toolbar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
                <Btn onClick={syncToSupabase} disabled={syncing} small>{syncing ? <Spinner /> : I.sync} Sync esta carpeta</Btn>
                <Btn onClick={syncAllRecursive} disabled={syncing} small outline>{syncing ? <Spinner /> : I.sync} Sync TODO recursivo</Btn>
                <Btn onClick={signOut} small outline style={{ marginLeft: "auto" }}>Desconectar</Btn>
                {syncMsg && <span style={{ fontFamily: "DM Sans", fontSize: 13, color: syncMsg.startsWith("✓") ? C.green : syncMsg.startsWith("Error") ? C.red : C.accent }}>{syncMsg}</span>}
              </div>

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
                      <a key={f.id} href={f.webViewLink} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, textDecoration: "none", width: "100%" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 16 }}>{getFileIcon(f.mimeType)}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, flex: 1 }}>{f.name}</span>
                        <Badge color={C.blue}>{getFileExt(f.mimeType) || "file"}</Badge>
                      </a>
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
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginTop: 4 }}>Usa la pestaña Google Drive → Sync para indexar</p>
              </div>
            ) : (
              <Table columns={[
                { label: "Título", key: "title", bold: true },
                { label: "Carpeta", key: "folder_path", color: () => C.textDim, render: r => r.folder_path || "—" },
                { label: "Tipo", key: "file_type", render: r => r.file_type ? <Badge color={C.blue}>{r.file_type}</Badge> : "—" },
                { label: "Link", key: "google_drive_url", render: r => r.google_drive_url ? <a href={r.google_drive_url} target="_blank" rel="noopener" style={{ color: C.blue, textDecoration: "none", fontSize: 13 }}>Abrir ↗</a> : "—" },
              ]} data={documents} onDelete={(row) => { if (confirm("¿Eliminar del índice?")) { supaDelete("documents", row.id).then(reload); } }} mob={mob} />
            )}
          </Card>
          {documents.length > 0 && <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>{documents.length} documentos indexados</div>}
        </div>
      )}
    </div>
  );
};
