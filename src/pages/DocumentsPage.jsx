// ═══════════════════════════════════════════
// Archivo: src/pages/DocumentsPage.jsx
// Versión: V19
// Fecha: 2026-03-17
// ═══════════════════════════════════════════
// CAMBIOS EN V19:
// - Tab "Indexados" ELIMINADA — ya no depende de Supabase
// - Nueva tab única: búsqueda fullText directa en Google Drive
//   (drive.searchFiles) — resultados instantáneos, siempre actualizados
// - Tab "Google Drive" se mantiene para navegación manual
// - Eliminado todo el código de sync/reindex/Supabase de esta página
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { getFileIcon, isFolder } from "../lib/helpers";
import { Card, Btn, Spinner } from "../components/UI";
import { FilePreviewModal } from "../components/FilePreviewModal";
import { DRIVE_ROOT_FOLDER } from "../lib/config";

// ─── Helpers ───
const isGoogleDoc = (mime) => mime?.includes("google-apps") && !mime?.includes("folder");

const FileRow = ({ file, onPreview }) => {
  const isDoc = isGoogleDoc(file.mimeType);
  const handleClick = () => {
    if (isDoc || file.webViewLink) {
      if (isDoc) { window.open(file.webViewLink, "_blank"); }
      else onPreview(file);
    }
  };
  return (
    <button
      onClick={handleClick}
      style={{
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
  const [tab, setTab]               = useState("search");
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Drive navigation (tab "browse")
  const [currentFolder, setCurrentFolder] = useState(DRIVE_ROOT_FOLDER);
  const [breadcrumb, setBreadcrumb]       = useState([{ id: DRIVE_ROOT_FOLDER, name: "APMEW" }]);
  const [files, setFiles]                 = useState([]);
  const [loadingDrive, setLoadingDrive]   = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const inputRef = useRef(null);

  const { token, gisLoaded, signIn, signOut, listAllFiles, searchFiles } = drive;

  // Focus search input on tab switch
  useEffect(() => {
    if (tab === "search") setTimeout(() => inputRef.current?.focus(), 80);
  }, [tab]);

  // Load Drive folder when browsing
  useEffect(() => {
    if (!token || tab !== "browse") return;
    const load = async () => {
      setLoadingDrive(true);
      try { const f = await listAllFiles(currentFolder); setFiles(f || []); }
      catch (e) { console.error(e); setFiles([]); }
      setLoadingDrive(false);
    };
    load();
  }, [token, currentFolder, tab, listAllFiles]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !token) return;
    setSearching(true);
    setSearched(false);
    setResults([]);
    try {
      const res = await searchFiles(query.trim());
      setResults(res || []);
    } catch (e) {
      console.error("[DriveSearch]", e);
    }
    setSearching(false);
    setSearched(true);
  }, [query, token, searchFiles]);

  const handleKey = (e) => { if (e.key === "Enter") handleSearch(); };

  const navigateTo    = (id, name) => { setCurrentFolder(id); setBreadcrumb(prev => [...prev, { id, name }]); };
  const navigateCrumb = (i) => { setCurrentFolder(breadcrumb[i].id); setBreadcrumb(breadcrumb.slice(0, i + 1)); };

  const folders   = files.filter(isFolder);
  const driveFiles = files.filter(f => !isFolder(f));

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>
          Documentos
        </h1>
        {token && (
          <button onClick={() => setShowUpload(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", background: `${C.accent}15`,
            border: `1px solid ${C.accent}40`, borderRadius: 8,
            cursor: "pointer", fontFamily: "DM Sans", fontSize: 12,
            fontWeight: 600, color: C.accent,
          }}>
            ⬆️ {!mob && "Subir"}
          </button>
        )}
      </div>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 16 }}>
        Búsqueda directa en Google Drive
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {[
          { id: "search", label: "🔍 Buscar" },
          { id: "browse", label: "📂 Navegar" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "9px 18px", background: "none", border: "none",
            borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            cursor: "pointer", fontFamily: "DM Sans", fontSize: 13,
            fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? C.accent : C.textDim,
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: BUSCAR ══ */}
      {tab === "search" && (
        <div>
          {!token ? (
            <Card style={{ textAlign: "center", padding: mob ? 30 : 50 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 16, color: C.text, marginBottom: 8 }}>
                Conecta tu Google Drive
              </p>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 24 }}>
                Para buscar documentos directamente en Drive
              </p>
              <Btn onClick={signIn} disabled={!gisLoaded} style={{ margin: "0 auto" }}>
                Conectar Drive
              </Btn>
            </Card>
          ) : (
            <>
              {/* Search bar */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px",
                  background: C.surface, border: `1px solid ${query ? C.accent : C.border}`,
                  borderRadius: 10, transition: "border-color 0.15s",
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔍</span>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Nombre, contenido, proveedor, dirección..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKey}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontFamily: "DM Sans", fontSize: 14, color: C.text,
                    }}
                  />
                  {query && (
                    <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 16, flexShrink: 0 }}>
                      ✕
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!query.trim() || searching}
                  style={{
                    padding: "10px 20px",
                    background: query.trim() && !searching ? C.accent : C.border,
                    color: "white", border: "none", borderRadius: 10,
                    fontFamily: "DM Sans", fontSize: 14, fontWeight: 700,
                    cursor: query.trim() && !searching ? "pointer" : "not-allowed",
                    transition: "background 0.15s", flexShrink: 0,
                  }}
                >
                  {searching ? "..." : "Buscar"}
                </button>
              </div>

              {/* Searching spinner */}
              {searching && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <Spinner />
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 10 }}>
                    Buscando en Drive...
                  </div>
                </div>
              )}

              {/* No results */}
              {searched && !searching && results.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
                  Sin resultados para "<strong style={{ color: C.text }}>{query}</strong>"
                </div>
              )}

              {/* Results */}
              {results.length > 0 && !searching && (
                <div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 8 }}>
                    {results.length} resultado{results.length !== 1 ? "s" : ""} · más recientes primero
                  </div>
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    {results.map(f => (
                      <FileRow key={f.id} file={f} onPreview={setPreviewFile} />
                    ))}
                  </Card>
                </div>
              )}

              {/* Empty state */}
              {!searched && !searching && (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                  <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>
                    Busca cualquier documento en tu Drive
                  </p>
                  <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                    Busca por nombre, contenido, proveedor o dirección
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ TAB: NAVEGAR ══ */}
      {tab === "browse" && (
        <div>
          {!token ? (
            <Card style={{ textAlign: "center", padding: mob ? 30 : 50 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 16, color: C.text, marginBottom: 8 }}>
                Conecta tu Google Drive
              </p>
              <Btn onClick={signIn} disabled={!gisLoaded} style={{ margin: "0 auto" }}>
                Conectar Drive
              </Btn>
            </Card>
          ) : (
            <>
              {/* Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
                {breadcrumb.map((crumb, i) => (
                  <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {i > 0 && <span style={{ color: C.textDim, fontSize: 12 }}>›</span>}
                    <button
                      onClick={() => navigateCrumb(i)}
                      style={{
                        background: "none", border: "none", cursor: i < breadcrumb.length - 1 ? "pointer" : "default",
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

              {loadingDrive ? (
                <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>
              ) : (
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {folders.length === 0 && driveFiles.length === 0 && (
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
                  {driveFiles.map(f => (
                    <FileRow key={f.id} file={f} onPreview={setPreviewFile} />
                  ))}
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
