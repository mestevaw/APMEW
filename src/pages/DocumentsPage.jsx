// ═══════════════════════════════════════════
// Archivo: src/pages/DocumentsPage.jsx
// Versión: V21
// Fecha: 2026-03-17
// ═══════════════════════════════════════════
// CAMBIOS EN V21:
// - Al entrar con Drive conectado, muestra carpetas raíz inmediatamente
// - Búsqueda en tiempo real con debounce 400ms superpone los resultados
//   sobre las carpetas raíz mientras el usuario escribe
// - Vaciar la búsqueda regresa a la vista de carpetas raíz
// - Lupa y botón Subir en el header
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { getFileIcon, isFolder } from "../lib/helpers";
import { Card, Btn, Spinner } from "../components/UI";
import { FilePreviewModal } from "../components/FilePreviewModal";
import { DRIVE_ROOT_FOLDER } from "../lib/config";

const isGoogleDoc = (mime) => mime?.includes("google-apps") && !mime?.includes("folder");

const FileRow = ({ file, onPreview }) => {
  const isDoc = isGoogleDoc(file.mimeType);
  const handleClick = () => {
    if (isDoc) window.open(file.webViewLink, "_blank");
    else if (file.webViewLink) onPreview(file);
  };
  return (
    <button onClick={handleClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "8px 14px",
      background: "transparent", border: "none",
      cursor: (isDoc || file.webViewLink) ? "pointer" : "default",
      textAlign: "left", borderBottom: `1px solid ${C.border}08`,
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{getFileIcon(file.mimeType)}</span>
      <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {file.name}
      </span>
      {file.modifiedTime && (
        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
          {new Date(file.modifiedTime).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "2-digit" })}
        </span>
      )}
    </button>
  );
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export const DocumentsPage = ({ documents, mob, reload, drive }) => {
  // ── Root folder browse ──
  const [rootFiles, setRootFiles]     = useState([]);
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb]   = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [folderFiles, setFolderFiles] = useState([]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // ── Search ──
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);

  const [previewFile, setPreviewFile] = useState(null);
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  const { token, gisLoaded, signIn, listAllFiles, searchFiles } = drive;

  // ── Cargar carpeta actual (navegación) ───────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setLoadingFolder(true);
    listAllFiles(currentFolder)
      .then(f => setFolderFiles(f || []))
      .catch(e => { console.error(e); setFolderFiles([]); })
      .finally(() => setLoadingFolder(false));
  }, [token, currentFolder, listAllFiles]);

  // ── Búsqueda con debounce 400ms ──────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !token) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const res = await searchFiles(q.trim());
      setResults(res || []);
    } catch (e) { console.error(e); setResults([]); }
    setSearching(false);
    setSearched(true);
  }, [token, searchFiles]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearched(false); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const navigateTo    = (id, name) => { setCurrentFolder(id); setBreadcrumb(prev => [...prev, { id, name }]); };
  const navigateCrumb = (i)        => { setCurrentFolder(breadcrumb[i].id); setBreadcrumb(b => b.slice(0, i + 1)); };

  const folders    = folderFiles.filter(isFolder);
  const fileItems  = folderFiles.filter(f => !isFolder(f));
  const isSearching = query.trim().length > 0;

  return (
    <div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>
          Documentos
        </h1>

        {/* Lupa */}
        {token && (
          <button
            onClick={() => inputRef.current?.focus()}
            title="Buscar"
            style={{
              display: "flex", alignItems: "center", padding: "7px 9px",
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 8, cursor: "pointer", color: C.textDim,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent + "60"; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        )}

        {/* Subir */}
        {token && (
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", background: `${C.accent}15`,
            border: `1px solid ${C.accent}40`, borderRadius: 8,
            cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.accent,
          }}>
            ⬆️ {!mob && "Subir"}
          </button>
        )}
      </div>

      {/* ─── Sin Drive ─── */}
      {!token && (
        <Card style={{ textAlign: "center", padding: mob ? 30 : 50 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <p style={{ fontFamily: "DM Sans", fontSize: 16, color: C.text, marginBottom: 8 }}>
            Conecta tu Google Drive
          </p>
          <Btn onClick={signIn} disabled={!gisLoaded} style={{ margin: "0 auto" }}>
            Conectar Drive
          </Btn>
        </Card>
      )}

      {/* ─── Con Drive ─── */}
      {token && (
        <>
          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", marginBottom: 14,
            background: C.surface, border: `1px solid ${isSearching ? C.accent : C.border}`,
            borderRadius: 10, transition: "border-color 0.15s",
          }}>
            <svg width="16" height="16" fill="none" stroke={C.textDim} strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar en Drive — nombre, contenido, proveedor..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontFamily: "DM Sans", fontSize: 14, color: C.text,
              }}
            />
            {searching && <Spinner />}
            {isSearching && !searching && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                ✕
              </button>
            )}
          </div>

          {/* ── MODO BÚSQUEDA: resultados ── */}
          {isSearching && (
            <>
              {searched && results.length === 0 && !searching && (
                <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
                  Sin resultados para "<strong style={{ color: C.text }}>{query}</strong>"
                </div>
              )}
              {results.length > 0 && (
                <>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 8 }}>
                    {results.length} resultado{results.length !== 1 ? "s" : ""} · más recientes primero
                  </div>
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    {results.map(f => (
                      <FileRow key={f.id} file={f} onPreview={setPreviewFile} />
                    ))}
                  </Card>
                </>
              )}
            </>
          )}

          {/* ── MODO NAVEGAR: árbol de carpetas (cuando no hay búsqueda) ── */}
          {!isSearching && (
            <>
              {/* Breadcrumb */}
              {breadcrumb.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                  {breadcrumb.map((crumb, i) => (
                    <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {i > 0 && <span style={{ color: C.textDim, fontSize: 12 }}>›</span>}
                      <button onClick={() => navigateCrumb(i)} style={{
                        background: "none", border: "none",
                        cursor: i < breadcrumb.length - 1 ? "pointer" : "default",
                        fontFamily: "DM Sans", fontSize: 13,
                        color: i < breadcrumb.length - 1 ? C.accent : C.text,
                        padding: "2px 4px", borderRadius: 4,
                      }}
                        onMouseEnter={e => { if (i < breadcrumb.length - 1) e.currentTarget.style.background = C.surface2; }}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                      >
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {loadingFolder ? (
                <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>
              ) : (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {folders.length === 0 && fileItems.length === 0 && (
                    <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
                      Carpeta vacía
                    </div>
                  )}
                  {folders.map(f => (
                    <button key={f.id} onClick={() => navigateTo(f.id, f.name)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "9px 14px",
                      background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                      borderBottom: `1px solid ${C.border}08`,
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ color: C.accent, flexShrink: 0 }}>{I.folder}</span>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>
                        {f.name}
                      </span>
                      <span style={{ color: C.textDim, fontSize: 12 }}>›</span>
                    </button>
                  ))}
                  {fileItems.map(f => (
                    <FileRow key={f.id} file={f} onPreview={setPreviewFile} />
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
