// ═══════════════════════════════════════════
// Archivo: src/pages/DocumentsPage.jsx
// Versión: V3
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - Tab default cambia a "indexed": la página abre sin pedir Drive
// - Menú hamburguesa a la izquierda del título "Documentos"
// - Items del menú: "Búsqueda" y "Subir documento"
// - Dropdown cierra al hacer click fuera
// - Panel "Subir documento" pide conectar Drive solo si no hay sesión
// CAMBIOS EN V2:
// - Agregado panel de estadísticas del índice
// - Muestra: carpetas indexadas, archivos indexados, última sincronización
// - Botón de "Verificar Salud del Índice" con detalles
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { getFileIcon, getFileExt, isFolder } from "../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaUpdate, supaInsert, supaDelete, supaUpsert } from "../lib/supabase";
import { Card, Badge, Btn, Spinner, Table } from "../components/UI";
import { FilePreviewModal } from "../components/FilePreviewModal";

// ─── Helpers ───
const guessCategoryFromPath = (path) => {
  const p = path.toLowerCase();
  if (p.includes("seguro")) return "seguros";
  if (p.includes("inversion") || p.includes("capital")) return "inversiones";
  if (p.includes("impuesto") || p.includes("fiscal") || p.includes("sat")) return "impuestos";
  if (p.includes("legal") || p.includes("notari")) return "legal";
  if (p.includes("propiedad") || p.includes("argo") || p.includes("progreso")) return "propiedades";
  return "otro";
};

// ─── Carpetas ocultas (agrega aquí las que quieras esconder) ───
const HIDDEN_FOLDERS = [];

// ─── Component ───
export const DocumentsPage = ({ documents, mob, reload, drive }) => {
  const [tab, setTab] = useState("indexed"); // ← V3: abre en Indexados, no requiere Drive
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb] = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [files, setFiles] = useState([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [indexStats, setIndexStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);    // ← V3: hamburguesa
  const [showSearch, setShowSearch] = useState(false);    // ← V3: panel búsqueda
  const [showUpload, setShowUpload] = useState(false);    // ← V3: panel subir doc
  const menuRef = useRef(null);                           // ← V3: click-fuera
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
  }, [token, currentFolder, tab, listAllFiles]);

  // ─── NUEVO: Cargar estadísticas del índice ───
  const loadIndexStats = async () => {
    try {
      const [folders, docs] = await Promise.all([
        supaFetch("drive_folders", { order: "id" }),
        supaFetch("documents", { filters: "synced_from_drive=eq.true", order: "id" })
      ]);

      // Calcular estadísticas por carpeta
      const byFolder = {};
      docs.forEach(d => {
        const folder = d.folder_path || "Sin carpeta";
        byFolder[folder] = (byFolder[folder] || 0) + 1;
      });

      // Detectar carpetas importantes
      const inspections = folders.filter(f => f.folder_path?.includes("INSPECCION")).length;
      const gastos = folders.filter(f => f.folder_path?.includes("GASTO")).length;

      setIndexStats({
        totalFolders: folders.length,
        totalDocs: docs.length,
        inspections,
        gastos,
        byFolder,
        lastCheck: new Date().toLocaleString("es-MX")
      });
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  };

  // Cargar stats cuando se conecta Drive
  useEffect(() => {
    if (token) loadIndexStats();
  }, [token]);

  // ─── V3: Cerrar menú hamburguesa al hacer click fuera ───
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // ─── Incremental sync ───
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

  const runSync = async (incremental = true) => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncMsg(incremental ? "Verificando cambios..." : "Sincronización completa...");
    let totalFiles = 0, totalFolders = 0, skipped = 0;

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
            const doc = {
              title: f.name, google_drive_file_id: f.id,
              google_drive_url: f.webViewLink, folder_path: path,
              parent_folder_drive_id: folderId, mime_type: f.mimeType,
              file_type: getFileExt(f.mimeType), category: guessCategoryFromPath(path),
              synced_from_drive: true, last_synced_at: new Date().toISOString(),
            };
            try {
              await supaUpsert("documents", doc);
            } catch (e) {
              const existing = await supaFetch("documents", { filters: `google_drive_file_id=eq.${f.id}` });
              if (existing && existing.length > 0) await supaUpdate("documents", existing[0].id, doc);
              else await supaInsert("documents", doc);
            }
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
        loadIndexStats(); // ← NUEVO: Recargar stats después de sync
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

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 20px", fontFamily: "DM Sans", fontSize: 14,
      fontWeight: tab === id ? 600 : 400, color: tab === id ? C.accent : C.textDim,
      background: tab === id ? C.accentGlow : "transparent",
      border: `1px solid ${tab === id ? C.accent + "40" : C.border}`, borderRadius: 8, cursor: "pointer",
    }}>{label}</button>
  );

  // ─── V3: Item del menú hamburguesa ───
  const MenuItem = ({ icon, label, onClick }) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "11px 16px",
      background: "transparent", border: "none", cursor: "pointer",
      fontFamily: "DM Sans", fontSize: 14, color: C.text, textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div>
      {/* ─── V3: Header con hamburguesa ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            title="Menú documentos"
            style={{
              background: menuOpen ? C.accentGlow : "transparent",
              border: `1px solid ${menuOpen ? C.accent + "40" : C.border}`,
              borderRadius: 8, padding: "5px 7px", cursor: "pointer",
              color: menuOpen ? C.accent : C.textDim,
              display: "flex", alignItems: "center", transition: "all 0.15s",
            }}
          >
            {I.menu}
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              zIndex: 200, minWidth: 190, overflow: "hidden",
            }}>
              <div style={{ padding: "8px 16px 6px", fontFamily: "DM Sans", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Documentos
              </div>
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <MenuItem icon="🔍" label="Búsqueda"
                  onClick={() => { setShowSearch(v => !v); setShowUpload(false); setMenuOpen(false); }} />
                <MenuItem icon="⬆️" label="Subir documento"
                  onClick={() => { setShowUpload(v => !v); setShowSearch(false); setMenuOpen(false); }} />
              </div>
            </div>
          )}
        </div>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0 }}>Documentos</h1>
      </div>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Google Drive + índice en Supabase</p>

      {/* ─── V3: Panel Búsqueda ─── */}
      {showSearch && (
        <div style={{ marginBottom: 16, padding: 16, background: C.surface, border: `1px solid ${C.accent}30`, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>🔍 Búsqueda de documentos</span>
            <button onClick={() => setShowSearch(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim }}>{I.close}</button>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, margin: 0 }}>Próximamente — búsqueda por nombre, tipo y carpeta.</p>
        </div>
      )}

      {/* ─── V3: Panel Subir documento ─── */}
      {showUpload && (
        <div style={{ marginBottom: 16, padding: 16, background: C.surface, border: `1px solid ${C.accent}30`, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>⬆️ Subir documento</span>
            <button onClick={() => setShowUpload(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim }}>{I.close}</button>
          </div>
          {!token ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, margin: 0 }}>Necesitas conectar Google Drive para subir documentos.</p>
              <Btn onClick={signIn} disabled={!gisLoaded}>{I.google} <span style={{ marginLeft: 6 }}>Conectar Google Drive</span></Btn>
            </div>
          ) : (
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, margin: 0 }}>Próximamente — subida de documentos a Google Drive.</p>
          )}
        </div>
      )}

      {/* ─── NUEVO: Panel de Estadísticas del Índice ─── */}
      {token && indexStats && (
        <Card style={{ marginBottom: 16, background: `${C.accent}05`, border: `1px solid ${C.accent}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>
              📊 Estado del Índice
            </div>
            <button 
              onClick={() => setShowStats(!showStats)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "DM Sans",
                fontSize: 11,
                color: C.accent,
                textDecoration: "underline",
              }}
            >
              {showStats ? "Ocultar detalles" : "Ver detalles"}
            </button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 2 }}>Carpetas</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, color: C.accent }}>
                {indexStats.totalFolders}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 2 }}>Archivos</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, color: C.green }}>
                {indexStats.totalDocs}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 2 }}>Inspecciones</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, color: C.blue }}>
                {indexStats.inspections}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 2 }}>Gastos</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, color: C.orange || "#F59E0B" }}>
                {indexStats.gastos}
              </div>
            </div>
          </div>

          {showStats && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>
                Última verificación: {indexStats.lastCheck}
              </div>
              <button
                onClick={loadIndexStats}
                style={{
                  background: `${C.blue}15`,
                  border: `1px solid ${C.blue}40`,
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontFamily: "DM Sans",
                  fontSize: 11,
                  color: C.blue,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                🔄 Actualizar estadísticas
              </button>
            </div>
          )}
        </Card>
      )}

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
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />

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
