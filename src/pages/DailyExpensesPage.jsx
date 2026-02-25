// ═══════════════════════════════════════════
// Archivo: src/pages/DailyExpensesPage.jsx
// Versión: 2
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C, inputStyle } from "../lib/theme";
import { fmtMoney, fmtDateShort, detectCountry } from "../lib/helpers";
import { supaUpdate, supaBatchInsert, supaBatchUpdate } from "../lib/supabase";
import { parseFileToRows, autoMapRow } from "../lib/parsers";
import { Card, SectionTitle, Badge, Btn } from "../components/UI";
import { useToast } from "../components/Toast";

// ─── Subcomponentes extraídos ───
import EditModal from "./daily/EditModal";
import ComparisonPanel from "./daily/ComparisonPanel";
import {
  CATEGORIES, displayCat, displayWho, isPayment, displayConcept,
  amountColor, shortCardLabel, Flag, dateStyle,
  DropMenu, MenuBtn, MenuDivider, MenuLabel, CloseBtn,
} from "./daily/shared";

// ─── Export CSV ───
const exportToExcel = (data) => {
  const BOM = "\uFEFF";
  const h = "Fecha,Concepto,Categoría,Quién,Monto,Tarjeta,Tag,Subcategoría,País\n";
  const rows = data.map(e =>
    `${e.expense_date},"${(displayConcept(e)).replace(/"/g, '""')}",${e.category},${e.who},${Number(e.amount).toFixed(2)},${e.source || ""},${e.tag || ""},${e.subcategory || ""},${e.country || detectCountry(e)}`
  ).join("\n");
  const blob = new Blob([BOM + h + rows], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export const DailyExpensesPage = ({ dailyExpenses, onAdd, mob, reload }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [form, setForm] = useState({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "", country: "US" });
  const [sortCol, setSortCol] = useState("expense_date");
  const [sortDir, setSortDir] = useState("desc");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [qPlace, setQPlace] = useState("");
  const [qConcept, setQConcept] = useState("");
  const [qFrom, setQFrom] = useState("");
  const [qTo, setQTo] = useState("");
  const [sumFrom, setSumFrom] = useState("");
  const [sumTo, setSumTo] = useState("");
  const [applying, setApplying] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const openPanel = (p) => { setPanel(panel === p ? null : p); setMenuOpen(false); };

  // ─── Formulario ───
  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "", country: "US" });
    setPanel(null);
  };

  // ─── Importar archivo ───
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await parseFileToRows(file);
      const mapped = rows.map(autoMapRow).filter(Boolean);
      if (mapped.length > 0) {
        const visa = mapped.filter(r => r.source === "Capital One Visa").length;
        const amex = mapped.filter(r => r.source === "AmEx").length;
        setImportData(mapped);
        setImportMsg(`${mapped.length} transacciones (${visa > 0 ? visa + " VISA" : ""}${visa > 0 && amex > 0 ? ", " : ""}${amex > 0 ? amex + " AMEX" : ""})`);
      } else {
        setImportMsg(`No se encontraron transacciones válidas (${rows.length} filas leídas)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error leyendo archivo: " + err.message);
      setImportMsg("Error: " + err.message);
    }
    e.target.value = "";
  };

  const executeImport = async () => {
    if (!importData) return;
    setImporting(true);
    let count = 0, skipped = 0;
    const existing = new Set();
    for (const e of dailyExpenses) {
      existing.add(`${e.expense_date}|${(e.concept || "").slice(0, 40).toLowerCase()}|${Number(e.amount).toFixed(2)}`);
    }
    const newRows = [];
    for (const row of importData) {
      const key = `${row.expense_date}|${(row.concept || "").slice(0, 40).toLowerCase()}|${Number(row.amount).toFixed(2)}`;
      if (existing.has(key)) { skipped++; continue; }
      newRows.push(row);
      existing.add(key);
    }
    const BATCH_SIZE = 50;
    for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
      const batch = newRows.slice(i, i + BATCH_SIZE);
      try { await supaBatchInsert("daily_expenses", batch); count += batch.length; }
      catch (e) { console.error("Batch insert error:", e); toast.error("Error en importación parcial"); }
      setImportMsg(`Procesando... ${count} nuevas, ${skipped} existentes`);
    }
    setImportMsg(`✓ ${count} importadas${skipped > 0 ? `, ${skipped} ya existían` : ""}`);
    if (count > 0) toast.success(`${count} gastos importados`);
    setImportData(null);
    setImporting(false);
    if (count > 0) reload();
  };

  // ─── Tag / subcategory batch update ───
  const applyToMatching = async (expense, field, value) => {
    setApplying(true);
    const cpt = (expense.concept || "").trim();
    try {
      await supaBatchUpdate("daily_expenses", `concept=eq.${encodeURIComponent(cpt)}`, { [field]: value });
      toast.success(`${field} actualizado para gastos similares`);
    } catch (e) {
      console.error("Batch update error:", e);
      toast.error("Error actualizando gastos");
    }
    setApplying(false);
    setEditingExpense(null);
    reload();
  };

  const applySingle = async (id, field, value) => {
    try {
      await supaUpdate("daily_expenses", id, { [field]: value });
    } catch (e) {
      toast.error("Error actualizando gasto");
    }
    setEditingExpense(null);
    reload();
  };

  // ─── Sort ───
  const doSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "expense_date" ? "desc" : "asc"); }
    setMenuOpen(false);
  };

  // ─── Filter + Search ───
  const availableYears = [...new Set(dailyExpenses.map(e => e.expense_date ? e.expense_date.slice(0, 4) : null).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const availableMonths = filterYear === "all" ? [] : [...new Set(dailyExpenses.filter(e => e.expense_date && e.expense_date.startsWith(filterYear)).map(e => e.expense_date.slice(5, 7)))].sort((a, b) => b.localeCompare(a));
  const allCats = [...new Set(dailyExpenses.map(e => e.category).filter(Boolean))].sort();

  let filtered = filterYear === "all" ? dailyExpenses : dailyExpenses.filter(e => e.expense_date && e.expense_date.startsWith(filterYear));
  if (filterMonth !== "all") filtered = filtered.filter(e => e.expense_date && e.expense_date.slice(5, 7) === filterMonth);
  filtered = filterCat === "all" ? filtered : filtered.filter(e => e.category === filterCat);

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(e =>
      (e.concept || "").toLowerCase().includes(q) || (e.category || "").toLowerCase().includes(q) ||
      (e.source || "").toLowerCase().includes(q) || (e.tag || "").toLowerCase().includes(q) ||
      (e.who || "").toLowerCase().includes(q) || (e.subcategory || "").toLowerCase().includes(q) ||
      (q === "mx" && (e.country || detectCountry(e)) === "MX") ||
      (q === "us" && (e.country || detectCountry(e)) === "US") ||
      ((q === "mexico" || q === "méxico") && (e.country || detectCountry(e)) === "MX")
    );
  }

  if (panel === "summary") {
    if (sumFrom) filtered = filtered.filter(e => e.expense_date >= sumFrom);
    if (sumTo)   filtered = filtered.filter(e => e.expense_date <= sumTo);
  }

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "amount") { va = Number(va) || 0; vb = Number(vb) || 0; }
    else { va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase(); }
    return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  });

  const total    = filtered.reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
  const payments = filtered.reduce((s, e) => s + Math.min(0, Number(e.amount) || 0), 0);

  // Summary by category
  const catSummary = {};
  filtered.forEach(e => { const c = e.category || "otro"; if (!catSummary[c]) catSummary[c] = { count: 0, total: 0 }; catSummary[c].count++; catSummary[c].total += Number(e.amount) || 0; });
  const catSumSorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);

  // Query
  let queryResults = [];
  if (panel === "query" && (qPlace || qConcept || qFrom || qTo)) {
    queryResults = dailyExpenses.filter(e => {
      if (qPlace && !(e.concept || "").toLowerCase().includes(qPlace.toLowerCase())) return false;
      if (qConcept && !(e.concept || "").toLowerCase().includes(qConcept.toLowerCase()) && !(e.tag || "").toLowerCase().includes(qConcept.toLowerCase())) return false;
      if (qFrom && e.expense_date < qFrom) return false;
      if (qTo && e.expense_date > qTo) return false;
      return true;
    });
  }
  const queryTotal = queryResults.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const sortLabels = { expense_date: "Fecha", concept: "Concepto", category: "Cat.", amount: "Monto", source: "Tarj.", who: "Quién" };
  const matchCount = editingExpense ? dailyExpenses.filter(e => (e.concept || "").trim().toLowerCase() === (editingExpense.concept || "").trim().toLowerCase()).length : 0;

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text }}>Gastos del Día a Día</h1>
          <p style={{ fontFamily: "DM Sans", fontSize: mob ? 11 : 13, color: C.textDim, marginTop: 2 }}>
            {filtered.length} registros · <span style={{ color: C.red, fontFamily: "JetBrains Mono" }}>{fmtMoney(total)}</span>
            {payments < 0 && <> · <span style={{ color: C.green, fontFamily: "JetBrains Mono" }}>{fmtMoney(payments)}</span></>}
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: menuOpen ? C.accentGlow : "none", border: `1px solid ${menuOpen ? C.accent : C.border}`, cursor: "pointer", padding: "8px 10px", borderRadius: 8, color: menuOpen ? C.accent : C.text, display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <DropMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuLabel>Ordenar</MenuLabel>
            {Object.entries(sortLabels).map(([col, label]) => <MenuBtn key={col} onClick={() => doSort(col)} active={sortCol === col}>{label} {sortCol === col && (sortDir === "asc" ? "▲" : "▼")}</MenuBtn>)}
            <MenuDivider />
            <MenuLabel>Excel</MenuLabel>
            <MenuBtn onClick={() => openPanel("import")}>📥 Importar</MenuBtn>
            <MenuBtn onClick={() => { exportToExcel(sorted); setMenuOpen(false); }}>📊 Exportar</MenuBtn>
            <MenuBtn onClick={() => openPanel("form")}>✏️ Registrar</MenuBtn>
            <MenuDivider />
            <MenuBtn onClick={() => openPanel("summary")}>📋 Resumen</MenuBtn>
            <MenuBtn onClick={() => openPanel("query")}>🔍 Consulta</MenuBtn>
            <MenuBtn onClick={() => openPanel("comparison")}>🇺🇸🇲🇽 EUA vs México</MenuBtn>
          </DropMenu>
        </div>
      </div>

      {/* SEARCH + YEAR/MONTH FILTER */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 10, alignItems: "center" }}>
        <input placeholder="🔍 Buscar concepto, categoría, tarjeta, tag..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "8px 14px" }} />
        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, whiteSpace: "nowrap" }}>Año:</span>
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("all"); }} style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: C.surface2, color: filterYear === "all" ? C.textDim : C.accent, border: `1px solid ${filterYear === "all" ? C.border : C.accent}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", minWidth: 72 }}>
          <option value="all">Todos</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, whiteSpace: "nowrap" }}>Mes:</span>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} disabled={filterYear === "all"} style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, background: C.surface2, color: filterMonth === "all" ? C.textDim : C.accent, border: `1px solid ${filterMonth === "all" ? C.border : C.accent}`, borderRadius: 8, padding: "8px 10px", cursor: filterYear === "all" ? "not-allowed" : "pointer", opacity: filterYear === "all" ? 0.4 : 1, minWidth: 72 }}>
          <option value="all">Todos</option>
          {availableMonths.map(m => <option key={m} value={m}>{MONTH_NAMES[parseInt(m) - 1]}</option>)}
        </select>
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setFilterCat("all")} style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${filterCat === "all" ? C.accent : C.border}`, background: filterCat === "all" ? C.accentGlow : "transparent", cursor: "pointer", fontFamily: "DM Sans", fontSize: 11, color: filterCat === "all" ? C.accent : C.textDim }}>Todas</button>
        {allCats.map(cat => <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${filterCat === cat ? C.blue : C.border}`, background: filterCat === cat ? `${C.blue}18` : "transparent", cursor: "pointer", fontFamily: "DM Sans", fontSize: 11, color: filterCat === cat ? C.blue : C.textDim }}>{displayCat(cat)}</button>)}
      </div>

      {/* ═══ SUMMARY ═══ */}
      {panel === "summary" && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle style={{ margin: 0 }}>Resumen por Categoría</SectionTitle>
            <CloseBtn onClick={() => setPanel(null)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div><label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Desde</label><input type="date" value={sumFrom} onChange={e => setSumFrom(e.target.value)} style={dateStyle} /></div>
            <div><label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Hasta</label><input type="date" value={sumTo} onChange={e => setSumTo(e.target.value)} style={dateStyle} /></div>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 10 }}>{filtered.length} registros en este rango</p>
          {catSumSorted.map(([cat, data]) => {
            const pctVal = total > 0 ? (Math.max(0, data.total) / total * 100) : 0;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, width: mob ? 90 : 120 }}>{displayCat(cat)}</span>
                <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pctVal}%`, height: "100%", background: data.total < 0 ? C.green : C.blue, borderRadius: 4 }} /></div>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: data.total < 0 ? C.green : C.red, textAlign: "right", minWidth: 90 }}>{fmtMoney(data.total)}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, minWidth: 30, textAlign: "right" }}>{data.count}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px 4px", borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>Total</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.red }}>{fmtMoney(total + payments)}</span>
          </div>
        </Card>
      )}

      {/* ═══ QUERY ═══ */}
      {panel === "query" && (
        <Card style={{ marginBottom: 16, borderColor: "#A78BFA" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle style={{ margin: 0 }}>🔍 Consulta</SectionTitle>
            <CloseBtn onClick={() => setPanel(null)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <input placeholder="Lugar / comercio" value={qPlace} onChange={e => setQPlace(e.target.value)} style={inputStyle} />
            <input placeholder="Concepto / tag" value={qConcept} onChange={e => setQConcept(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Desde</label><input type="date" value={qFrom} onChange={e => setQFrom(e.target.value)} style={dateStyle} /></div>
            <div><label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>Hasta</label><input type="date" value={qTo} onChange={e => setQTo(e.target.value)} style={dateStyle} /></div>
          </div>
          {queryResults.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>{queryResults.length} resultados</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: C.red }}>{fmtMoney(queryTotal)}</span>
              </div>
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                {queryResults.slice(0, 30).map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                    <span style={{ fontFamily: "JetBrains Mono", color: C.textDim, marginRight: 8, flexShrink: 0 }}>{fmtDateShort(e.expense_date)}</span>
                    <span style={{ fontFamily: "DM Sans", color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concept}</span>
                    <span style={{ fontFamily: "JetBrains Mono", color: C.red, marginLeft: 8, flexShrink: 0 }}>{fmtMoney(Number(e.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ═══ COMPARISON — subcomponente ═══ */}
      {panel === "comparison" && (
        <ComparisonPanel dailyExpenses={dailyExpenses} onClose={() => setPanel(null)} />
      )}

      {/* ═══ FORM ═══ */}
      {panel === "form" && (
        <Card style={{ marginBottom: 16, borderColor: C.accent }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle style={{ margin: 0 }}>Nuevo Gasto</SectionTitle>
            <CloseBtn onClick={() => setPanel(null)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Concepto" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} style={inputStyle} />
            <input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: "JetBrains Mono" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr 1fr auto", gap: 12, marginBottom: 16 }}>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            <select value={form.who} onChange={e => setForm({ ...form, who: e.target.value })} style={inputStyle}><option>Miguel</option><option>AnaP</option><option>Ambos</option></select>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select>
            <input placeholder="Fuente" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={inputStyle} />
            <button onClick={() => setForm({ ...form, country: form.country === "US" ? "MX" : "US" })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 18, lineHeight: 1 }} title={form.country === "MX" ? "México" : "EUA"}>{form.country === "MX" ? "🇲🇽" : "🇺🇸"}</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}><Btn onClick={handleSubmit}>Guardar</Btn><Btn onClick={() => setPanel(null)} outline>Cancelar</Btn></div>
        </Card>
      )}

      {/* ═══ IMPORT ═══ */}
      {panel === "import" && (
        <Card style={{ marginBottom: 16, borderColor: C.blue }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle style={{ margin: 0 }}>Importar</SectionTitle>
            <CloseBtn onClick={() => setPanel(null)} />
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 12 }}>Auto-detecta VISA o AMEX. Soporta .csv, .xlsx, .xls</p>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()}>📁 Seleccionar Archivo</Btn>
          {importMsg && <p style={{ fontFamily: "DM Sans", fontSize: 13, color: importMsg.startsWith("✓") ? C.green : importMsg.startsWith("Error") ? C.red : C.accent, marginTop: 12 }}>{importMsg}</p>}
          {importData && <div style={{ marginTop: 12, display: "flex", gap: 10 }}><Btn onClick={executeImport} disabled={importing}>{importing ? "Importando..." : `Importar ${importData.length}`}</Btn><Btn onClick={() => { setImportData(null); setImportMsg(""); }} outline>Cancelar</Btn></div>}
        </Card>
      )}

      {/* ═══ EDIT MODAL — subcomponente ═══ */}
      <EditModal
        expense={editingExpense}
        matchCount={matchCount}
        onApplyBatch={applyToMatching}
        onApplySingle={applySingle}
        onClose={() => setEditingExpense(null)}
        applying={applying}
        mob={mob}
      />

      {/* ═══ TABLE ═══ */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📝</div><p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos</p></div>
        ) : mob ? (
          /* ═══ MOBILE VIEW ═══ */
          <div style={{ maxHeight: "55vh", overflow: "auto" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, padding: "8px 12px", borderBottom: `2px solid ${C.border}` }}><span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{sorted.length} gastos</span></div>
            {sorted.map((e, i) => {
              const pay = isPayment(e);
              return (
                <div key={e.id || i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }} onClick={() => e.id && setEditingExpense(e)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: pay ? C.green : C.text, fontWeight: pay ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{displayConcept(e)}</span>
                    <Flag country={e.country || detectCountry(e)} />
                    <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim, flexShrink: 0 }}>{shortCardLabel(e.source)}</span>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: amountColor(e), flexShrink: 0 }}>{pay ? "+" : ""}{fmtMoney(Math.abs(Number(e.amount)))}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "DM Sans", fontSize: 10, color: C.textDim }}>
                    <span>{fmtDateShort(e.expense_date)}</span>
                    <Badge color={C.blue} style={{ fontSize: 8 }}>{displayCat(e.category)}</Badge>
                    {e.subcategory && <Badge color="#A78BFA" style={{ fontSize: 8 }}>{e.subcategory}</Badge>}
                    {e.tag && <Badge color="#10B981" style={{ fontSize: 8 }}>{e.tag}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ DESKTOP VIEW ═══ */
          <div style={{ maxHeight: "65vh", overflow: "auto" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 46px 20px 30px 26px 90px 66px", gap: 4, padding: "10px 8px", borderBottom: `2px solid ${C.border}`, alignItems: "center" }}>
              <button onClick={() => doSort("expense_date")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: sortCol === "expense_date" ? C.accent : C.textDim, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 2, padding: 0 }}>Fecha{sortCol === "expense_date" && <span style={{ fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}</button>
              <button onClick={() => doSort("concept")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: sortCol === "concept" ? C.accent : C.textDim, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 2, padding: 0 }}>Concepto{sortCol === "concept" && <span style={{ fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}</button>
              <button onClick={() => doSort("category")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: sortCol === "category" ? C.accent : C.textDim, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 2, padding: 0 }}>Cat.{sortCol === "category" && <span style={{ fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}</button>
              <span style={{ fontSize: 10, textAlign: "center" }}>🌎</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim, textAlign: "center" }}>💳</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim, textAlign: "center" }}>👤</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim }}>Info</span>
              <button onClick={() => doSort("amount")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: sortCol === "amount" ? C.accent : C.textDim, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 2, padding: 0, justifyContent: "flex-end" }}>Monto{sortCol === "amount" && <span style={{ fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}</button>
            </div>
            {sorted.map((e, i) => {
              const pay = isPayment(e);
              return (
                <div key={e.id || i} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 46px 20px 30px 26px 90px 66px", gap: 4, padding: "6px 8px", alignItems: "center", cursor: "pointer" }}
                  onClick={() => e.id && setEditingExpense(e)}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.surface2} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim }}>{fmtDateShort(e.expense_date)}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: pay ? C.green : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: pay ? 600 : 400 }}>{(displayConcept(e) || "").slice(0, 40)}</span>
                  <Badge color={C.blue} style={{ fontSize: 9 }}>{displayCat(e.category)}</Badge>
                  <Flag country={e.country || detectCountry(e)} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim, textAlign: "center" }}>{shortCardLabel(e.source)}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, textAlign: "center" }}>{displayWho(e.who)}</span>
                  <div style={{ display: "flex", gap: 2, flexWrap: "nowrap", overflow: "hidden" }}>
                    {e.subcategory && <Badge color="#A78BFA" style={{ fontSize: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{e.subcategory}</Badge>}
                    {e.tag && <Badge color="#10B981" style={{ fontSize: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{e.tag}</Badge>}
                    {!e.subcategory && !e.tag && <span style={{ color: C.textMuted, fontSize: 10 }}>—</span>}
                  </div>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: amountColor(e), textAlign: "right" }}>{pay ? "+" : ""}{fmtMoney(Math.abs(Number(e.amount)))}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
