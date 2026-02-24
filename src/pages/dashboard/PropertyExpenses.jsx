// dashboard/PropertyExpenses.jsx
import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { supaFetch, supaInsert, supaDelete } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { getPropExpenseTypes, MONTHS_SHORT, PROPERTIES } from "./constants";
import { fmtMoney } from "./helpers";

const PropertyExpenses = ({ address, mob }) => {
  const [propExp, setPropExp] = useState([]);
  const [dailyExp, setDailyExp] = useState([]);
  const [taxData, setTaxData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addType, setAddType] = useState(null);
  const [addMonth, setAddMonth] = useState(new Date().getMonth() + 1);
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addAmount, setAddAmount] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewType, setViewType] = useState(null);
  const [viewMonth, setViewMonth] = useState(null); // { month, year }
  const [selectedYear, setSelectedYear] = useState(null); // null = auto-latest

  const types = getPropExpenseTypes(address);
  const personal = address.includes("Progreso") || address.includes("Argo");

  // Map tags → property address + expense type
  const TAG_MAP = {
    "Argo - Agua/Gas": { addr: "232 Argo Avenue", types: ["water", "gas"] },
    "Argo - Agua/Luz": { addr: "232 Argo Avenue", types: ["water", "electricity"] }, // legacy
    "Argo - Luz": { addr: "232 Argo Avenue", types: ["electricity"] },
    "Argo - Mant.": { addr: "232 Argo Avenue", types: ["hoa"] },
    "Progreso - Luz": { addr: "Ave Progreso 15, Depto C101", types: ["electricity"] },
    "Progreso - Agua": { addr: "Ave Progreso 15, Depto C101", types: ["water"] },
    "Progreso - Mant.": { addr: "Ave Progreso 15, Depto C101", types: ["hoa"] },
  };

  // Find tags for this property
  const myTags = Object.entries(TAG_MAP).filter(([, v]) => v.addr === address).map(([tag]) => tag);
  // Also match by owner for US properties
  const ownerTags = ["Mango Nest", "MNA Works", "Tortuga Home"];

  const tagToType = (tag) => {
    const m = TAG_MAP[tag];
    if (m) return m.types[0]; // primary type
    return "hoa"; // owner-based tags → generic
  };

  const loadData = async () => {
    setLoading(true);
    // 1. Structured property expenses
    const pe = await supaFetch("property_expenses", {
      filters: `property_address=eq.${encodeURIComponent(address)}`,
      order: "period_year.desc,period_month.desc",
    });
    setPropExp(pe || []);

    // 2. Property taxes
    const pt = await supaFetch("property_taxes", {
      filters: `property_address=eq.${encodeURIComponent(address)}`,
      order: "tax_year.desc",
    });
    setTaxData(pt || []);

    // 3. Daily expenses with matching tags
    if (myTags.length > 0) {
      const tagFilter = myTags.map(t => `tag.eq.${encodeURIComponent(t)}`).join(",");
      const de = await supaFetch("daily_expenses", {
        filters: `or=(${tagFilter})`,
        order: "expense_date.desc",
      });
      setDailyExp(de || []);
    } else {
      // For US properties, match by owner tag
      const prop = PROPERTIES.find(p => p.address === address);
      if (prop && ownerTags.includes(prop.owner)) {
        const de = await supaFetch("daily_expenses", {
          filters: `tag=eq.${encodeURIComponent(prop.owner)}`,
          order: "expense_date.desc",
        });
        setDailyExp(de || []);
      } else {
        setDailyExp([]);
      }
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, [address]);

  // Normalize daily_expenses into same shape
  const normalizedDaily = dailyExp.map(e => {
    const d = new Date(e.expense_date + "T00:00:00");
    return {
      id: e.id, source: "daily", expense_type: tagToType(e.tag),
      amount: Number(e.amount), period_month: d.getMonth() + 1, period_year: d.getFullYear(),
      notes: e.concept, date: e.expense_date, tag: e.tag, subcategory: e.subcategory,
    };
  });

  const normalizedProp = propExp.map(e => ({
    ...e, source: "property", date: null,
  }));

  const normalizedTax = taxData.filter(t => t.property_tax != null).map(t => ({
    id: `tax-${t.id}`, source: "tax", expense_type: "property_tax",
    amount: Number(t.property_tax), period_month: 1, period_year: t.tax_year,
    notes: `Property Tax ${t.tax_year}`, date: `${t.tax_year}-01-01`,
    appraised_value: t.appraised_value,
  }));

  const allExpenses = [...normalizedProp, ...normalizedDaily, ...normalizedTax];

  const handleAdd = async () => {
    setSaving(true);
    await supaInsert("property_expenses", {
      property_address: address, expense_type: addType,
      amount: parseFloat(addAmount) || 0, period_month: addMonth,
      period_year: addYear, notes: addNotes || null, paid: true,
    });
    await loadData();
    setAdding(false); setSaving(false); setAddAmount(""); setAddNotes("");
  };

  const handleDelete = async (item) => {
    if (item.source === "property") await supaDelete("property_expenses", item.id);
    // Don't delete daily_expenses from here
    await loadData();
  };

  if (loading) return <Card><div style={{ textAlign: "center", padding: 20 }}><Spinner /></div></Card>;

  const totalAll = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // ── LEVEL 2: Month detail ──
  if (viewType && viewMonth) {
    const items = allExpenses.filter(e => e.expense_type === viewType && e.period_month === viewMonth.month && e.period_year === viewMonth.year);
    const ti = types.find(t => t.key === viewType);
    return (
      <Card style={{ marginBottom: 16 }}>
        <button onClick={() => setViewMonth(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.accent, padding: 0, marginBottom: 12 }}>
          ← {ti?.icon} {ti?.label} · {MONTHS_SHORT[viewMonth.month - 1]} {viewMonth.year}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.surface2, borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: e.source === "daily" ? "#A78BFA" : e.source === "tax" ? "#F59E0B" : "#22C55E" }}>{e.source === "daily" ? "📋" : e.source === "tax" ? "🏛️" : "📝"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.notes || "—"}</div>
                {e.date && <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>{e.date}</div>}
                {e.tag && <div style={{ fontFamily: "DM Sans", fontSize: 10, color: "#A78BFA" }}>{e.tag}{e.subcategory ? ` · ${e.subcategory}` : ""}</div>}
                {e.appraised_value && <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.blue }}>Appraised: ${Number(e.appraised_value).toLocaleString()}</div>}
              </div>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap" }}>{fmtMoney(e.amount)}</span>
              {e.source === "property" && <button onClick={() => handleDelete(e)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, padding: "2px 4px" }}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px" }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: C.accent }}>Total: {fmtMoney(items.reduce((s, e) => s + Number(e.amount || 0), 0))}</span>
        </div>
      </Card>
    );
  }

  // ── LEVEL 1: Type detail ──
  if (viewType) {
    const items = allExpenses.filter(e => e.expense_type === viewType);
    const ti = types.find(t => t.key === viewType);
    const isRental = !personal;

    // Group by year
    const byYear = {};
    items.forEach(e => {
      if (!byYear[e.period_year]) byYear[e.period_year] = { items: [], total: 0 };
      byYear[e.period_year].items.push(e);
      byYear[e.period_year].total += Number(e.amount || 0);
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

    // ── Rental properties: year-by-year comparison table ──
    if (isRental) {
      return (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => setViewType(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.accent, padding: 0 }}>
              ← {ti?.icon} {ti?.label}
            </button>
            <Badge color={C.textDim}>{years.length} años</Badge>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: C.textDim, fontWeight: 600, fontSize: 10 }}>AÑO</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: C.textDim, fontWeight: 600, fontSize: 10 }}>MONTO</th>
                  <th style={{ textAlign: "center", padding: "6px 8px", color: C.textDim, fontWeight: 600, fontSize: 10 }}>Δ</th>
                </tr>
              </thead>
              <tbody>
                {years.map((year, yi) => {
                  const cur = byYear[year].total;
                  const prevYear = years[yi + 1];
                  const prev = prevYear ? byYear[prevYear].total : null;
                  const pct = prev ? ((cur - prev) / prev * 100) : null;
                  const isIncome = ti?.income;
                  const pctColor = pct != null ? (isIncome ? (pct > 0 ? C.green : C.red) : (pct > 0 ? C.red : C.green)) : C.textMuted;
                  return (
                    <tr key={year} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600, color: C.text }}>{year}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "JetBrains Mono", fontWeight: 500, color: isIncome ? C.green : C.text }}>{fmtMoney(cur)}</td>
                      <td style={{ padding: "8px", textAlign: "center", fontFamily: "JetBrains Mono", fontSize: 10, color: pctColor }}>{pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      );
    }

    // ── Personal properties: month-by-month detail ──
    const grouped = {};
    items.forEach(e => {
      const key = `${e.period_year}-${String(e.period_month).padStart(2, "0")}`;
      if (!grouped[key]) grouped[key] = { year: e.period_year, month: e.period_month, items: [], total: 0 };
      grouped[key].items.push(e);
      grouped[key].total += Number(e.amount || 0);
    });
    const months = Object.values(grouped).sort((a, b) => b.year - a.year || b.month - a.month);

    return (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setViewType(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.accent, padding: 0 }}>
            ← {ti?.icon} {ti?.label}
          </button>
          <Badge color={C.textDim}>{items.length} pagos</Badge>
        </div>
        {years.map((year, yi) => {
          const ym = months.filter(m => m.year === year);
          const yearTotal = ym.reduce((s, m) => s + m.total, 0);
          const prevYear = years[yi + 1];
          const prevYm = prevYear ? months.filter(m => m.year === prevYear) : [];
          const prevTotal = prevYm.reduce((s, m) => s + m.total, 0);
          const pctChange = prevTotal > 0 ? ((yearTotal - prevTotal) / prevTotal * 100) : null;
          return (
            <div key={year} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>
                <span>{year}</span>
                {pctChange != null && <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: pctChange > 0 ? C.red : pctChange < 0 ? C.green : C.textMuted }}>{pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ym.map(m => (
                  <button key={`${m.year}-${m.month}`} onClick={() => setViewMonth({ month: m.month, year: m.year })} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    background: C.surface2, borderRadius: 6, border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accentGlow}
                    onMouseLeave={e => e.currentTarget.style.background = C.surface2}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, width: 30 }}>{MONTHS_SHORT[m.month - 1]}</span>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: C.text, flex: 1 }}>{fmtMoney(m.total)}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>{m.items.length} item{m.items.length > 1 ? "s" : ""}</span>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>▸</span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 10px" }}>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.accent }}>Subtotal: {fmtMoney(yearTotal)}</span>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 10px", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.accent }}>Total: {fmtMoney(items.reduce((s, e) => s + Number(e.amount || 0), 0))}</span>
        </div>
      </Card>
    );
  }

  // ── LEVEL 0: Summary ──
  const isRental = !personal;
  const availableYears = [...new Set(allExpenses.map(e => e.period_year))].sort((a, b) => b - a);
  const displayYear = isRental ? (selectedYear || availableYears[0] || new Date().getFullYear()) : null;
  const dateStyle = { fontFamily: "DM Sans", fontSize: 12, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6 };

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>💰 Gastos de la Propiedad</div>
        {isRental && availableYears.length > 0 ? (
          <select value={displayYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ ...dateStyle, padding: "4px 8px", fontWeight: 600, color: C.accent, cursor: "pointer" }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : (
          <Badge color={C.textDim}>{allExpenses.length} pagos</Badge>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {types.map(t => {
          const items = allExpenses.filter(e => e.expense_type === t.key);
          const count = items.length;
          const isIncome = t.income;
          const yearItems = isRental ? items.filter(e => e.period_year === displayYear) : items;
          const displayTotal = yearItems.reduce((s, e) => s + Number(e.amount || 0), 0);
          const hasData = yearItems.length > 0;
          return (
            <button key={t.key} onClick={() => count > 0 && setViewType(t.key)} style={{
              padding: "10px 12px", background: isIncome && hasData ? `${C.green}10` : C.surface2, borderRadius: 8,
              border: `1px solid ${isIncome && hasData ? `${C.green}40` : C.border}`, cursor: count > 0 ? "pointer" : "default",
              textAlign: "left", opacity: hasData ? 1 : 0.5, transition: "border-color 0.2s",
            }}
              onMouseEnter={e => count > 0 && (e.currentTarget.style.borderColor = isIncome ? C.green : C.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = isIncome && hasData ? `${C.green}40` : C.border)}>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: isIncome ? C.green : C.textDim }}>{t.icon} {t.label}</div>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: hasData ? (isIncome ? C.green : C.text) : C.textMuted, marginTop: 4 }}>
                {hasData ? fmtMoney(displayTotal) : "—"}
              </div>
              {hasData && !isRental && <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 2 }}>{yearItems.length} pagos</div>}
            </button>
          );
        })}
      </div>

      {allExpenses.length > 0 && (() => {
        const yearExp = isRental ? allExpenses.filter(e => e.period_year === displayYear) : allExpenses;
        const incomeTotal = yearExp.filter(e => types.find(t => t.key === e.expense_type)?.income).reduce((s, e) => s + Number(e.amount || 0), 0);
        const displayTotal = yearExp.reduce((s, e) => s + Number(e.amount || 0), 0);
        const expenseTotal = displayTotal - incomeTotal;
        return (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.accentGlow, borderRadius: 8, marginBottom: incomeTotal > 0 ? 4 : 12 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>{incomeTotal > 0 ? "Gastos" : "Total"}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.accent }}>{fmtMoney(incomeTotal > 0 ? expenseTotal : displayTotal)}</span>
            </div>
            {incomeTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${C.green}12`, borderRadius: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.green }}>Net Income</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: incomeTotal - expenseTotal > 0 ? C.green : C.red }}>{fmtMoney(incomeTotal - expenseTotal)}</span>
              </div>
            )}
          </>
        );
      })()}

      {(dailyExp.length > 0 || taxData.length > 0) && (
        <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginBottom: 8, textAlign: "center" }}>
          {dailyExp.length > 0 && `📋 ${dailyExp.length} gastos diarios`}
          {dailyExp.length > 0 && taxData.length > 0 && " · "}
          {taxData.length > 0 && `🏛️ ${taxData.filter(t => t.property_tax).length} años de impuestos`}
        </div>
      )}

      {adding ? (
        <div style={{ padding: "12px", background: C.surface2, borderRadius: 10, border: `1px solid ${C.accent}40` }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 10 }}>+ Nuevo gasto</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {types.map(t => (
              <button key={t.key} onClick={() => setAddType(t.key)} style={{
                padding: "3px 10px", borderRadius: 12, border: `1px solid ${addType === t.key ? C.accent : C.border}`,
                background: addType === t.key ? C.accentGlow : "transparent", cursor: "pointer",
                fontFamily: "DM Sans", fontSize: 11, color: addType === t.key ? C.accent : C.textDim,
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <select value={addMonth} onChange={e => setAddMonth(parseInt(e.target.value))} style={{ ...dateStyle, padding: "6px 8px" }}>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={addYear} onChange={e => setAddYear(parseInt(e.target.value))} style={{ ...dateStyle, width: 70 }} />
            <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="Monto" step="0.01" style={{ ...dateStyle, flex: 1, minWidth: 80 }} />
            <input type="text" value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notas" style={{ ...dateStyle, flex: 1, minWidth: 80 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleAdd} disabled={saving || !addAmount} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer", opacity: !addAmount ? 0.5 : 1 }}>{saving ? "..." : "Agregar"}</button>
            <button onClick={() => setAdding(false)} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setAddType(types[0]?.key); }} style={{ padding: "8px 14px", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.textDim, width: "100%", textAlign: "center" }}>+ Agregar gasto</button>
      )}
    </Card>
  );
};


export default PropertyExpenses;
