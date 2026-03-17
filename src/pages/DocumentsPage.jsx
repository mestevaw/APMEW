// ═══════════════════════════════════════════
// Archivo: src/pages/DocumentsPage.jsx
// Versión: V20
// Fecha: 2026-03-17
// ═══════════════════════════════════════════
// CAMBIOS EN V20:
// - Eliminada tab "Navegar" — página queda solo con búsqueda
// - Lupa integrada en el header a la derecha del botón Subir
// - Búsqueda en tiempo real con debounce 400ms mientras el usuario escribe
// - Botón "Buscar" eliminado — la búsqueda es automática
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../lib/theme";
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
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [showUpload, setShowUpload]  = useState(false);
  const inputRef  = useRef(null);
  const debounceRef = useRef(null);

  const { token, gisLoaded, signIn, searchFiles } = drive;

  // ─── Búsqueda con debounce 400ms ─────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !token) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await searchFiles(q.trim());
      setResults(res || []);
    } catch (e) {
      console.error("[DriveSearch]", e);
      setResults([]);
    }
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

  return (
    <div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} mob={mob} />

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>
          Documentos
        </h1>

        {/* Lupa — abre/enfoca el input */}
        {token && (
          <button
            onClick={() => inputRef.current?.focus()}
            title="Buscar"
            style={{
              display: "flex", alignItems: "center", padding: "7px 9px",
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 8, cursor: "pointer", color: C.textDim,
              transition: "all 0.15s",
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

      {/* ─── Sin Drive conectado ─── */}
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
          {/* ─── Search bar ─── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", marginBottom: 16,
            background: C.surface, border: `1px solid ${query ? C.accent : C.border}`,
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
            {query && !searching && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>

          {/* ─── Resultados ─── */}
          {searched && results.length === 0 && !searching && (
            <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
              Sin resultados para "<strong style={{ color: C.text }}>{query}</strong>"
            </div>
          )}

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

          {/* ─── Empty state ─── */}
          {!query && (
            <div style={{ textAlign: "center", padding: "52px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>
                Busca cualquier documento en tu Drive
              </p>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                Los resultados aparecen mientras escribes
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
