// ═══════════════════════════════════════════
// Archivo: src/pages/DocumentsPage.jsx
// Versión: V7
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V7:
// - Fix API: verifica resp.ok antes de parsear, muestra error real
// - Fix modelo: usa claude-haiku-4-5-20251001 (más rápido y disponible)
// - Fix JSON: si la IA no devuelve JSON válido, muestra el texto igual
// CAMBIOS EN V6:
// - Fix análisis IA: agrega x-api-key, anthropic-version y anthropic-dangerous-allow-browser
// - Tree view: primer nivel (depth=0) abre, resto cerrado
// - Prompt IA mejorado con contexto de casas, bancos, coches, empresas, seguros
// CAMBIOS EN V5:
// - Tree view: todos los directorios inician cerrados
// - Modal subir: IA lee el PDF/imagen y sugiere carpeta de Google Drive
// CAMBIOS EN V4:
// - Fix hamburguesa: backdrop transparente en lugar de listener mousedown (más confiable)
// - Performance: elimina auto-sync al conectar Drive (solo sync manual)
// - Lupa de búsqueda en header (derecha del título), filtra docs indexados en tiempo real
// - Tree view en tab "Indexados": árbol expand/collapse construido desde folder_path
// - Modal "Subir documento": overlay con zona drag & drop en colores de la app
// CAMBIOS EN V3:
// - Tab default "indexed", sin pedir Drive al entrar
// - Menú hamburguesa a la izquierda del título
// CAMBIOS EN V2:
// - Panel de estadísticas del índice
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { getFileIcon, getFileExt, isFolder } from "../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaUpdate, supaInsert, supaUpsert } from "../lib/supabase";
import { Card, Badge, Btn, Spinner } from "../components/UI";
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

const HIDDEN_FOLDERS = [];

// ─── Construir árbol desde folder_path ───
const buildTree = (docs) => {
  const root = { children: {}, files: [] };
  docs.forEach(doc => {
    const parts = (doc.folder_path || "").split("/").filter(Boolean);
    let node = root;
    parts.forEach(part => {
      if (!node.children[part]) node.children[part] = { children: {}, files: [] };
      node = node.children[part];
    });
    node.files.push(doc);
  });
  return root;
};

// ─── Nodo del árbol ───
const TreeNode = ({ name, node, depth, onPreview, searchQuery }) => {
  const hasChildren = Object.keys(node.children).length > 0;
  const hasFiles    = node.files.length > 0;
  const [open, setOpen] = useState(depth === 0); // V6: primer nivel abierto, resto cerrado

  useEffect(() => {
    if (searchQuery) setOpen(true);
  }, [searchQuery]);

  const childKeys = Object.keys(node.children).sort();
  const indent    = depth * 16;

  return (
    <div>
      {name && (
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: `6px 14px 6px ${14 + indent}px`,
            background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surface2}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: C.textDim, fontSize: 10, width: 12, flexShrink: 0 }}>
            {(hasChildren || hasFiles) ? (open ? "▼" : "▶") : ""}
          </span>
          <span style={{ color: C.accent, flexShrink: 0 }}>{I.folder}</span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{name}</span>
          {hasFiles && (
            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>{node.files.length}</span>
          )}
        </button>
      )}
      {(open || !name) && (
        <>
          {childKeys.map(key => (
            <TreeNode
              key={key} name={key} node={node.children[key]}
              depth={name ? depth + 1 : depth}
              onPreview={onPreview} searchQuery={searchQuery}
            />
          ))}
          {open && node.files.map(f => (
            <button
              key={f.id}
              onClick={() => f.google_drive_file_id && onPreview({ id: f.google_drive_file_id, name: f.title })}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: `5px 14px 5px ${14 + (name ? (depth + 1) * 16 + 18 : 18)}px`,
                background: "transparent", border: "none",
                cursor: f.google_drive_file_id ? "pointer" : "default", textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 14 }}>{getFileIcon(f.mime_type)}</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1 }}>{f.title}</span>
              {f.file_type && <Badge color={C.blue}>{f.file_type}</Badge>}
            </button>
          ))}
        </>
      )}
    </div>
  );
};

// ─── Modal Subir Documento (con sugerencia IA) ───
const UploadModal = ({ onClose, token, signIn, gisLoaded, folderPaths }) => {
  const [dragging, setDragging]     = useState(false);
  const [file, setFile]             = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);   // { path, reason }
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  };

  const selectFile = async (f) => {
    setFile(f);
    setAiSuggestion(null);
    setAiError(null);
    // Solo analizar si hay token (ya conectado a Drive)
    if (!token) return;
    await analyzeFile(f);
  };

  const analyzeFile = async (f) => {
    setAiLoading(true);
    try {
      // Convertir a base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });

      const isPdf   = f.type === "application/pdf";
      const isImage = f.type.startsWith("image/");
      if (!isPdf && !isImage) {
        setAiSuggestion({ path: null, reason: "Solo puedo analizar PDFs e imágenes para sugerir carpeta." });
        setAiLoading(false);
        return;
      }

      const folderList = folderPaths.slice(0, 120).join("\n");

      const messages = [{
        role: "user",
        content: [
          isPdf
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
            : { type: "image",    source: { type: "base64", media_type: f.type, data: base64 } },
          {
            type: "text",
            text: `Eres un asistente de organización de documentos para una familia mexicana llamada APMEW (Esteva Wurts).
Analiza este documento e indica en cuál de las carpetas de Google Drive debería guardarse.

CONTEXTO: Los documentos pueden pertenecer a:
- Propiedades / casas (recibos de luz, gas, agua, predial, mantenimiento de cada propiedad)
- Cuentas bancarias y tarjetas (estados de cuenta, comprobantes)
- Coches / vehículos (facturas, seguros, tenencia, servicios)
- Empresas (facturas, contratos, estados financieros de LLC, ARGO, MNA WORKS, etc.)
- Seguros (pólizas, recibos de seguros de vida, gastos médicos, casa, auto)
- Inversiones (AFORE, annuities, BlackStone, EB5, etc.)
- Impuestos / SAT (declaraciones, facturas CFDI, comprobantes fiscales)
- Legal / notarial (escrituras, testamentos, poderes notariales)
- Personal (identificaciones, pasaportes, documentos personales de cada miembro)

CARPETAS DISPONIBLES EN GOOGLE DRIVE:
${folderList}

Analiza el documento y responde SOLO con JSON sin markdown:
{"path": "APMEW/CARPETA/SUBCARPETA", "reason": "Explicación breve en español: qué es el documento y por qué va en esa carpeta"}`
          }
        ]
      }];

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-allow-browser": "true",
        },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, messages }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = data?.error?.message || `HTTP ${resp.status}`;
        setAiError(`Error API: ${msg}`);
        setAiLoading(false);
        return;
      }
      const text = data.content?.find(b => b.type === "text")?.text || "";
      if (!text) { setAiError("La IA no devolvió respuesta."); setAiLoading(false); return; }
      const clean = text.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        setAiSuggestion(parsed);
      } catch {
        // Si no devuelve JSON válido, mostrar la respuesta como texto
        setAiSuggestion({ path: null, reason: text });
      }
    } catch (e) {
      console.error("AI suggestion error:", e);
      setAiError("No se pudo analizar el documento.");
    }
    setAiLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, width: "100%", maxWidth: 480,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, color: C.text }}>Subir Documento</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 20, padding: "2px 6px" }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {!token ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 16 }}>
                Conecta Google Drive para subir documentos
              </p>
              <Btn onClick={signIn} disabled={!gisLoaded}>
                {I.google} <span style={{ marginLeft: 6 }}>Conectar Google Drive</span>
              </Btn>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, margin: 0, textAlign: "center" }}>
                Sube el PDF o archivo — la IA sugerirá dónde guardarlo
              </p>

              {/* Zona drag & drop */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("doc-file-input").click()}
                style={{
                  border: `2px dashed ${dragging ? C.accent : C.border}`,
                  borderRadius: 12,
                  background: dragging ? `${C.accent}12` : `${C.accent}06`,
                  padding: "32px 20px", textAlign: "center", cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <input
                  id="doc-file-input" type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  style={{ display: "none" }}
                  onChange={e => e.target.files[0] && selectFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
                    <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.accent, margin: 0 }}>{file.name}</p>
                    <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, margin: "4px 0 0" }}>{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 34, marginBottom: 10 }}>📁</div>
                    <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.accent, margin: "0 0 4px" }}>
                      Arrastra · Haz clic · Pega (Ctrl+V)
                    </p>
                    <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, margin: 0 }}>
                      PDF, imagen o archivo desde cualquier fuente
                    </p>
                  </div>
                )}
              </div>

              {/* Sugerencia IA */}
              {aiLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: `${C.accent}08`, border: `1px solid ${C.accent}25`, borderRadius: 10 }}>
                  <span style={{ fontSize: 18, animation: "spin 1s linear infinite" }}>🔍</span>
                  <div>
                    <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Analizando documento...</div>
                    <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>La IA está leyendo el contenido para sugerir carpeta</div>
                  </div>
                </div>
              )}
              {aiSuggestion && !aiLoading && (
                <div style={{ padding: "14px 16px", background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>🤖</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: C.green }}>Sugerencia de carpeta</span>
                  </div>
                  {aiSuggestion.path && (
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.accent, background: `${C.accent}10`, borderRadius: 6, padding: "6px 10px", marginBottom: 8, wordBreak: "break-all" }}>
                      📂 {aiSuggestion.path}
                    </div>
                  )}
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{aiSuggestion.reason}</div>
                </div>
              )}
              {aiError && !aiLoading && (
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, padding: "8px 12px", background: C.surface2, borderRadius: 8 }}>
                  ⚠️ {aiError}
                </div>
              )}

              {file && !aiLoading && (
                <Btn style={{ width: "100%", justifyContent: "center" }}>
                  ⬆️ Subir a Google Drive
                </Btn>
              )}
            </>
          )}

          {/* Registrar sin archivo */}
          <button
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              background: `${C.blue}10`, border: `1px solid ${C.blue}30`,
              borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left",
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${C.blue}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${C.blue}10`}
          >
            <span style={{ fontSize: 20 }}>📝</span>
            <div>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.blue }}>Registrar sin archivo</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Captura los datos manualmente</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export const DocumentsPage = ({ documents, mob, reload, drive }) => {
  const [tab, setTab]                   = useState("indexed");
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb]     = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [files, setFiles]               = useState([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [syncMsg, setSyncMsg]           = useState("");
  const [previewFile, setPreviewFile]   = useState(null);
  const [indexStats, setIndexStats]     = useState(null);
  const [showStats, setShowStats]       = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchQuery, setSearchQuery]   = useState("");
  const [syncing, setSyncing]           = useState(false);
  const searchInputRef                  = useRef(null);
  const { token, gisLoaded, signIn, signOut, listAllFiles } = drive;

  // ─── Cargar carpeta Drive ───
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

  // ─── Stats (solo bajo demanda, no auto) ───
  const loadIndexStats = useCallback(async () => {
    try {
      const [folders, docs] = await Promise.all([
        supaFetch("drive_folders", { order: "id" }),
        supaFetch("documents", { filters: "synced_from_drive=eq.true", order: "id" })
      ]);
      const inspections = folders.filter(f => f.folder_path?.includes("INSPECCION")).length;
      const gastos      = folders.filter(f => f.folder_path?.includes("GASTO")).length;
      setIndexStats({
        totalFolders: folders.length, totalDocs: docs.length,
        inspections, gastos, lastCheck: new Date().toLocaleString("es-MX")
      });
    } catch (e) { console.error(e); }
  }, []);

  // ─── Sync manual ───
  const runSync = async (incremental = true) => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncMsg(incremental ? "Verificando cambios..." : "Sincronización completa...");
    let totalFiles = 0, totalFolders = 0;
    let knownFolders = new Set(), knownFiles = new Set();

    if (incremental) {
      try {
        const ef = await supaFetch("drive_folders", { order: "id" });
        if (ef) ef.forEach(f => knownFolders.add(f.google_drive_id));
        const ed = await supaFetch("documents", { filters: "synced_from_drive=eq.true", order: "id" });
        if (ed) ed.forEach(d => knownFiles.add(d.google_drive_file_id));
      } catch (e) { console.error(e); }
      setSyncMsg(`Índice: ${knownFolders.size} carpetas, ${knownFiles.size} archivos. Buscando nuevos...`);
    }

    const syncFolder = async (folderId, path) => {
      const items = await listAllFiles(folderId);
      if (!items) return;
      for (const f of items) {
        if (isFolder(f)) {
          if (!(incremental && knownFolders.has(f.id))) {
            await supaUpsert("drive_folders", { google_drive_id: f.id, name: f.name, parent_drive_id: folderId, folder_path: path + "/" + f.name });
            totalFolders++;
            knownFolders.add(f.id);
            if (totalFolders % 3 === 0) setSyncMsg(`Nuevos: ${totalFolders} carpetas, ${totalFiles} archivos...`);
          }
          await syncFolder(f.id, path + "/" + f.name);
        } else if (!(incremental && knownFiles.has(f.id))) {
          const doc = {
            title: f.name, google_drive_file_id: f.id,
            google_drive_url: f.webViewLink, folder_path: path,
            parent_folder_drive_id: folderId, mime_type: f.mimeType,
            file_type: getFileExt(f.mimeType), category: guessCategoryFromPath(path),
            synced_from_drive: true, last_synced_at: new Date().toISOString(),
          };
          try { await supaUpsert("documents", doc); }
          catch (e) {
            const ex = await supaFetch("documents", { filters: `google_drive_file_id=eq.${f.id}` });
            if (ex?.length > 0) await supaUpdate("documents", ex[0].id, doc);
            else await supaInsert("documents", doc);
          }
          totalFiles++;
          knownFiles.add(f.id);
        }
      }
    };

    try {
      await syncFolder(DRIVE_ROOT_FOLDER, "APMEW");
      setSyncMsg(totalFolders === 0 && totalFiles === 0
        ? "✓ Todo al día — no hay cambios nuevos"
        : `✓ ${totalFolders} carpetas y ${totalFiles} archivos nuevos`
      );
      if (totalFiles > 0) reload();
    } catch (e) { setSyncMsg("Error: " + e.message); }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 8000);
  };

  // ─── Enfocar input al abrir búsqueda ───
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearchQuery("");
  }, [searchOpen]);

  const navigateToFolder    = (id, name) => { setCurrentFolder(id); setBreadcrumb(prev => [...prev, { id, name }]); };
  const navigateToBreadcrumb = (i) => { setCurrentFolder(breadcrumb[i].id); setBreadcrumb(breadcrumb.slice(0, i + 1)); };

  const allFolders    = files.filter(isFolder);
  const folders       = allFolders.filter(f => !HIDDEN_FOLDERS.some(h => f.name.toLowerCase() === h.toLowerCase()));
  const driveDocs     = files.filter(f => !isFolder(f));
  const q             = searchQuery.toLowerCase().trim();
  const filteredDocs  = q
    ? documents.filter(d => d.title?.toLowerCase().includes(q) || d.folder_path?.toLowerCase().includes(q) || d.file_type?.toLowerCase().includes(q))
    : documents;
  const tree = buildTree(filteredDocs);

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 20px", fontFamily: "DM Sans", fontSize: 14,
      fontWeight: tab === id ? 600 : 400, color: tab === id ? C.accent : C.textDim,
      background: tab === id ? C.accentGlow : "transparent",
      border: `1px solid ${tab === id ? C.accent + "40" : C.border}`,
      borderRadius: 8, cursor: "pointer",
    }}>{label}</button>
  );

  const MenuItem = ({ icon, label, onClick: h }) => (
    <button onClick={h} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "11px 16px", background: "transparent", border: "none",
      cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, color: C.text, textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div>
      {/* ─── Modales ─── */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} token={token} signIn={signIn} gisLoaded={gisLoaded} folderPaths={documents.map(d => d.folder_path).filter(Boolean).filter((v,i,a) => a.indexOf(v)===i).sort()} />}

      {/* ─── V4: Backdrop hamburguesa ─── */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(false)} />
      )}

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>

        {/* Hamburguesa */}
        <div style={{ position: "relative", zIndex: 200 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              background: menuOpen ? C.accentGlow : "transparent",
              border: `1px solid ${menuOpen ? C.accent + "40" : C.border}`,
              borderRadius: 8, padding: "5px 7px", cursor: "pointer",
              color: menuOpen ? C.accent : C.textDim,
              display: "flex", alignItems: "center", transition: "all 0.15s",
            }}
          >{I.menu}</button>
          {menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
              zIndex: 200, minWidth: 190, overflow: "hidden",
            }}>
              <div style={{ padding: "8px 16px 6px", fontFamily: "DM Sans", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Documentos
              </div>
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <MenuItem icon="⬆️" label="Subir documento"
                  onClick={() => { setShowUpload(true); setMenuOpen(false); }} />
              </div>
            </div>
          )}
        </div>

        {/* Título */}
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>
          Documentos
        </h1>

        {/* V4: Lupa */}
        <button
          onClick={() => setSearchOpen(v => !v)}
          title="Buscar documentos"
          style={{
            background: searchOpen ? C.accentGlow : "transparent",
            border: `1px solid ${searchOpen ? C.accent + "40" : C.border}`,
            borderRadius: 8, padding: "5px 8px", cursor: "pointer",
            color: searchOpen ? C.accent : C.textDim,
            display: "flex", alignItems: "center", transition: "all 0.15s",
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </button>
      </div>

      {/* V4: Input de búsqueda */}
      {searchOpen && (
        <div style={{ marginBottom: 12 }}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, carpeta o tipo..."
            style={{
              width: "100%", boxSizing: "border-box", padding: "9px 14px",
              background: C.surface, border: `1px solid ${C.accent}50`,
              borderRadius: 8, outline: "none",
              fontFamily: "DM Sans", fontSize: 14, color: C.text,
            }}
            onKeyDown={e => { if (e.key === "Escape") setSearchOpen(false); }}
          />
          {q && (
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 4 }}>
              {filteredDocs.length} resultado{filteredDocs.length !== 1 ? "s" : ""} para "{searchQuery}"
            </div>
          )}
        </div>
      )}

      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 16 }}>
        Google Drive + índice en Supabase
      </p>

      {/* ─── Stats ─── */}
      {token && indexStats && (
        <Card style={{ marginBottom: 16, background: `${C.accent}05`, border: `1px solid ${C.accent}30` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>📊 Estado del Índice</div>
            <button onClick={() => setShowStats(!showStats)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 11, color: C.accent, textDecoration: "underline" }}>
              {showStats ? "Ocultar" : "Ver detalles"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Carpetas",     value: indexStats.totalFolders, color: C.accent },
              { label: "Archivos",     value: indexStats.totalDocs,    color: C.green },
              { label: "Inspecciones", value: indexStats.inspections,  color: C.blue },
              { label: "Gastos",       value: indexStats.gastos,       color: "#F59E0B" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 600, color }}>{value}</div>
              </div>
            ))}
          </div>
          {showStats && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Última verificación: {indexStats.lastCheck}</div>
              <button onClick={loadIndexStats} style={{ marginTop: 6, background: `${C.blue}15`, border: `1px solid ${C.blue}40`, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: "DM Sans", fontSize: 11, color: C.blue, fontWeight: 600 }}>
                🔄 Actualizar estadísticas
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ─── Tabs ─── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <TabBtn id="indexed" label="🗂️ Indexados" />
        <TabBtn id="drive"   label="📁 Google Drive" />
        {token && (
          <button onClick={() => runSync(false)} disabled={syncing} style={{
            fontFamily: "DM Sans", fontSize: 12,
            color: syncing ? C.textDim : C.blue,
            background: syncing ? C.surface2 : `${C.blue}15`,
            border: `1px solid ${syncing ? C.border : C.blue}40`,
            borderRadius: 8, padding: "6px 14px",
            cursor: syncing ? "default" : "pointer", marginLeft: 4,
          }}>
            {syncing ? "⏳ Sincronizando..." : "🔄 Re-sincronizar"}
          </button>
        )}
        {syncMsg && (
          <span style={{ fontFamily: "DM Sans", fontSize: 13, marginLeft: 8, color: syncMsg.startsWith("✓") ? C.green : syncMsg.startsWith("Error") ? C.red : C.accent }}>
            {syncMsg}
          </span>
        )}
      </div>

      {/* ─── Tab: Indexados (Tree View) ─── */}
      {tab === "indexed" && (
        <div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {filteredDocs.length === 0 ? (
              <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>
                  {q ? `Sin resultados para "${searchQuery}"` : "Aún no hay documentos indexados"}
                </p>
                {!q && <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginTop: 4 }}>Conecta Google Drive y usa Re-sincronizar</p>}
              </div>
            ) : (
              <div style={{ paddingTop: 6, paddingBottom: 6 }}>
                <TreeNode name={null} node={tree} depth={0} onPreview={setPreviewFile} searchQuery={q} />
              </div>
            )}
          </Card>
          {filteredDocs.length > 0 && (
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              {filteredDocs.length} documentos indexados
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Google Drive ─── */}
      {tab === "drive" && (
        <div>
          {!token ? (
            <Card style={{ textAlign: "center", padding: mob ? 30 : 50 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 16, color: C.text, marginBottom: 8 }}>Conecta tu Google Drive</p>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 24 }}>Inicia sesión para navegar las carpetas de APMEW</p>
              <Btn onClick={signIn} disabled={!gisLoaded} style={{ margin: "0 auto" }}>
                {I.google} <span style={{ marginLeft: 6 }}>Iniciar sesión con Google</span>
              </Btn>
            </Card>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                {breadcrumb.map((b, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {i > 0 && <span style={{ color: C.textMuted, fontSize: 12 }}>/</span>}
                    <button onClick={() => navigateToBreadcrumb(i)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "DM Sans", fontSize: 13, padding: "2px 4px",
                      color: i === breadcrumb.length - 1 ? C.accent : C.textDim,
                      fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    }}>{b.name}</button>
                  </span>
                ))}
              </div>
              <Card>
                {loadingDrive ? (
                  <div style={{ textAlign: "center", padding: 30 }}>
                    <Spinner />
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>Cargando carpeta...</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {breadcrumb.length > 1 && (
                      <button onClick={() => navigateToBreadcrumb(breadcrumb.length - 2)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {I.back}<span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>.. Regresar</span>
                      </button>
                    )}
                    {folders.map(f => (
                      <button key={f.id} onClick={() => navigateToFolder(f.id, f.name)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%", textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ color: C.accent }}>{I.folder}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: C.text, flex: 1 }}>{f.name}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted }}>Carpeta</span>
                      </button>
                    ))}
                    {driveDocs.map(f => (
                      <button key={f.id} onClick={() => setPreviewFile({ id: f.id, name: f.name })}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 16 }}>{getFileIcon(f.mimeType)}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, flex: 1 }}>{f.name}</span>
                        <Badge color={C.blue}>{getFileExt(f.mimeType) || "file"}</Badge>
                      </button>
                    ))}
                    {folders.length === 0 && driveDocs.length === 0 && (
                      <div style={{ textAlign: "center", padding: 30 }}>
                        <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>Carpeta vacía</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                {folders.length} carpetas, {driveDocs.length} archivos
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
