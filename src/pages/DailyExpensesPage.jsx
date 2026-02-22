// Archivo: src/pages/DailyExpensesPage.jsx
// Versión: 2.0
// Fecha: 2026-02-22

import { useState, useRef } from "react";
import { C, inputStyle } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaInsert } from "../lib/supabase";
import { Card, SectionTitle, Badge, Btn } from "../components/UI";

// ─── Date formatter: "22 feb 26" ───
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  const day = dt.getDate();
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const mon = months[dt.getMonth()];
  const yr = String(dt.getFullYear()).slice(2);
  return `${day} ${mon} ${yr}`;
};

// ─── Card logos (inline SVG) ───
const CardLogo = ({ source }) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return (
    <span title="Capital One Visa" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#1a1f71", background: "#fff", padding: "2px 5px", borderRadius: 4, border: "1px solid #1a1f71" }}>VISA</span>
  );
  if (s.includes("amex") || s.includes("american")) return (
    <span title="American Express" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#006FCF", padding: "2px 5px", borderRadius: 4 }}>AMEX</span>
  );
  if (s.includes("master")) return (
    <span title="Mastercard" style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#EB001B", padding: "2px 5px", borderRadius: 4 }}>MC</span>
  );
  return source ? <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{source}</span> : null;
};

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
  const amount = debit > 0 ? debit : -credit;
  if (!date || amount === 0) return null;
  return { expense_date: date.slice(0, 10), concept: desc, category: cat, who: "Miguel", amount, payment_method: "tarjeta", source: "Capital One Visa" };
};

const mapAmex = (row) => {
  // AmEx format: Date, Description, Amount (or similar)
  const date = row["Date"] || row["Fecha"] || "";
  const desc = row["Description"] || row["Descripcion"] || row["Descripción"] || "";
  const amount = Math.abs(parseFloat(row["Amount"] || row["Monto"] || 0));
  if (!date || amount === 0) return null;
  return { expense_date: date.slice(0, 10), concept: desc, category: "otro", who: "Miguel", amount, payment_method: "tarjeta", source: "AmEx" };
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
  const fileRef = useRef(null);

  const cats = ["supermercado", "transporte", "salud", "entretenimiento", "servicios", "restaurantes", "hogar", "otro"];

  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "" });
    setShowForm(false);
  };

  // ─── File import handler ───
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let rows = [];
    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      const parsed = parseCSV(text);
      rows = parsed.map(r => importSource === "capital_one" ? mapCapitalOne(r) : mapAmex(r)).filter(Boolean);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      // For Excel, read as CSV from the first sheet using SheetJS if available, otherwise prompt CSV
      try {
        const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        const parsed = parseCSV(csv);
        rows = parsed.map(r => importSource === "capital_one" ? mapCapitalOne(r) : mapAmex(r)).filter(Boolean);
      } catch (err) {
        setImportMsg("Error leyendo Excel. Intenta exportar como CSV primero.");
        return;
      }
    }

    if (rows.length > 0) {
      setImportData(rows);
      setImportMsg(`${rows.length} transacciones listas para importar`);
    } else {
      setImportMsg("No se encontraron transacciones válidas");
    }
  };

  const executeImport = async () => {
    if (!importData) return;
    setImporting(true);
    let count = 0;
    // Insert in batches of 50
    for (let i = 0; i < importData.length; i += 50) {
      const batch = importData.slice(i, i + 50);
      for (const row of batch) {
        try { await supaInsert("daily_expenses", row); count++; } catch (e) { console.error(e); }
      }
      setImportMsg(`Importando... ${count}/${importData.length}`);
    }
    setImportMsg(`✓ ${count} transacciones importadas`);
    setImportData(null);
    setImporting(false);
    reload();
  };

  // ─── Sorting ───
  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "expense_date" ? "desc" : "asc"); }
  };

  const sorted = [...dailyExpenses].sort((a, b) => {
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
      padding: "8px 0", ...style,
    }}>
      {label}
      {sortCol === col && <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );

  // ─── Totals ───
  const total = dailyExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos del Día a Día</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>
        {dailyExpenses.length} registros · Total: <span style={{ color: C.red, fontFamily: "JetBrains Mono" }}>{fmt(total)}</span>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn onClick={() => { setShowForm(!showForm); setShowImport(false); }}>{I.plus} Registrar</Btn>
        <Btn onClick={() => { setShowImport(!showImport); setShowForm(false); }} outline>📥 Importar CSV/Excel</Btn>
      </div>

      {/* ─── Manual form ─── */}
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

      {/* ─── Import panel ─── */}
      {showImport && (
        <Card style={{ marginBottom: 20, borderColor: C.blue }}>
          <SectionTitle>Importar desde CSV o Excel</SectionTitle>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>Formato:</span>
            <button onClick={() => setImportSource("capital_one")} style={{
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${importSource === "capital_one" ? "#1a1f71" : C.border}`,
              background: importSource === "capital_one" ? "#1a1f7115" : "transparent",
            }}><span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: "#1a1f71", background: "#fff", padding: "2px 6px", borderRadius: 4, border: "1px solid #1a1f71" }}>VISA</span></button>
            <button onClick={() => setImportSource("amex")} style={{
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${importSource === "amex" ? "#006FCF" : C.border}`,
              background: importSource === "amex" ? "#006FCF15" : "transparent",
            }}><span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 700, color: "#fff", background: "#006FCF", padding: "2px 6px", borderRadius: 4 }}>AMEX</span></button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()}>📁 Seleccionar Archivo</Btn>

          {importMsg && (
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: importMsg.startsWith("✓") ? C.green : importMsg.startsWith("Error") ? C.red : C.accent, marginTop: 12 }}>{importMsg}</p>
          )}
          {importData && (
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <Btn onClick={executeImport} disabled={importing}>{importing ? "Importando..." : `Importar ${importData.length} transacciones`}</Btn>
              <Btn onClick={() => { setImportData(null); setImportMsg(""); }} outline>Cancelar</Btn>
            </div>
          )}
        </Card>
      )}

      {/* ─── Expense list ─── */}
      <Card>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos registrados</p>
          </div>
        ) : mob ? (
          /* ─── MOBILE: 2-line cards ─── */
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Mobile sort bar */}
            <div style={{ display: "flex", gap: 8, padding: "4px 0 12px", flexWrap: "wrap" }}>
              {[["expense_date","Fecha"],["concept","Concepto"],["category","Cat"],["amount","Monto"],["source","Tarjeta"]].map(([col,label]) => (
                <SortHeader key={col} col={col} label={label} />
              ))}
            </div>
            {sorted.map((e, i) => (
              <div key={e.id || i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                {/* Line 1: date + concept */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim, flexShrink: 0 }}>{fmtDate(e.expense_date)}</span>
                    <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concept}</span>
                  </div>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.red, flexShrink: 0, marginLeft: 8 }}>{fmt(Number(e.amount))}</span>
                </div>
                {/* Line 2: category + source */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color={C.blue}>{e.category}</Badge>
                  <CardLogo source={e.source} />
                  {e.who && e.who !== "Miguel" && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>{e.who}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── DESKTOP: table ─── */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 110px 80px 100px 70px", gap: 8, padding: "0 8px", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
              <SortHeader col="expense_date" label="Fecha" />
              <SortHeader col="concept" label="Concepto" />
              <SortHeader col="category" label="Categoría" />
              <SortHeader col="who" label="Quién" />
              <SortHeader col="amount" label="Monto" style={{ justifyContent: "flex-end" }} />
              <SortHeader col="source" label="Tarjeta" />
            </div>
            {sorted.map((e, i) => (
              <div key={e.id || i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 110px 80px 100px 70px", gap: 8, padding: "8px", borderRadius: 6, alignItems: "center" }}
                onMouseEnter={ev => ev.currentTarget.style.background = C.surface2}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.textDim }}>{fmtDate(e.expense_date)}</span>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concept}</span>
                <Badge color={C.blue}>{e.category}</Badge>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{e.who}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: C.red, textAlign: "right" }}>{fmt(Number(e.amount))}</span>
                <CardLogo source={e.source} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
