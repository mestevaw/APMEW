// dashboard/OwnerDetail.jsx
import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { PROPERTIES, OWNER_COLORS, getPropExpenseTypes } from "./constants";
import { fmtMoney } from "./helpers";
import { HouseIcon } from "./icons";

const OwnerDetail = ({ ownerName, mob, onBack, onSelectProperty }) => {
  const [expByType, setExpByType] = useState({});
  const [loading, setLoading] = useState(true);
  const [ownerYear, setOwnerYear] = useState(null);
  const ownerProps = PROPERTIES.filter(p => p.owner === ownerName);
  const types = getPropExpenseTypes(ownerProps[0]?.address || "");
  const personal = ownerProps[0]?.address.includes("Progreso") || ownerProps[0]?.address.includes("Argo");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const allItems = [];
      // Fetch all properties in parallel
      const results = await Promise.all(ownerProps.map(p => Promise.all([
        supaFetch("property_expenses", { filters: `property_address=eq.${encodeURIComponent(p.address)}`, order: "period_year.desc" }),
        supaFetch("property_taxes", { filters: `property_address=eq.${encodeURIComponent(p.address)}`, order: "tax_year.desc" }),
      ])));
      results.forEach(([propExp, taxData]) => {
        (propExp || []).forEach(e => allItems.push({ ...e, amount: Number(e.amount || 0) }));
        (taxData || []).filter(t => t.property_tax != null).forEach(t => allItems.push({
          expense_type: "property_tax", amount: Number(t.property_tax), period_year: t.tax_year, period_month: 1,
        }));
      });
      // Group by type + year
      const grouped = {};
      allItems.forEach(e => {
        const key = e.expense_type;
        if (!grouped[key]) grouped[key] = {};
        if (!grouped[key][e.period_year]) grouped[key][e.period_year] = 0;
        grouped[key][e.period_year] += e.amount;
      });
      setExpByType(grouped);
      setLoading(false);
    };
    load();
  }, [ownerName]);

  const years = [...new Set(Object.values(expByType).flatMap(y => Object.keys(y)))].map(Number).sort((a, b) => b - a);
  const displayYear = ownerYear || years[0] || new Date().getFullYear();
  const isRental = !personal;
  const selectStyle = { fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: C.surface2, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: OWNER_COLORS[ownerName] || C.accent, fontSize: 20 }}>🏢</span>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 22, fontWeight: 700, color: C.text }}>{ownerName}</h1>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{ownerProps.filter(p => !p.sold).length} propiedades activas{ownerProps.filter(p => p.sold).length > 0 ? ` · ${ownerProps.filter(p => p.sold).length} vendidas` : ""}</span>
        </div>
      </div>

      {loading ? <Card style={{ textAlign: "center", padding: 30 }}><Spinner /></Card> : (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>📊 Resumen</div>
            {years.length > 0 && (
              <select value={displayYear} onChange={e => setOwnerYear(Number(e.target.value))} style={selectStyle}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {types.map(t => {
              const yearData = expByType[t.key] || {};
              const val = yearData[displayYear] || 0;
              const hasData = val > 0;
              const isIncome = t.income;
              return (
                <div key={t.key} style={{
                  padding: "10px 12px", background: isIncome && hasData ? `${C.green}10` : C.surface2, borderRadius: 8,
                  border: `1px solid ${isIncome && hasData ? `${C.green}40` : C.border}`,
                  textAlign: "left", opacity: hasData ? 1 : 0.5,
                }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: isIncome ? C.green : C.textDim }}>{t.icon} {t.label}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: hasData ? (isIncome ? C.green : C.text) : C.textMuted, marginTop: 4 }}>
                    {hasData ? fmtMoney(val) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {(() => {
            const incomeTotal = types.filter(t => t.income).reduce((s, t) => s + ((expByType[t.key] || {})[displayYear] || 0), 0);
            const expTotal = types.filter(t => !t.income).reduce((s, t) => s + ((expByType[t.key] || {})[displayYear] || 0), 0);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.accentGlow, borderRadius: 8, marginBottom: incomeTotal > 0 ? 4 : 8 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Gastos</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.accent }}>{fmtMoney(expTotal)}</span>
                </div>
                {incomeTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${C.green}12`, borderRadius: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.green }}>Net Income</span>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: incomeTotal - expTotal > 0 ? C.green : C.red }}>{fmtMoney(incomeTotal - expTotal)}</span>
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      )}

      {/* Property list */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>🏠 Propiedades</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {ownerProps.filter(p => !p.sold).map(p => {
            const rents = (expByType["gross_rents"] || {})[displayYear] ? "—" : "";
            return (
              <button key={p.address} onClick={() => onSelectProperty(p)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                background: C.surface2, borderRadius: 8, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.accentGlow}
                onMouseLeave={e => e.currentTarget.style.background = C.surface2}>
                <span style={{ color: OWNER_COLORS[p.owner] || C.accent }}><HouseIcon /></span>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{p.address}</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}>▸</span>
              </button>
            );
          })}
          {ownerProps.filter(p => p.sold).length > 0 && (
            <>
              <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 8, marginBottom: 4 }}>VENDIDAS</div>
              {ownerProps.filter(p => p.sold).map(p => (
                <button key={p.address} onClick={() => onSelectProperty(p)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                  background: C.surface2, borderRadius: 8, border: "none", cursor: "pointer", width: "100%", textAlign: "left", opacity: 0.6,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accentGlow}
                  onMouseLeave={e => e.currentTarget.style.background = C.surface2}>
                  <span style={{ color: C.textDim }}><HouseIcon /></span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 400, color: C.textDim, flex: 1 }}>{p.address}</span>
                  <span style={{ color: C.textMuted, fontSize: 12 }}>▸</span>
                </button>
              ))}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};


export default OwnerDetail;
