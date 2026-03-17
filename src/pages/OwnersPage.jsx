// ═══════════════════════════════════════════
// Archivo: src/pages/OwnersPage.jsx
// Versión: V9
// Fecha: 2026-03-17
// ═══════════════════════════════════════════
// CAMBIOS EN V9:
// - DocumentosTab: navega carpeta de Drive del owner directamente (OWNER_DRIVE_FOLDERS)
//   sin Supabase — muestra árbol real, búsqueda fullText con drive.searchFiles
// - CuentasTab: idem, navega FROST MANGO/etc. directamente por drive_folder_id
// - Eliminados todos los supaFetch("documents") de ambas tabs
// CAMBIOS EN V8 (anterior):
// - CuentasTab árbol empieza desde subcarpeta bancaria
// CAMBIOS EN V7:
// - DocumentosTab: árbol jerárquico (tree view) igual que DocumentsPage
// - Lupa en esquina superior derecha (siempre visible, sin hamburguesa)
// - limit:11000 en fetch de documentos
// CAMBIOS EN V6:
// - DocumentosTab: menú hamburguesa con "Subir" y "Buscar"
// - Búsqueda en tiempo real filtra carpetas y archivos por nombre
// - Modal de subida con drag-and-drop, click y paste
// - Análisis automático con Claude API: lee el PDF y sugiere
//   a qué dueño/propiedad/tipo corresponde el documento
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { supaFetch, supaInsert, supaDelete } from "../lib/supabase";
import { Card, Badge, Spinner, Btn } from "../components/UI";
import { FilePreviewModal } from "../components/FilePreviewModal";
import {
  PROPERTIES, OWNER_COLORS, OWNER_SHORT, OWNER_BANK_FOLDERS, OWNER_DRIVE_FOLDERS,
  getPropExpenseTypes,
} from "./dashboard/constants";
import PropertyDetail from "./dashboard/PropertyDetail";

import { getFileIcon, getFileExt } from "../lib/helpers";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const unique = (arr) => [...new Set(arr)];

const OWNERS = unique(PROPERTIES.map((p) => p.owner)).sort();
const ownerProps = (name) => PROPERTIES.filter((p) => p.owner === name);

const TABS = [
  { id: "resumen",    label: "Resumen",    icon: "📊" },
  { id: "documentos", label: "Documentos", icon: "📄" },
  { id: "impuestos",  label: "Impuestos",  icon: "🏛️" },
  { id: "cuentas",    label: "Cuentas",    icon: "🏦" },
  { id: "gastos",     label: "Gastos",     icon: "💸" },
];

// ─── Tab bar ─────────────────────────────────────────────────────────────────
const TabBar = ({ active, onChange, mob, rightSlot }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 0,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: 20,
  }}>
    <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: mob ? "9px 13px" : "10px 18px",
            background: "none", border: "none",
            borderBottom: active === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "DM Sans",
            fontSize: mob ? 12 : 13,
            fontWeight: active === t.id ? 600 : 400,
            color: active === t.id ? C.accent : C.textDim,
            whiteSpace: "nowrap",
            transition: "all 0.15s",
            marginBottom: -1,
            flexShrink: 0,
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
    {rightSlot && <div style={{ paddingBottom: 5, paddingRight: 4, flexShrink: 0, alignSelf: "center" }}>{rightSlot}</div>}
  </div>
);

// =============================================================================
// TAB: RESUMEN  (portado de OwnerDetail.jsx + propiedades clickeables)
// =============================================================================
const ResumenTab = ({ ownerName, mob, onSelectProperty }) => {
  const [expByType, setExpByType] = useState({});
  const [loading, setLoading]     = useState(true);
  const [selYear, setSelYear]     = useState(null);

  const props = ownerProps(ownerName);
  const types = getPropExpenseTypes(props[0]?.address || "");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const allItems = [];
      const results = await Promise.all(
        props.map((p) =>
          Promise.all([
            supaFetch("property_expenses", {
              filters: `property_address=eq.${encodeURIComponent(p.address)}`,
              order: "period_year.desc",
            }),
            supaFetch("property_taxes", {
              filters: `property_address=eq.${encodeURIComponent(p.address)}`,
              order: "tax_year.desc",
            }),
          ])
        )
      );
      results.forEach(([propExp, taxData]) => {
        (propExp || []).forEach((e) => allItems.push({ ...e, amount: Number(e.amount || 0) }));
        (taxData || [])
          .filter((t) => t.property_tax != null)
          .forEach((t) =>
            allItems.push({ expense_type: "property_tax", amount: Number(t.property_tax), period_year: t.tax_year, period_month: 1 })
          );
      });
      const grouped = {};
      allItems.forEach((e) => {
        if (!grouped[e.expense_type]) grouped[e.expense_type] = {};
        if (!grouped[e.expense_type][e.period_year]) grouped[e.expense_type][e.period_year] = 0;
        grouped[e.expense_type][e.period_year] += e.amount;
      });
      setExpByType(grouped);
      const years = unique(Object.values(grouped).flatMap((y) => Object.keys(y))).map(Number).sort((a, b) => b - a);
      if (years.length > 0) setSelYear(years[0]);
      setLoading(false);
    };
    load();
  }, [ownerName]);

  const years       = unique(Object.values(expByType).flatMap((y) => Object.keys(y))).map(Number).sort((a, b) => b - a);
  const displayYear = selYear || years[0] || new Date().getFullYear();
  const activeProps = props.filter((p) => !p.sold);
  const soldProps   = props.filter((p) => p.sold);

  const selectStyle = {
    fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
    background: C.surface2, color: C.accent,
    border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer",
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Financial summary */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>📊 Resumen financiero</div>
          {years.length > 0 && (
            <select value={displayYear} onChange={(e) => setSelYear(Number(e.target.value))} style={selectStyle}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {types.map((t) => {
            const val     = (expByType[t.key] || {})[displayYear] || 0;
            const hasData = val > 0;
            return (
              <div key={t.key} style={{
                padding: "10px 12px",
                background: t.income && hasData ? `${C.green}10` : C.surface2,
                borderRadius: 8,
                border: `1px solid ${t.income && hasData ? C.green + "40" : C.border}`,
                opacity: hasData ? 1 : 0.45,
              }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: t.income ? C.green : C.textDim }}>{t.icon} {t.label}</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: hasData ? (t.income ? C.green : C.text) : C.textMuted, marginTop: 4 }}>
                  {hasData ? fmt(val) : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {(() => {
          const incTotal = types.filter((t) => t.income).reduce((s, t) => s + ((expByType[t.key] || {})[displayYear] || 0), 0);
          const expTotal = types.filter((t) => !t.income).reduce((s, t) => s + ((expByType[t.key] || {})[displayYear] || 0), 0);
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.accentGlow, borderRadius: 8, marginBottom: incTotal > 0 ? 4 : 0 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Gastos</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.accent }}>{fmt(expTotal)}</span>
              </div>
              {incTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${incTotal - expTotal >= 0 ? C.green : C.red}12`, borderRadius: 8 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: incTotal - expTotal >= 0 ? C.green : C.red }}>Net Income</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: incTotal - expTotal >= 0 ? C.green : C.red }}>{fmt(incTotal - expTotal)}</span>
                </div>
              )}
            </>
          );
        })()}
      </Card>

      {/* Active property list */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>🏠 Propiedades activas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {activeProps.map((p) => (
            <button key={p.address} onClick={() => onSelectProperty(p)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
              background: C.surface2, borderRadius: 8, border: "none", cursor: "pointer",
              width: "100%", textAlign: "left", transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accentGlow)}
              onMouseLeave={e => (e.currentTarget.style.background = C.surface2)}
            >
              <span style={{ color: OWNER_COLORS[p.owner] || C.accent, fontSize: 14 }}>🏠</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{p.address}</span>
              <span style={{ color: C.textMuted, fontSize: 12 }}>▸</span>
            </button>
          ))}
        </div>
      </Card>

      {soldProps.length > 0 && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Vendidas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {soldProps.map((p) => (
              <button key={p.address} onClick={() => onSelectProperty(p)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                background: C.surface2, borderRadius: 8, border: "none", cursor: "pointer",
                width: "100%", textAlign: "left", opacity: 0.55, transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.55")}
              >
                <span style={{ color: C.textDim, fontSize: 14 }}>🏠</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, flex: 1 }}>{p.address}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: `${C.red}20`, color: C.red }}>Vendida</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// =============================================================================
// TAB: DOCUMENTOS  (navega Drive directamente)
// =============================================================================
// ─── Mini hamburger + dropdown for DocumentosTab ─────────────────────────────
const DocMenu = ({ onSearch, onUpload }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? C.accentGlow : "none",
          border: `1px solid ${open ? C.accent + "60" : C.border}`,
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => !open && (e.currentTarget.style.borderColor = C.accent + "60")}
        onMouseLeave={e => !open && (e.currentTarget.style.borderColor = C.border)}
      >
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 16, height: 2, background: open ? C.accent : C.textDim, borderRadius: 1, transition: "all 0.15s" }} />
        ))}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 99,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)", minWidth: 170, overflow: "hidden",
          }}>
            {[
              { icon: "📤", label: "Subir documento", action: () => { onUpload(); setOpen(false); } },
              { icon: "🔍", label: "Buscar",           action: () => { onSearch(); setOpen(false); } },
            ].map((item, i) => (
              <button key={i} onClick={item.action} style={{
                width: "100%", textAlign: "left", padding: "11px 16px",
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                borderBottom: i === 0 ? `1px solid ${C.border}` : "none",
                fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text,
                transition: "background 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Upload modal with AI analysis ───────────────────────────────────────────
const UploadModal = ({ onClose, ownerName }) => {
  const [file,        setFile]        = useState(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [result,      setResult]      = useState(null);
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = React.useRef(null);

  const PROPERTIES_LIST = PROPERTIES.map(p => `${p.address} (${p.owner})`).join("\n");

  const analyzeFile = async (f) => {
    setFile(f);
    setAnalyzing(true);
    setResult(null);
    try {
      // Read file as base64
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });

      const isPdf = f.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : f.type;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              {
                type: isPdf ? "document" : "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Analiza este documento y determina dónde debe archivarse dentro de este sistema de propiedades.

PROPIEDADES DISPONIBLES:
${PROPERTIES_LIST}

Responde SOLO con JSON, sin texto extra, sin backticks:
{
  "tipo": "factura/estado_cuenta/impuesto/seguro/contrato/correspondencia/otro",
  "emisor": "nombre del emisor o empresa",
  "fecha": "fecha del documento (YYYY-MM-DD o null)",
  "monto": "monto total con moneda o null",
  "propiedadSugerida": "dirección exacta de la propiedad de la lista de arriba, o null si es general",
  "dueno": "nombre exacto del dueño de la lista de arriba",
  "razon": "explicación breve de por qué este documento va aquí (max 2 líneas)",
  "carpetaSugerida": "nombre de subcarpeta sugerida dentro de la propiedad"
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (err) {
      console.error("[UploadModal] analyze:", err);
      setResult({ error: "No se pudo analizar el documento. Intenta de nuevo." });
    }
    setAnalyzing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) analyzeFile(f);
  };

  const handlePaste = (e) => {
    const f = e.clipboardData.files[0];
    if (f) analyzeFile(f);
  };

  React.useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const ownerColor = OWNER_COLORS[result?.dueno] || C.accent;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
        width: "100%", maxWidth: 480, padding: 28,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        animation: "fadeIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📎</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, color: C.text }}>
              Subir Documento
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Drop zone */}
        {!result && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? C.accent : C.border}`,
              borderRadius: 14,
              padding: "36px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? C.accentGlow : C.surface2,
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: "none" }}
              onChange={e => e.target.files[0] && analyzeFile(e.target.files[0])} />
            {analyzing ? (
              <div>
                <Spinner />
                <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.accent, marginTop: 12 }}>
                  Analizando con Claude…
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>
                  {dragOver ? "📂" : "📁"}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, color: dragOver ? C.accent : C.text, marginBottom: 6 }}>
                  Arrastra · Haz clic · Pega (Ctrl+V)
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>
                  PDF, imagen o archivo desde cualquier fuente
                </div>
              </>
            )}
          </div>
        )}

        {/* AI result */}
        {result && !result.error && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {/* File name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.surface2, borderRadius: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>📕</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file?.name}
              </span>
            </div>

            {/* Suggestion card */}
            <div style={{ border: `1px solid ${ownerColor}40`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ background: `${ownerColor}15`, padding: "12px 16px", borderBottom: `1px solid ${ownerColor}30` }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: ownerColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  📍 Archivar en
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, color: ownerColor }}>
                  {result.dueno}
                </div>
                {result.propiedadSugerida && (
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, marginTop: 2 }}>
                    {result.propiedadSugerida}
                  </div>
                )}
                {result.carpetaSugerida && (
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    📁 {result.carpetaSugerida}
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 16px", background: C.surface }}>
                {[
                  result.tipo      && ["Tipo",    result.tipo],
                  result.emisor    && ["Emisor",  result.emisor],
                  result.fecha     && ["Fecha",   result.fecha],
                  result.monto     && ["Monto",   result.monto],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{label}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.text }}>{val}</span>
                  </div>
                ))}
                {result.razon && (
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>
                    {result.razon}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setFile(null); setResult(null); }} style={{
                flex: 1, padding: "10px", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
                background: "none", border: `1px solid ${C.border}`, borderRadius: 10,
                color: C.textDim, cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                Subir otro
              </button>
              <button onClick={onClose} style={{
                flex: 2, padding: "10px", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
                background: ownerColor, border: "none", borderRadius: 10,
                color: "#000", cursor: "pointer", opacity: 0.9, transition: "opacity 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.9"}
              >
                Entendido ✓
              </button>
            </div>
          </div>
        )}

        {result?.error && (
          <div style={{ padding: "14px 16px", background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.red }}>
            {result.error}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Árbol de documentos para OwnersPage ────────────────────────────────────
const buildOwnerTree = (docs) => {
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

const OwnerTreeNode = ({ name, node, depth, searchQuery }) => {
  const hasChildren = Object.keys(node.children).length > 0;
  const hasFiles    = node.files.length > 0;
  const [open, setOpen] = useState(depth === 0);

  useEffect(() => { if (searchQuery) setOpen(true); }, [searchQuery]);

  const childKeys = Object.keys(node.children).sort();
  const indent    = depth * 14;

  return (
    <div>
      {name && (
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "100%", padding: `5px 12px 5px ${12 + indent}px`,
            background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surface2}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: C.textDim, fontSize: 10, width: 10, flexShrink: 0 }}>
            {(hasChildren || hasFiles) ? (open ? "▼" : "▶") : ""}
          </span>
          <span style={{ color: C.accent, flexShrink: 0, fontSize: 14 }}>{I.folder}</span>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: C.text, flex: 1 }}>{name}</span>
          {hasFiles && <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>{node.files.length}</span>}
        </button>
      )}
      {(open || !name) && (
        <>
          {childKeys.map(key => (
            <OwnerTreeNode key={key} name={key} node={node.children[key]}
              depth={name ? depth + 1 : depth} searchQuery={searchQuery} />
          ))}
          {open && node.files.map((d, i) => (
            <a key={d.id || i}
              href={d.google_drive_file_id ? `https://drive.google.com/file/d/${d.google_drive_file_id}/view` : "#"}
              target="_blank" rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: `4px 12px 4px ${12 + (name ? (depth + 1) * 14 + 16 : 16)}px`,
                textDecoration: "none", cursor: d.google_drive_file_id ? "pointer" : "default",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 13 }}>{getFileIcon(d.mime_type)}</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.title || "Sin nombre"}
              </span>
              {d.file_type && <Badge color={C.blue}>{d.file_type}</Badge>}
            </a>
          ))}
        </>
      )}
    </div>
  );
};

// =============================================================================
// TAB: DOCUMENTOS  — lee de Supabase, solo Drive para subir
// =============================================================================
const DocumentosTab = ({ ownerName, mob, drive }) => {
  const folderId   = OWNER_DRIVE_FOLDERS[ownerName]?.drive_folder_id || null;
  const [folder, setFolder]         = useState(folderId);
  const [breadcrumb, setBreadcrumb] = useState(folderId ? [{ id: folderId, name: ownerName }] : []);
  const [files, setFiles]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [mode, setMode]             = useState("browse");
  const inputRef = useRef(null);

  const { token, searchFiles, listAllFiles } = drive || {};

  useEffect(() => {
    if (!token || !folder || mode !== "browse") return;
    setLoading(true);
    listAllFiles(folder)
      .then(f => setFiles(f || []))
      .catch(e => { console.error(e); setFiles([]); })
      .finally(() => setLoading(false));
  }, [token, folder, mode, listAllFiles]);

  const navigateTo    = (id, name) => { setFolder(id); setBreadcrumb(prev => [...prev, { id, name }]); };
  const navigateCrumb = (i)        => { setFolder(breadcrumb[i].id); setBreadcrumb(prev => prev.slice(0, i + 1)); };

  const handleSearch = async () => {
    if (!query.trim() || !token) return;
    setSearching(true); setSearched(false); setResults([]);
    try { const res = await searchFiles(query.trim(), folderId || undefined); setResults(res || []); }
    catch (e) { console.error(e); }
    setSearching(false); setSearched(true);
  };

  if (!token) return (
    <div style={{ textAlign: "center", padding: "30px 0", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
      Conecta Google Drive para ver los documentos.
    </div>
  );
  if (!folderId) return (
    <div style={{ textAlign: "center", padding: "30px 0", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
      Sin carpeta Drive configurada para este dueño.
    </div>
  );

  const folderItems = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const fileItems   = files.filter(f => f.mimeType !== "application/vnd.google-apps.folder");

  return (
    <>
      {/* Toggle browse/search */}
      <div style={{ display: "flex", gap: 0, background: C.surface2, borderRadius: 8, padding: 2, marginBottom: 12, width: "fit-content" }}>
        {["browse","search"].map(m => (
          <button key={m} onClick={() => { setMode(m); if (m === "search") setTimeout(() => inputRef.current?.focus(), 60); }}
            style={{
              padding: "5px 14px", background: mode === m ? C.accent : "transparent",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
              color: mode === m ? "white" : C.textDim,
            }}>
            {m === "browse" ? "📂 Navegar" : "🔍 Buscar"}
          </button>
        ))}
      </div>

      {mode === "search" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input ref={inputRef} type="text" placeholder="Buscar en documentos..."
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ flex: 1, padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, color: C.text, outline: "none" }} />
            <button onClick={handleSearch} disabled={!query.trim() || searching}
              style={{ padding: "8px 16px", background: query.trim() ? C.accent : C.border, color: "white", border: "none", borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: query.trim() ? "pointer" : "default" }}>
              {searching ? "..." : "Buscar"}
            </button>
          </div>
          {searching && <div style={{ textAlign: "center", padding: 20 }}><Spinner /></div>}
          {searched && results.length === 0 && (
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, textAlign: "center", padding: "20px 0" }}>Sin resultados para "{query}"</div>
          )}
          {results.length > 0 && (
            <Card style={{ padding: 0 }}>
              {results.map(f => (
                <button key={f.id} onClick={() => f.webViewLink && window.open(f.webViewLink, "_blank")}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "transparent", border: "none", cursor: f.webViewLink ? "pointer" : "default", textAlign: "left", borderBottom: `1px solid ${C.border}08` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 15 }}>📄</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </button>
              ))}
              <div style={{ padding: "6px 14px", fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>{results.length} resultado{results.length !== 1 ? "s" : ""}</div>
            </Card>
          )}
        </div>
      )}

      {mode === "browse" && (
        <div>
          {breadcrumb.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
              {breadcrumb.map((crumb, i) => (
                <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span style={{ color: C.textDim, fontSize: 11 }}>›</span>}
                  <button onClick={() => navigateCrumb(i)} style={{ background: "none", border: "none", cursor: i < breadcrumb.length - 1 ? "pointer" : "default", fontFamily: "DM Sans", fontSize: 12, color: i < breadcrumb.length - 1 ? C.accent : C.text, padding: "1px 4px" }}>
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: "center", padding: 30 }}><Spinner /></div>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {folderItems.length === 0 && fileItems.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>Carpeta vacía</div>
              )}
              {folderItems.map(f => (
                <button key={f.id} onClick={() => navigateTo(f.id, f.name)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${C.border}08` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 16 }}>📁</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{f.name}</span>
                  <span style={{ color: C.textDim, fontSize: 12 }}>›</span>
                </button>
              ))}
              {fileItems.map(f => (
                <button key={f.id} onClick={() => f.webViewLink && window.open(f.webViewLink, "_blank")}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "transparent", border: "none", cursor: f.webViewLink ? "pointer" : "default", textAlign: "left", borderBottom: `1px solid ${C.border}08` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 15 }}>📄</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </button>
              ))}
            </Card>
          )}
        </div>
      )}
    </>
  );
};
// =============================================================================
const ImpuestosTab = ({ ownerName, mob }) => {
  const [taxes, setTaxes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(ownerProps(ownerName).map((p) =>
          supaFetch("property_taxes", { filters: `property_address=eq.${encodeURIComponent(p.address)}`, order: "tax_year.desc" })
        ));
        const all = results.flat().filter(Boolean);
        setTaxes(all);
        const years = unique(all.map((t) => t.tax_year)).sort((a, b) => b - a);
        if (years.length) setSelYear(years[0]);
      } catch (err) { console.error("[OwnersPage] taxes:", err); }
      setLoading(false);
    };
    load();
  }, [ownerName]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  const years    = unique(taxes.map((t) => t.tax_year)).sort((a, b) => b - a);
  const filtered = selYear ? taxes.filter((t) => t.tax_year === selYear) : taxes;
  const total    = filtered.reduce((s, t) => s + Number(t.property_tax || 0), 0);
  const selStyle = { fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: C.surface2, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" };

  if (!taxes.length) return <Card><div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>No hay registros de impuestos.</div></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>🏛️ Property Taxes</span>
          {years.length > 0 && <select value={selYear || ""} onChange={(e) => setSelYear(Number(e.target.value))} style={selStyle}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: C.accentGlow, borderRadius: 8 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Total {selYear}</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: C.accent }}>{fmt(total)}</span>
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Detalle por Propiedad — {selYear}</div>
        {!filtered.length ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>Sin registros para {selYear}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((t, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: C.surface2, borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.property_address}</div>
                  {t.paid_date && <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 2 }}>Pagado: {t.paid_date}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.text }}>{fmt(Number(t.property_tax || 0))}</div>
                  {t.status && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, background: t.status === "paid" ? `${C.green}20` : `${C.red}20`, color: t.status === "paid" ? C.green : C.red }}>{t.status}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {years.length > 1 && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Historial por Año</div>
          {years.map((yr) => {
            const yt   = taxes.filter((t) => t.tax_year === yr).reduce((s, t) => s + Number(t.property_tax || 0), 0);
            const maxY = Math.max(...years.map((y) => taxes.filter((t) => t.tax_year === y).reduce((s, t) => s + Number(t.property_tax || 0), 0)));
            return (
              <div key={yr} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: yr === selYear ? C.accent : C.textDim, fontWeight: yr === selYear ? 600 : 400 }}>{yr}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: yr === selYear ? C.accent : C.text }}>{fmt(yt)}</span>
                </div>
                <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${maxY > 0 ? (yt / maxY) * 100 : 0}%`, background: yr === selYear ? C.accent : C.border, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

// =============================================================================
// TAB: CUENTAS — documentos bancarios de Supabase + registro de cuentas
// =============================================================================
const CuentasTab = ({ ownerName, mob }) => {
  const [accounts,    setAccounts]   = useState([]);
  const [loadingAcc,  setLoadingAcc] = useState(true);
  const [tableExists, setTableExists]= useState(true);
  const [adding,      setAdding]     = useState(false);
  const [form,        setForm]       = useState({ bank_name: "", account_type: "", account_number: "", balance: "", notes: "" });
  const [bankDocs,    setBankDocs]   = useState([]);
  const [bankRootId,  setBankRootId]  = useState(null);
  const [bankRootName,setBankRootName]= useState("");
  const [loadingDocs, setLoadingDocs]= useState(true);
  const [searchQuery, setSearchQuery]= useState("");
  const [searchOpen,  setSearchOpen] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoadingAcc(true);
    try {
      const rows = await supaFetch("owner_bank_accounts", { filters: `owner_name=eq.${encodeURIComponent(ownerName)}`, order: "bank_name" });
      setAccounts(rows || []);
      setTableExists(true);
    } catch { setTableExists(false); setAccounts(  // V9: Cargar documentos bancarios desde Drive directamente (sin Supabase)
  useEffect(() => {
    const load = async () => {
      if (!drive?.token) { setLoadingDocs(false); return; }
      setLoadingDocs(true);
      try {
        const ownerFolderId = OWNER_DRIVE_FOLDERS[ownerName]?.drive_folder_id;
        const bankSubfolder = OWNER_BANK_FOLDERS[ownerName]?.subfolder_name;
        if (!ownerFolderId) { setBankDocs([]); setLoadingDocs(false); return; }

        if (bankSubfolder) {
          const ownerFiles = await drive.listAllFiles(ownerFolderId);
          const bankFolder = (ownerFiles || []).find(f =>
            f.mimeType === "application/vnd.google-apps.folder" &&
            f.name.toUpperCase().includes(bankSubfolder.toUpperCase())
          );
          if (bankFolder) {
            setBankRootId(bankFolder.id);
            setBankRootName(bankFolder.name);
            const bankFiles = await drive.listAllFiles(bankFolder.id);
            setBankDocs(bankFiles || []);
          } else {
            setBankDocs([]);
          }
        } else {
          setBankRootId(ownerFolderId);
          setBankRootName(ownerName);
          const files = await drive.listAllFiles(ownerFolderId);
          setBankDocs(files || []);
        }
      } catch (err) { console.error("[CuentasTab]", err); }
      setLoadingDocs(false);
    };
    load();
  }, [ownerName, drive?.token]);

  const handleAdd = async () => {
    if (!form.bank_name.trim()) return;
    try {
      await supaInsert("owner_bank_accounts", { owner_name: ownerName, bank_name: form.bank_name, account_type: form.account_type, account_number: form.account_number, balance: form.balance ? Number(form.balance) : null, notes: form.notes });
      setForm({ bank_name: "", account_type: "", account_number: "", balance: "", notes: "" });
      setAdding(false);
      loadAccounts();
    } catch (err) { console.error("[CuentasTab] insert:", err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta cuenta?")) return;
    try { await supaDelete("owner_bank_accounts", id); loadAccounts(); }
    catch (err) { console.error("[CuentasTab] delete:", err); }
  };

  const inputS = { fontFamily: "DM Sans", fontSize: 13, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, outline: "none", width: "100%", boxSizing: "border-box" };
  const totalBal = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  const q = searchQuery.trim().toLowerCase();
  const filteredDocs = q
    ? bankDocs.filter(d => (d.name || "").toLowerCase().includes(q))
    : bankDocs;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Documentos bancarios de Supabase ── */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>🏦 Estados de cuenta</span>
          <button
            onClick={() => { setSearchOpen(v => !v); if (searchOpen) setSearchQuery(""); }}
            style={{
              background: searchOpen ? C.accentGlow : "transparent",
              border: `1px solid ${searchOpen ? C.accent + "40" : C.border}`,
              borderRadius: 8, padding: "4px 7px", cursor: "pointer",
              color: searchOpen ? C.accent : C.textDim, display: "flex", alignItems: "center",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        </div>
        {searchOpen && (
          <input autoFocus type="text" placeholder="Buscar estado de cuenta…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Escape" && setSearchOpen(false)}
            style={{ ...inputS, marginBottom: 8 }} />
        )}
        {loadingDocs ? (
          <div style={{ textAlign: "center", padding: 16 }}><Spinner /></div>
        ) : !drive?.token ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
            Conecta Google Drive para ver estados de cuenta.
          </div>
        ) : bankDocs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
            {q ? `Sin resultados para "${q}"` : "No se encontraron estados de cuenta."}
          </div>
        ) : (
          <div style={{ paddingTop: 2, paddingBottom: 2 }}>
            {filteredDocs.map(f => (
              <button key={f.id}
                onClick={() => f.webViewLink && window.open(f.webViewLink, "_blank")}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 10px",
                  background: "transparent", border: "none",
                  cursor: f.webViewLink ? "pointer" : "default", textAlign: "left",
                  borderBottom: `1px solid ${C.border}08`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: 14 }}>{f.mimeType === "application/vnd.google-apps.folder" ? "📁" : "📄"}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </button>
            ))}
          </div>
        )}
        {filteredDocs.length > 0 && (
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 6 }}>
            {filteredDocs.length} documentos
          </div>
        )}
      </Card>

      {/* Supabase accounts */}
      {loadingAcc ? (
        <div style={{ textAlign: "center", padding: 24 }}><Spinner /></div>
      ) : (
        <>
          {accounts.length > 0 && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>Cuentas registradas</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: C.green }}>{fmt(totalBal)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {accounts.map((acc, i) => (
                  <div key={acc.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface2, borderRadius: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>{acc.bank_name}</div>
                      <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginTop: 2 }}>
                        {[acc.account_type, acc.account_number].filter(Boolean).join(" · ")}{acc.notes ? ` · ${acc.notes}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {acc.balance != null && <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.green }}>{fmt(Number(acc.balance))}</div>}
                      <button onClick={() => handleDelete(acc.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, marginTop: 2 }}
                        onMouseEnter={e => (e.currentTarget.style.color = C.red)} onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {accounts.length === 0 && !adding && (
            <Card>
              <div style={{ textAlign: "center", padding: "20px 0", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
                {tableExists ? "No hay cuentas registradas." : "La tabla owner_bank_accounts aún no existe en Supabase."}
              </div>
            </Card>
          )}

          {adding && (
            <Card>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>➕ Nueva Cuenta</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { key: "bank_name",      label: "Banco *",           placeholder: "Chase, Citi, BBVA…" },
                  { key: "account_type",   label: "Tipo",              placeholder: "Checking, Savings, Business…" },
                  { key: "account_number", label: "Últimos 4 dígitos", placeholder: "xxxx" },
                  { key: "balance",        label: "Balance",           placeholder: "0.00", type: "number" },
                  { key: "notes",          label: "Notas",             placeholder: "Notas opcionales" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>{label}</div>
                    <input type={type || "text"} placeholder={placeholder} value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={inputS} />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <Btn onClick={handleAdd} small>Guardar</Btn>
                  <Btn onClick={() => setAdding(false)} small outline>Cancelar</Btn>
                </div>
              </div>
            </Card>
          )}

          {!adding && tableExists && (
            <button onClick={() => setAdding(true)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 16px", background: "none", border: `1px dashed ${C.border}`,
              borderRadius: 10, cursor: "pointer", color: C.textDim,
              fontFamily: "DM Sans", fontSize: 13, transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}>
              + Agregar Cuenta
            </button>
          )}
        </>
      )}
    </div>
  );
};

// =============================================================================
// TAB: GASTOS
// =============================================================================
const GastosTab = ({ ownerName, mob }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selYear, setSelYear]   = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const results = await Promise.all(ownerProps(ownerName).map((p) =>
          supaFetch("property_expenses", { filters: `property_address=eq.${encodeURIComponent(p.address)}`, order: "period_year.desc,period_month.desc" })
        ));
        const all = results.flat().filter(Boolean).map((e) => ({ ...e, amount: Number(e.amount || 0) }));
        setExpenses(all);
        const years = unique(all.map((e) => e.period_year)).sort((a, b) => b - a);
        if (years.length) setSelYear(years[0]);
      } catch (err) { console.error("[OwnersPage] expenses:", err); }
      setLoading(false);
    };
    load();
  }, [ownerName]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  const years    = unique(expenses.map((e) => e.period_year)).sort((a, b) => b - a);
  const yearData = selYear ? expenses.filter((e) => e.period_year === selYear) : expenses;
  const byType   = {};
  yearData.forEach((e) => {
    if (!byType[e.expense_type]) byType[e.expense_type] = { total: 0, rows: [] };
    byType[e.expense_type].total += e.amount;
    byType[e.expense_type].rows.push(e);
  });
  const sortedTypes  = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);
  const incTotal     = sortedTypes.filter(([k]) => k === "gross_rents").reduce((s, [, v]) => s + v.total, 0);
  const expTotal     = sortedTypes.filter(([k]) => k !== "gross_rents").reduce((s, [, v]) => s + v.total, 0);

  const TYPE_LABELS = {
    gross_rents: { label: "Rentas Totales", icon: "💰", income: true }, maintenance: { label: "Maintenance", icon: "🔧" },
    insurance: { label: "Insurance", icon: "🛡️" }, legal_fees: { label: "Legal Fees", icon: "⚖️" },
    repairs: { label: "Repairs", icon: "🔨" }, property_tax: { label: "Property Taxes", icon: "🏛️" },
    utilities: { label: "Utilities", icon: "💡" }, depreciation: { label: "Depreciation", icon: "📉" },
    other_expenses: { label: "Other", icon: "📋" }, electricity: { label: "Luz", icon: "💡" },
    water: { label: "Agua", icon: "💧" }, gas: { label: "Gas", icon: "🔥" }, hoa: { label: "Mantenimiento", icon: "🏘️" },
  };

  const selStyle = { fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: C.surface2, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" };

  if (!expenses.length) return <Card><div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>No hay gastos registrados.</div></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>Resumen {selYear}</span>
          {years.length > 0 && <select value={selYear || ""} onChange={(e) => setSelYear(Number(e.target.value))} style={selStyle}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        </div>
        {incTotal > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${C.green}12`, borderRadius: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.green }}>💰 Rentas</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.green }}>{fmt(incTotal)}</span>
        </div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.accentGlow, borderRadius: 8, marginBottom: incTotal > 0 ? 4 : 0 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>💸 Gastos</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(expTotal)}</span>
        </div>
        {incTotal > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${incTotal - expTotal >= 0 ? C.green : C.red}10`, borderRadius: 8 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: incTotal - expTotal >= 0 ? C.green : C.red }}>📊 Net</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: incTotal - expTotal >= 0 ? C.green : C.red }}>{fmt(incTotal - expTotal)}</span>
        </div>}
      </Card>

      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Detalle por Categoría</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedTypes.map(([type, { total, rows }]) => {
            const meta  = TYPE_LABELS[type] || { label: type, icon: "📋" };
            const isOpen = expanded[type];
            const isInc  = meta.income;
            return (
              <div key={type}>
                <button onClick={() => setExpanded((ex) => ({ ...ex, [type]: !isOpen }))} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", background: isInc ? `${C.green}12` : C.surface2,
                  borderRadius: isOpen ? "8px 8px 0 0" : 8, border: "none", cursor: "pointer", transition: "background 0.15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = isInc ? `${C.green}20` : C.accentGlow)}
                  onMouseLeave={e => (e.currentTarget.style.background = isInc ? `${C.green}12` : C.surface2)}
                >
                  <span style={{ fontSize: 14 }}>{meta.icon}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: isInc ? C.green : C.text, flex: 1, textAlign: "left" }}>{meta.label}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: isInc ? C.green : C.accent }}>{fmt(total)}</span>
                  <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div style={{ background: C.surface, borderRadius: "0 0 8px 8px", border: `1px solid ${C.border}`, borderTop: "none" }}>
                    {rows.slice(0, 60).map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{r.property_address}</span>
                          <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>{r.period_year}{r.period_month ? `/${String(r.period_month).padStart(2, "0")}` : ""}{r.notes ? ` · ${r.notes}` : ""}</span>
                        </div>
                        <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: isInc ? C.green : C.text, flexShrink: 0, marginLeft: 8 }}>{fmt(r.amount)}</span>
                      </div>
                    ))}
                    {rows.length > 60 && <div style={{ padding: "6px 14px", fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>+{rows.length - 60} más…</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// =============================================================================
// OWNER DETAIL VIEW  (header + 5 tabs)
// =============================================================================
const OwnerPageDetail = ({ ownerName, mob, drive, onBack, onSelectProperty }) => {
  const [tab, setTab] = useState("resumen");
  const color       = OWNER_COLORS[ownerName] || C.accent;
  const props       = ownerProps(ownerName);
  const activeProps = props.filter((p) => !p.sold);
  const soldProps   = props.filter((p) => p.sold);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>
          {I.back}
        </button>
        <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: `${color}20`, border: `1px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          🏢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 17 : 22, fontWeight: 700, color, marginBottom: 2 }}>{ownerName}</h1>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>
            {activeProps.length} propiedades activas{soldProps.length > 0 ? ` · ${soldProps.length} vendidas` : ""}
          </div>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} mob={mob} />

      {tab === "resumen"    && <ResumenTab    ownerName={ownerName} mob={mob} onSelectProperty={onSelectProperty} />}
      {tab === "documentos" && <DocumentosTab ownerName={ownerName} mob={mob} drive={drive} />}
      {tab === "impuestos"  && <ImpuestosTab  ownerName={ownerName} mob={mob} />}
      {tab === "cuentas"    && <CuentasTab    ownerName={ownerName} mob={mob} />}
      {tab === "gastos"     && <GastosTab     ownerName={ownerName} mob={mob} />}
    </div>
  );
};

// =============================================================================
// OWNER CARD  (list view)
// =============================================================================
const OwnerCard = ({ ownerName, onClick, mob }) => {
  const color      = OWNER_COLORS[ownerName] || C.accent;
  const props      = ownerProps(ownerName);
  const active     = props.filter((p) => !p.sold);
  const sold       = props.filter((p) => p.sold);
  const hasBankFol = !!(OWNER_DRIVE_FOLDERS?.[ownerName]?.drive_folder_id && OWNER_BANK_FOLDERS?.[ownerName]?.subfolder_name);

  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", padding: mob ? "14px 16px" : "16px 20px",
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      cursor: "pointer", transition: "all 0.2s", animation: "fadeIn 0.4s ease both",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}08`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          🏢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: mob ? 15 : 16, fontWeight: 700, color, marginBottom: 5 }}>{ownerName}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text }}>🏠 {active.length} activas</span>
            {sold.length > 0 && <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>· {sold.length} vendidas</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {hasBankFol && <span style={{ fontSize: 14 }} title="Estados de cuenta en Drive">🏦</span>}
          <span style={{ color: C.textDim, fontSize: 14 }}>▸</span>
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// MAIN EXPORT
// =============================================================================
export const OwnersPage = ({ mob, drive, initialOwner, onConsumed }) => {
  const [selected,         setSelected]         = useState(initialOwner || null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [prevOwner,        setPrevOwner]         = useState(null);

  // When initialOwner changes (user clicks owner from PropertiesView), open it
  useEffect(() => {
    if (initialOwner) {
      setSelected(initialOwner);
      setSelectedProperty(null);
      onConsumed && onConsumed();
    }
  }, [initialOwner]);

  if (selectedProperty) {
    return (
      <PropertyDetail
        property={selectedProperty}
        mob={mob}
        drive={drive}
        onBack={() => { setSelectedProperty(null); setSelected(prevOwner); }}
        onOwnerClick={(ownerName) => { setSelectedProperty(null); setSelected(ownerName); }}
      />
    );
  }

  if (selected) {
    return (
      <OwnerPageDetail
        ownerName={selected}
        mob={mob}
        drive={drive}
        onBack={() => setSelected(null)}
        onSelectProperty={(p) => { setPrevOwner(selected); setSelectedProperty(p); }}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 26, fontWeight: 700, color: C.text, marginBottom: 4 }}>🏢 Empresas</h1>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>Documentos, impuestos, cuentas y gastos por empresa.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OWNERS.map((ownerName) => (
          <OwnerCard key={ownerName} ownerName={ownerName} mob={mob} onClick={() => setSelected(ownerName)} />
        ))}
      </div>
    </div>
  );
};
