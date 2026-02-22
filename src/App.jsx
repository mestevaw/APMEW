// Archivo: src/pages/DailyExpensesPage.jsx
// Versión: 3.0
// Fecha: 2026-02-22

import { useState, useRef } from "react";
import { C, inputStyle } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaInsert } from "../lib/supabase";
import { Card, SectionTitle, Badge, Btn, Spinner } from "../components/UI";

// ─── Date formatter: "22 feb 26" ───
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  const day = dt.getDate();
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${day} ${months[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
};

// ─── Card logos ───
const CardLogo = ({ source }) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return (
    <span title="Capital One Visa" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#1a1f71", background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #1a1f71", lineHeight: "14px" }}>VISA</span>
  );
  if (s.includes("amex") || s.includes("american")) return (
    <span title="American Express" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#006FCF", padding: "1px 5px", borderRadius: 3, lineHeight: "14px" }}>AMEX</span>
  );
  if (s.includes("master")) return (
    <span title="Mastercard" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#EB001B", padding: "1px 5px", borderRadius: 3, lineHeight: "14px" }}>MC</span>
  );
  return source ? <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim }}>{source}</span> : null;
};

// ─── Payment detection ───
const isPayment = (e) => (e.category === "otro" || e.category === "Otro") && Number(e.amount) < 0;
const displayConcept = (e) => isPayment(e) ? "Pago" : e.concept;
const amountColor = (e) => isPayment(e) ? C.green : C.red;

// ─── CSV/Excel parser ───
const parseCSV = (text) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]*)/g) || [];
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || "").replace(/^"|"$/g, "").trim());
    return obj;
  });
};

const mapCapitalOne = (row) => {
  const catMap = { "Dining": "restaurantes", "Merchandise": "hogar", "Other Travel": "transporte", "Entertainment": "entretenimiento", "Health Care": "salud", "Other Services": "servicios", "Gas/Automotive": "transporte", "Phone/Cable": "servicios", "Insurance": "servicios", "Utilities": "servicios", "Payment/Credit": "otro", "Airfare": "transporte", "Lodging": "transporte", "Other": "otro", "Internet": "servicios", "Professional Services": "servicios", "Car Rental": "transporte", "Fee/Interest Charge": "otro" };
  const date = row["Transaction Date"] || "";
  const desc = row["Description"] || "";
  const cat = catMap[row["Category"]] || "otro";
  const debit = parseFloat(row["Debit"]) || 0;
  const credit = parseFloat(row["Credit"]) || 0;
  const amount = debit > 0 ? debit : (credit > 0 ? -credit : 0);
  if (!date || amount === 0) return null;
  return { expense_date: date.slice(0, 10), concept: desc, category: cat, who: "Miguel", amount, payment_method: "tarjeta", source: "Capital One Visa" };
};

const mapAmex = (row) => {
  const date = row["Date"] || row["Fecha"] || "";
  const desc = row["Description"] || row["Descripcion"] || row["Descripción"] || "";
  const amount = parseFloat(row["Amount"] || row["Monto"] || 0);
  if (!date || amount === 0) return null;
  return { expense_date: date.slice(0, 10), concept: desc, category: "otro", who: "Miguel", amount: Math.abs(amount), payment_method: "tarjeta", source: "AmEx" };
};

// ─── Excel export ───
const exportToExcel = (data) => {
  const BOM = "\uFEFF";
  const headers = "Fecha,Concepto,Categoría,Quién,Monto,Método,Tarjeta\n";
  const rows = data.map(e =>
    `${e.expense_date},"${(displayConcept(e)).replace(/"/g, '""')}",${e.category},${e.who},${Number(e.amount).toFixed(2)},${e.payment_method || ""},${e.source || ""}`
  ).join("\n");
  const csv = BOM + headers + rows;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `gastos_diarios_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

export const DailyExpensesPage = ({ dailyExpenses, onAdd, mob, reload }) => {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importSource, setImportSource] = useState("capital_one");
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [form, setForm] = useState({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "" });
  const [sortCol, setSortCol] = useState("expense_date");
  const [sortDir, setSortDir] = useState("desc");
  const [filterCat, setFilterCat] = useState("all");
  const fileRef = useRef(null);

  const cats = ["supermercado", "transporte", "salud", "entretenimiento", "servicios", "restaurantes", "hogar", "otro"];

  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "" });
    setShowForm(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    let rows = [];
    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = parseCSV(text);
      rows = parsed.map(r => importSource === "capital_one" ? mapCapitalOne(r) : mapAmex(r)).filter(Boolean);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      try {
        const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        const parsed = parseCSV(csv);
        rows = parsed.map(r => importSource === "capital_one" ? mapCapitalOne(r) : mapAmex(r)).filter(Boolean);
      } catch (err) { setImportMsg("Error leyendo Excel. Intenta exportar como CSV."); return; }
    }
    if (rows.length > 0) { setImportData(rows); setImportMsg(`${rows.length} transacciones listas`); }
    else setImportMsg("No se encontraron transacciones válidas");
  };

  const executeImport = async () => {
    if (!importData) return;
    setImporting(true);
    let count = 0;
    for (let i = 0; i < importData.length; i += 50) {
      const batch = importData.slice(i, i + 50);
      for (const row of batch) {
        try { await supaInsert("daily_expenses", row); count++; } catch (e) { console.error(e); }
      }
      setImportMsg(`Importando... ${count}/${importData.length}`);
    }
    setImportMsg(`✓ ${count} transacciones importadas`);
    setImportData(null); setImporting(false); reload();
  };

  // ─── Sort ───
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "expense_date" ? "desc" : "asc"); }
  };

  // ─── Filter + Sort ───
  const allCats = [...new Set(dailyExpenses.map(e => e.category).filter(Boolean))].sort();
  let filtered = filterCat === "all" ? dailyExpenses : dailyExpenses.filter(e => e.category === filterCat);
  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "amount") { va = Number(va) || 0; vb = Number(vb) || 0; }
    else { va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ col, label, style }) => (
    <button onClick={() => toggleSort(col)} style={{
      background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans",
      fontSize: 11, fontWeight: 600, color: sortCol === col ? C.accent : C.textDim,
      textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 3,
      padding: 0, whiteSpace: "nowrap", ...style,
    }}>
      {label}{sortCol === col && <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );

  const total = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const payments = filtered.reduce((s, e) => s + (Number(e.amount) < 0 ? Number(e.amount) : 0), 0);

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos del Día a Día</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 16 }}>
        {filtered.length} registros · Gastos: <span style={{ color: C.red, fontFamily: "JetBrains Mono" }}>{fmt(total - payments)}</span>
        {payments < 0 && <> · Pagos: <span style={{ color: C.green, fontFamily: "JetBrains Mono" }}>{fmt(payments)}</span></>}
      </p>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn onClick={() => { setShowForm(!showForm); setShowImport(false); }}>{I.plus} Registrar</Btn>
        <Btn onClick={() => { setShowImport(!showImport); setShowForm(false); }} outline>📥 Importar</Btn>
        <Btn onClick={() => exportToExcel(sorted)} outline>📊 Exportar Excel</Btn>
      </div>

      {/* Category filters */}
      <div style={{ display: "flex", gap: 5, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilterCat("all")} style={{
          padding: "4px 10px", borderRadius: 14, border: `1px solid ${filterCat === "all" ? C.accent : C.border}`,
          background: filterCat === "all" ? C.accentGlow : "transparent", cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 11, color: filterCat === "all" ? C.accent : C.textDim,
        }}>Todas</button>
        {allCats.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: "4px 10px", borderRadius: 14, border: `1px solid ${filterCat === cat ? C.blue : C.border}`,
            background: filterCat === cat ? `${C.blue}18` : "transparent", cursor: "pointer",
            fontFamily: "DM Sans", fontSize: 11, color: filterCat === cat ? C.blue : C.textDim,
          }}>{cat}</button>
        ))}
      </div>

      {/* Manual form */}
      {showForm && (
        <Card style={{ marginBottom: 20, borderColor: C.accent }}>
          <SectionTitle>Nuevo Gasto</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Concepto" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} style={inputStyle} />
            <input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: "JetBrains Mono" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {cats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={form.who} onChange={e => setForm({ ...form, who: e.target.value })} style={inputStyle}>
              <option>Miguel</option><option>AnaP</option><option>Ambos</option>
            </select>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}>
              <option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
            </select>
            <input placeholder="Fuente (ej: AmEx)" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={handleSubmit}>Guardar</Btn>
            <Btn onClick={() => setShowForm(false)} outline>Cancelar</Btn>
          </div>
        </Card>
      )}

      {/* Import panel */}
      {showImport && (
        <Card style={{ marginBottom: 20, borderColor: C.blue }}>
          <SectionTitle>Importar desde CSV o Excel</SectionTitle>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>Formato:</span>
            {[["capital_one", "VISA", "#1a1f71", "#fff"], ["amex", "AMEX", "#fff", "#006FCF"]].map(([key, label, txtColor, bgColor]) => (
              <button key={key} onClick={() => setImportSource(key)} style={{
                padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${importSource === key ? (key === "capital_one" ? "#1a1f71" : "#006FCF") : C.border}`,
                background: importSource === key ? (key === "capital_one" ? "#1a1f7115" : "#006FCF15") : "transparent",
              }}>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: key === "amex" ? "#fff" : txtColor, background: key === "amex" ? bgColor : "#fff", padding: "2px 6px", borderRadius: 4, border: key === "capital_one" ? "1px solid #1a1f71" : "none" }}>{label}</span>
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()}>📁 Seleccionar Archivo</Btn>
          {importMsg && <p style={{ fontFamily: "DM Sans", fontSize: 13, color: importMsg.startsWith("✓") ? C.green : importMsg.startsWith("Error") ? C.red : C.accent, marginTop: 12 }}>{importMsg}</p>}
          {importData && (
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <Btn onClick={executeImport} disabled={importing}>{importing ? "Importando..." : `Importar ${importData.length}`}</Btn>
              <Btn onClick={() => { setImportData(null); setImportMsg(""); }} outline>Cancelar</Btn>
            </div>
          )}
        </Card>
      )}

      {/* ═══ EXPENSE TABLE ═══ */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos registrados</p>
          </div>
        ) : mob ? (
          /* ═══ MOBILE: sticky header + 2-line rows ═══ */
          <div style={{ maxHeight: "65vh", overflow: "auto" }}>
            {/* Sticky header */}
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, padding: "8px 12px", borderBottom: `2px solid ${C.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["expense_date","Fecha"],["category","Cat"],["source","Tarjeta"],["amount","Monto"],["concept","Concepto"]].map(([col,label]) => (
                <SortHeader key={col} col={col} label={label} />
              ))}
            </div>
            {/* Rows */}
            {sorted.map((e, i) => {
              const pay = isPayment(e);
              return (
                <div key={e.id || i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}>
                  {/* Line 1: fecha + categoría + tarjeta + monto */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim, flexShrink: 0 }}>{fmtDate(e.expense_date)}</span>
                    <Badge color={C.blue} style={{ fontSize: 9 }}>{e.category}</Badge>
                    <CardLogo source={e.source} />
                    <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: amountColor(e), flexShrink: 0 }}>{fmt(Math.abs(Number(e.amount)))}{pay && " ✓"}</span>
                  </div>
                  {/* Line 2: concepto */}
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: pay ? C.green : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayConcept(e)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ DESKTOP: sticky header table ═══ */
          <div style={{ maxHeight: "70vh", overflow: "auto" }}>
            {/* Sticky header */}
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, display: "grid", gridTemplateColumns: "90px 1fr 100px 70px 90px 60px", gap: 8, padding: "10px 14px", borderBottom: `2px solid ${C.border}` }}>
              <SortHeader col="expense_date" label="Fecha" />
              <SortHeader col="concept" label="Concepto" />
              <SortHeader col="category" label="Categoría" />
              <SortHeader col="who" label="Quién" />
              <SortHeader col="amount" label="Monto" style={{ justifyContent: "flex-end" }} />
              <SortHeader col="source" label="Tarjeta" />
            </div>
            {/* Rows */}
            {sorted.map((e, i) => {
              const pay = isPayment(e);
              return (
                <div key={e.id || i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 100px 70px 90px 60px", gap: 8, padding: "8px 14px", alignItems: "center" }}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.surface2}
                  onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.textDim }}>{fmtDate(e.expense_date)}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: pay ? C.green : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: pay ? 600 : 400 }}>{displayConcept(e)}</span>
                  <Badge color={C.blue}>{e.category}</Badge>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{e.who}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: amountColor(e), textAlign: "right" }}>{pay ? "+" : ""}{fmt(Math.abs(Number(e.amount)))}</span>
                  <CardLogo source={e.source} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
