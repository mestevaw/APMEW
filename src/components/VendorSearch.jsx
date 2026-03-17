// ═══════════════════════════════════════════
// Archivo: src/components/VendorSearch.jsx
// Versión: V2
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - DUPLICADO FIX: eliminada definición local de MONTHS_ES;
//   ahora se importa MONTHS_SHORT desde dashboard/constants
//   (fuente canónica para meses capitalizados en display)
// ═══════════════════════════════════════════

import { useState, useRef, useEffect } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { supaFetch } from "../lib/supabase";
import { PROPERTIES, OWNER_COLORS, MONTHS_SHORT } from "../pages/dashboard/constants";  // ← FIX V2
import { fmtMoney } from "../pages/dashboard/helpers";

const formatPeriod = (month, year) => {
  if (!month && !year) return "—";
  if (!month) return String(year);
  return `${MONTHS_SHORT[(month || 1) - 1]} ${year}`;
};

const TYPE_LABELS = {
  hoa:          "HOA",
  insurance:    "Seguro",
  maintenance:  "Mantenimiento",
  utilities:    "Servicios",
  management:   "Administración",
  mortgage:     "Hipoteca",
  property_tax: "Predial",
  other:        "Otro",
};

export const VendorSearch = ({ onClose }) => {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal]       = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(false);
    setResults([]);

    try {
      const [propExp, dailyExp] = await Promise.all([
        supaFetch("property_expenses", {
          filters: `notes=ilike.*${encodeURIComponent(q)}*`,
          order: "period_year.desc,period_month.desc",
        }),
        supaFetch("daily_expenses", {
          filters: `or=(concept=ilike.*${encodeURIComponent(q)}*,subcategory=ilike.*${encodeURIComponent(q)}*)`,
          order: "expense_date.desc",
        }),
      ]);

      const propRows = (propExp || []).map(e => ({
        id:       `pe-${e.id}`,
        source:   "property",
        address:  e.property_address,
        type:     TYPE_LABELS[e.expense_type] || e.expense_type,
        amount:   Number(e.amount),
        period:   formatPeriod(e.period_month, e.period_year),
        label:    e.notes || e.expense_type,
        owner:    PROPERTIES.find(p => p.address === e.property_address)?.owner || "",
      }));

      const dailyRows = (dailyExp || []).map(e => {
        const prop = PROPERTIES.find(p =>
          p.address === e.subcategory ||
          p.owner === e.tag ||
          (e.subcategory && p.address.toLowerCase().includes((e.subcategory || "").toLowerCase()))
        );
        const d = new Date(e.expense_date + "T00:00:00");
        return {
          id:      `de-${e.id}`,
          source:  "daily",
          address: prop?.address || e.tag || "General",
          type:    e.tag || "Gasto diario",
          amount:  Number(e.amount),
          period:  `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`,
          label:   [e.concept, e.subcategory].filter(Boolean).join(" · "),
          owner:   prop?.owner || "",
        };
      });

      const all = [...propRows, ...dailyRows];
      const grandTotal = all.reduce((s, r) => s + r.amount, 0);

      setResults(all);
      setTotal(grandTotal);
    } catch (err) {
      console.error("[VendorSearch]", err);
    }

    setLoading(false);
    setSearched(true);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") search();
  };

  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.address]) grouped[r.address] = { rows: [], total: 0, owner: r.owner };
    grouped[r.address].rows.push(r);
    grouped[r.address].total += r.amount;
  });

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 9999, padding: "40px 16px 24px",
      overflowY: "auto",
    }}>
      <Card style={{ maxWidth: 700, width: "100%", padding: 24 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            🔍 Buscar por Proveedor
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            background: C.surface2, border: `1px solid ${query ? C.accent : C.border}`,
            borderRadius: 10, transition: "border-color 0.2s",
          }}>
            <span style={{ fontSize: 18 }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Nombre del proveedor, concepto, categoría..."
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
                style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 16 }}>✕</button>
            )}
          </div>
          <button
            onClick={search}
            disabled={!query.trim() || loading}
            style={{
              padding: "10px 20px",
              background: query.trim() ? C.accent : C.border,
              color: "white", border: "none", borderRadius: 10,
              fontFamily: "DM Sans", fontSize: 14, fontWeight: 700,
              cursor: query.trim() ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            Buscar
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner />
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 10 }}>
              Buscando en todas las propiedades...
            </div>
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
            No se encontraron gastos con "<strong style={{ color: C.text }}>{query}</strong>"
          </div>
        )}

        {results.length > 0 && !loading && (
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", marginBottom: 16,
              background: `${C.accent}10`, border: `1px solid ${C.accent}40`,
              borderRadius: 10,
            }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text }}>
                <strong>{results.length}</strong>
                <span style={{ color: C.textDim }}> resultados en </span>
                <strong>{Object.keys(grouped).length}</strong>
                <span style={{ color: C.textDim }}> propiedades</span>
              </div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700, color: C.green }}>
                {fmtMoney(total)}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Object.entries(grouped)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([address, group]) => {
                  const ownerColor = OWNER_COLORS[group.owner] || C.textDim;
                  return (
                    <div key={address}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "baseline",
                        padding: "6px 10px", marginBottom: 6,
                        borderLeft: `3px solid ${ownerColor}`,
                        paddingLeft: 10,
                      }}>
                        <div>
                          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, color: C.text }}>
                            {address}
                          </span>
                          {group.owner && (
                            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: ownerColor, marginLeft: 8 }}>
                              {group.owner}
                            </span>
                          )}
                        </div>
                        <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.green }}>
                          {fmtMoney(group.total)}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {group.rows.map(row => (
                          <div key={row.id} style={{
                            display: "flex", gap: 10, alignItems: "center",
                            padding: "8px 12px",
                            background: C.surface2, border: `1px solid ${C.border}`,
                            borderRadius: 8,
                          }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 10,
                              background: `${C.accent}15`,
                              fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: C.accent,
                              whiteSpace: "nowrap",
                            }}>
                              {row.type}
                            </span>
                            <span style={{ flex: 1, fontFamily: "DM Sans", fontSize: 12, color: C.text,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.label}
                            </span>
                            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, whiteSpace: "nowrap" }}>
                              {row.period}
                            </span>
                            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>
                              {fmtMoney(row.amount)}
                            </span>
                            <span style={{
                              fontSize: 9, padding: "1px 5px", borderRadius: 4,
                              background: row.source === "daily" ? `${C.blue}20` : `${C.green}15`,
                              color: row.source === "daily" ? C.blue : C.green,
                            }}>
                              {row.source === "daily" ? "diario" : "prop"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

      </Card>
    </div>
  );
};
