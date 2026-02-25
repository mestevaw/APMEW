// Archivo: src/pages/DailyExpensesPage.jsx
// Versión: 10.0
// Fecha: 2026-02-22

import { useState, useRef, useEffect } from "react";
import { C, inputStyle } from "../lib/theme";
import { I } from "../lib/icons";
import { fmtMoney, fmtDateShort } from "../lib/helpers";
import { supaInsert, supaUpdate, supaBatchInsert, supaBatchUpdate } from "../lib/supabase";
import { Card, SectionTitle, Badge, Btn, Spinner } from "../components/UI";

// ─── Load SheetJS ───
const loadXLSX = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const s = document.createElement("script");
  s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
  s.onload = () => resolve(window.XLSX);
  s.onerror = () => reject(new Error("No se pudo cargar SheetJS"));
  document.head.appendChild(s);
});

// ─── Date (delegamos al helper fmtDateShort) ───
const fmtDate = fmtDateShort;

// ─── Display helpers ───
const CAT_DISPLAY = { hogar: "Casa", supermercado: "Súper", restaurantes: "Rest.", entretenimiento: "Entret.", servicios: "Serv.", transporte: "Transp.", salud: "Salud", otro: "Otro" };
const displayCat = (cat) => CAT_DISPLAY[cat] || cat;
const WHO_DISPLAY = { Miguel: "MEW", AnaP: "AP", Ambos: "Amb" };
const displayWho = (who) => WHO_DISPLAY[who] || who;

// ─── Card logos (SVG) ───
const VisaLogo = () => (
  <svg width="32" height="11" viewBox="0 0 1000 324" xmlns="http://www.w3.org/2000/svg">
    <path d="M413.8 2.4L271.4 321.6h-93.2L116.7 52.1c-3.7-14.7-7-20.1-18.4-26.3C78.5 15.1 42 5 9.4 0l2.2-10.2h150c19.1 0 36.3 12.7 40.6 34.8l37.1 197.3L331.9 2.4h81.9zm323.6 215c.3-84.3-116.6-88.9-115.8-126.6.2-11.5 11.2-23.7 35.1-26.8 11.8-1.6 44.5-2.8 81.6 14.5l14.5-67.8C735.1 3.5 712.7-4 684.8-4c-77.2 0-131.5 41-131.9 99.7-.5 43.4 38.7 67.6 68.3 82 30.4 14.7 40.6 24.1 40.5 37.3-.2 20.1-24.3 29-46.7 29.4-39.2.6-62-10.6-80.1-19.1l-14.1 66.1c18.2 8.4 51.8 15.7 86.6 16.1 82 0 135.7-40.5 135.9-103.1zm203.8 104.2h72.4L946 2.4h-66.9c-15 0-27.7 8.8-33.3 22.2L708.2 321.6h82l16.3-45.1h100.2l9.5 45.1zM825 207.3l41.1-113.5 23.7 113.5H825zM523.6 2.4l-64.5 319.2h-78.1L445.5 2.4h78.1z" fill="#1a1f71"/>
  </svg>
);
const AmexLogo = () => (
  <svg width="28" height="11" viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="16" rx="2" fill="#006FCF"/>
    <text x="24" y="12" textAnchor="middle" fill="white" fontFamily="Arial" fontWeight="700" fontSize="9">AMEX</text>
  </svg>
);
const CardLogo = ({ source }) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return <VisaLogo />;
  if (s.includes("amex") || s.includes("american")) return <AmexLogo />;
  if (s.includes("master")) return <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#EB001B", padding: "1px 5px", borderRadius: 3, lineHeight: "14px" }}>MC</span>;
  if (s.includes("efectivo")) return <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>💵</span>;
  if (s.includes("transfer")) return <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>🏦</span>;
  return source ? <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>{source.slice(0,6)}</span> : null;
};

const isPayment = (e) => (e.category === "otro" || e.category === "Otro") && Number(e.amount) < 0;
const displayConcept = (e) => isPayment(e) ? "Pago" : e.concept;

const shortCardLabel = (source) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return "Visa";
  if (s.includes("amex") || s.includes("american")) return "Amex";
  if (s.includes("master")) return "MC";
  if (s.includes("efectivo")) return "Cash";
  if (s.includes("transfer")) return "Transf";
  return source ? source.slice(0, 5) : "—";
};

// ─── Country detection ───
const Flag = ({ country }) => <span style={{ fontSize: 13, lineHeight: 1, cursor: "default" }} title={country === "MX" ? "México" : "EUA"}>{country === "MX" ? "🇲🇽" : "🇺🇸"}</span>;

const MX_TAGS = ["Progreso - Luz", "Progreso - Agua", "Progreso - Mant."];
const MX_CONCEPTS = ["predial", "telmex", "cfe ", "izzi", "oxxo", "walmart mx", "soriana", "coppel", "liverpool"];

const detectCountry = (row) => {
  if (row.country && row.country !== "US" && row.country !== "MX") return "US";
  if (row.country) return row.country;
  if (row.tag && MX_TAGS.includes(row.tag)) return "MX";
  const c = (row.concept || "").toLowerCase();
  if (MX_CONCEPTS.some(w => c.includes(w))) return "MX";
  if (row.source === "Efectivo" && row.tag && row.tag.includes("Progreso")) return "MX";
  return "US";
};
const amountColor = (e) => isPayment(e) ? C.green : C.red;

// ═══════════════════════════════════════════
// FILE PARSING — auto-detects format
// ═══════════════════════════════════════════
const parseFileToRows = async (file) => {
  let rows;
  if (file.name.endsWith(".csv")) {
    const text = await file.text();
    rows = parseCSVToObjects(text);
  } else {
    const XLSX = await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    rows = rawArrayToObjects(raw);
  }
  return rows;
};

const parseCSVToObjects = (text) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  let hIdx = 0;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("date") && (lower.includes("description") || lower.includes("amount"))) { hIdx = i; break; }
  }
  // Parser que respeta comillas (campos con comas internas)
  const parseLine = (line) => {
    const fields = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());
    return fields;
  };
  const headers = parseLine(lines[hIdx]);
  return lines.slice(hIdx + 1).filter(l => l.trim()).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || "");
    return obj;
  }).filter(r => Object.values(r).filter(v => v).length >= 2);
};

const rawArrayToObjects = (raw) => {
  let hIdx = 0;
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const joined = raw[i].map(v => String(v || "").toLowerCase()).join(" ");
    if (joined.includes("date") && (joined.includes("description") || joined.includes("amount"))) { hIdx = i; break; }
  }
  const headers = raw[hIdx].map(h => String(h || "").trim());
  return raw.slice(hIdx + 1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] !== undefined ? String(r[i]).trim() : "");
    return obj;
  }).filter(r => Object.values(r).filter(v => v).length >= 2);
};

// ─── Auto-detect and map ───
const autoMapRow = (row) => {
  const keys = Object.keys(row);
  // Detect Capital One: has "Transaction Date", "Debit", "Credit"
  if (keys.some(k => k === "Transaction Date") && keys.some(k => k === "Debit")) {
    return mapCapitalOne(row);
  }
  // Detect AmEx: has "Card Member", single "Amount"
  if (keys.some(k => k === "Card Member") || (keys.some(k => k === "Amount") && keys.some(k => k === "Category"))) {
    return mapAmex(row);
  }
  // Fallback: try Capital One
  return mapCapitalOne(row) || mapAmex(row);
};

const VISA_CATS = { "Dining": "restaurantes", "Merchandise": "hogar", "Other Travel": "transporte", "Entertainment": "entretenimiento", "Health Care": "salud", "Healthcare": "salud", "Other Services": "servicios", "Gas/Automotive": "transporte", "Phone/Cable": "servicios", "Insurance": "servicios", "Utilities": "servicios", "Payment/Credit": "otro", "Airfare": "transporte", "Lodging": "transporte", "Other": "otro", "Internet": "servicios", "Professional Services": "servicios", "Car Rental": "transporte", "Fee/Interest Charge": "otro" };

const mapCapitalOne = (row) => {
  const date = row["Transaction Date"] || "";
  const desc = row["Description"] || "";
  const cat = VISA_CATS[row["Category"]] || "otro";
  const debit = parseFloat(row["Debit"]) || 0;
  const credit = parseFloat(row["Credit"]) || 0;
  const amount = debit > 0 ? debit : (credit > 0 ? -credit : 0);
  if (!date || amount === 0) return null;
  const result = { expense_date: date.slice(0, 10), concept: desc.slice(0, 100), category: cat, who: "Miguel", amount, payment_method: "tarjeta", source: "Capital One Visa" };
  result.country = detectCountry(result);
  return result;
};

const AMEX_CATS = { "Restaurant": "restaurantes", "Groceries": "supermercado", "General Retail": "hogar", "Internet Purchase": "hogar", "Mail Order": "hogar", "Fuel": "transporte", "Vehicle": "transporte", "Cable": "servicios", "Communications": "servicios", "Business Services": "servicios" };

const mapAmex = (row) => {
  const date = row["Date"] || "";
  const desc = row["Description"] || "";
  const member = row["Card Member"] || "";
  const amount = parseFloat(row["Amount"] || 0);
  const category = row["Category"] || "";
  if (!date || !amount) return null;
  let dateIso = date;
  if (date.includes("/")) { const p = date.split("/"); dateIso = (p[2].length === 2 ? `20${p[2]}` : p[2]) + `-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}`; }
  let cat = "otro";
  for (const [k, v] of Object.entries(AMEX_CATS)) { if (category.toLowerCase().includes(k.toLowerCase())) { cat = v; break; } }
  const who = member.toUpperCase().includes("HINOJOSA") ? "AnaP" : "Miguel";
  const result = { expense_date: dateIso.slice(0, 10), concept: desc.slice(0, 100).trim(), category: cat, who, amount: Math.abs(amount), payment_method: "tarjeta", source: "AmEx" };
  result.country = detectCountry(result);
  return result;
};

const exportToExcel = (data) => {
  const BOM = "\uFEFF";
  const h = "Fecha,Concepto,Categoría,Quién,Monto,Tarjeta,Tag,Subcategoría,País\n";
  const rows = data.map(e => `${e.expense_date},"${(displayConcept(e)).replace(/"/g,'""')}",${e.category},${e.who},${Number(e.amount).toFixed(2)},${e.source||""},${e.tag||""},${e.subcategory||""},${e.country||detectCountry(e)}`).join("\n");
  const blob = new Blob([BOM + h + rows], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `gastos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
};

// ─── UI components ───
const DropMenu = ({ open, onClose, children, style }) => {
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  if (!open) return null;
  return <div ref={ref} style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", minWidth: 220, zIndex: 100, overflow: "hidden", ...style }}>{children}</div>;
};
const MenuBtn = ({ onClick, children, active }) => <button onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "10px 16px", background: active ? C.accentGlow : "transparent", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, color: active ? C.accent : C.text, display: "flex", alignItems: "center", gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = active ? C.accentGlow : "transparent"}>{children}</button>;
const MenuDivider = () => <div style={{ height: 1, background: C.border, margin: "4px 0" }} />;
const MenuLabel = ({ children }) => <div style={{ padding: "8px 16px 4px", fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
const CloseBtn = ({ onClick }) => <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 18, padding: "2px 6px", lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textDim}>✕</button>;

// ─── White date input style ───
const dateStyle = { ...inputStyle, fontSize: 12, background: "#fff", color: "#111", borderColor: "#ccc" };

// ─── Tags + subcategories ───
const TAG_OPTIONS = ["Argo - Agua/Gas","Argo - Luz","Argo - Mant.","Progreso - Luz","Progreso - Agua","Progreso - Mant.","Mango Nest","MNA Works","Tortuga Home","Honda CRV","Hyundai Tucson","Mazda 6","Personal","Médico","Viaje","Educación"];
const SUBCATEGORIES = {
  hogar: ["Suscripciones","Limpieza","Muebles","Electrónica","Ropa","Mascotas"],
  servicios: ["Internet","Teléfono","Streaming","Software","Seguros"],
  restaurantes: ["Café","Comida rápida","Formal","Delivery"],
  transporte: ["Gasolina","Uber/Taxi","Estacionamiento","Mant. auto","Vuelos","Honda CRV","Hyundai Tucson","Mazda 6"],
  salud: ["Farmacia","Consulta","Dentista","Óptica","Gym"],
  entretenimiento: ["Cine","Libros","Juegos","Eventos","Música"],
  supermercado: ["HEB","Whole Foods","Costco","Otro"],
  otro: ["Propina","Comisión","Donación","Otro"],
};

// ═══════════════════════════════════════════
export const DailyExpensesPage = ({ dailyExpenses, onAdd, mob, reload }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState(null); // "form"|"import"|"summary"|"query"
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
  const cats = ["supermercado","transporte","salud","entretenimiento","servicios","restaurantes","hogar","otro"];

  const openPanel = (p) => { setPanel(panel === p ? null : p); setMenuOpen(false); };

  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta", source: "", country: "US" });
    setPanel(null);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await parseFileToRows(file);
      const mapped = rows.map(autoMapRow).filter(Boolean);
      if (mapped.length > 0) {
        const visa = mapped.filter(r => r.source === "Capital One Visa").length;
        const amex = mapped.filter(r => r.source === "AmEx").length;
        setImportData(mapped);
        setImportMsg(`${mapped.length} transacciones (${visa > 0 ? visa + " VISA" : ""}${visa > 0 && amex > 0 ? ", " : ""}${amex > 0 ? amex + " AMEX" : ""})`);
      } else setImportMsg(`No se encontraron transacciones válidas (${rows.length} filas leídas)`);
    } catch (err) { console.error(err); setImportMsg("Error: " + err.message); }
    e.target.value = "";
  };

  const executeImport = async () => {
    if (!importData) return;
    setImporting(true); let count = 0, skipped = 0;
    const existing = new Set();
    for (const e of dailyExpenses) existing.add(`${e.expense_date}|${(e.concept||"").slice(0,40).toLowerCase()}|${Number(e.amount).toFixed(2)}`);
    
    // Filtrar duplicados primero, luego insertar en bloques de 50
    const newRows = [];
    for (const row of importData) {
      const key = `${row.expense_date}|${(row.concept||"").slice(0,40).toLowerCase()}|${Number(row.amount).toFixed(2)}`;
      if (existing.has(key)) { skipped++; continue; }
      newRows.push(row);
      existing.add(key);
    }
    
    const BATCH_SIZE = 50;
    for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
      const batch = newRows.slice(i, i + BATCH_SIZE);
      try { await supaBatchInsert("daily_expenses", batch); count += batch.length; } catch (e) { console.error("Batch insert error:", e); }
      setImportMsg(`Procesando... ${count} nuevas, ${skipped} existentes`);
    }
    
    setImportMsg(`✓ ${count} importadas${skipped > 0 ? `, ${skipped} ya existían` : ""}`);
    setImportData(null); setImporting(false); if (count > 0) reload();
  };

  // ─── Tag / subcategory (apply to ALL matching via batch update) ───
  const applyToMatching = async (expense, field, value) => {
    setApplying(true);
    const cpt = (expense.concept||"").trim();
    try {
      await supaBatchUpdate("daily_expenses", `concept=eq.${encodeURIComponent(cpt)}`, { [field]: value });
    } catch (e) { console.error("Batch update error:", e); }
    setApplying(false); setEditingExpense(null); reload();
  };
  const applySingle = async (id, field, value) => {
    try { await supaUpdate("daily_expenses", id, { [field]: value }); } catch {}
    setEditingExpense(null); reload();
  };

  // ─── Sort ───
  const doSort = (col) => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir(col === "expense_date" ? "desc" : "asc"); } setMenuOpen(false); };

  // ─── Filter + Search ───
  const availableYears = [...new Set(dailyExpenses.map(e => e.expense_date ? e.expense_date.slice(0, 4) : null).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const availableMonths = filterYear === "all" ? [] : [...new Set(dailyExpenses.filter(e => e.expense_date && e.expense_date.startsWith(filterYear)).map(e => e.expense_date.slice(5, 7)))].sort((a, b) => b.localeCompare(a));
  const allCats = [...new Set(dailyExpenses.map(e => e.category).filter(Boolean))].sort();
  let filtered = filterYear === "all" ? dailyExpenses : dailyExpenses.filter(e => e.expense_date && e.expense_date.startsWith(filterYear));
  if (filterMonth !== "all") filtered = filtered.filter(e => e.expense_date && e.expense_date.slice(5, 7) === filterMonth);
  filtered = filterCat === "all" ? filtered : filtered.filter(e => e.category === filterCat);
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(e => (e.concept||"").toLowerCase().includes(q) || (e.category||"").toLowerCase().includes(q) || (e.source||"").toLowerCase().includes(q) || (e.tag||"").toLowerCase().includes(q) || (e.who||"").toLowerCase().includes(q) || (e.subcategory||"").toLowerCase().includes(q) || (q === "mx" && (e.country || detectCountry(e)) === "MX") || (q === "us" && (e.country || detectCountry(e)) === "US") || (q === "mexico" && (e.country || detectCountry(e)) === "MX") || (q === "méxico" && (e.country || detectCountry(e)) === "MX")); }

  // ═══ KEY CHANGE: Summary date filters apply to the main list too ═══
  if (panel === "summary") {
    if (sumFrom) filtered = filtered.filter(e => e.expense_date >= sumFrom);
    if (sumTo) filtered = filtered.filter(e => e.expense_date <= sumTo);
  }

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "amount") { va = Number(va)||0; vb = Number(vb)||0; }
    else { va = String(va||"").toLowerCase(); vb = String(vb||"").toLowerCase(); }
    return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDir === "asc" ? 1 : -1);
  });

  const total = filtered.reduce((s, e) => s + Math.max(0, Number(e.amount)||0), 0);
  const payments = filtered.reduce((s, e) => s + Math.min(0, Number(e.amount)||0), 0);

  // Summary
  const catSummary = {};
  filtered.forEach(e => { const c = e.category||"otro"; if (!catSummary[c]) catSummary[c] = { count: 0, total: 0 }; catSummary[c].count++; catSummary[c].total += Number(e.amount)||0; });
  const catSumSorted = Object.entries(catSummary).sort((a, b) => b[1].total - a[1].total);

  // Query
  let queryResults = [];
  if (panel === "query" && (qPlace||qConcept||qFrom||qTo)) {
    queryResults = dailyExpenses.filter(e => {
      if (qPlace && !(e.concept||"").toLowerCase().includes(qPlace.toLowerCase())) return false;
      if (qConcept && !(e.concept||"").toLowerCase().includes(qConcept.toLowerCase()) && !(e.tag||"").toLowerCase().includes(qConcept.toLowerCase())) return false;
      if (qFrom && e.expense_date < qFrom) return false;
      if (qTo && e.expense_date > qTo) return false;
      return true;
    });
  }
  const queryTotal = queryResults.reduce((s, e) => s + (Number(e.amount)||0), 0);

  const sortLabels = { expense_date: "Fecha", concept: "Concepto", category: "Cat.", amount: "Monto", source: "Tarj.", who: "Quién" };
  const matchCount = editingExpense ? dailyExpenses.filter(e => (e.concept||"").trim().toLowerCase() === (editingExpense.concept||"").trim().toLowerCase()).length : 0;

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
            const pct = total > 0 ? (Math.max(0, data.total) / total * 100) : 0;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, width: mob ? 90 : 120 }}>{displayCat(cat)}</span>
                <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: data.total < 0 ? C.green : C.blue, borderRadius: 4 }} /></div>
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
                    <span style={{ fontFamily: "JetBrains Mono", color: C.textDim, marginRight: 8, flexShrink: 0 }}>{fmtDate(e.expense_date)}</span>
                    <span style={{ fontFamily: "DM Sans", color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.concept}</span>
                    <span style={{ fontFamily: "JetBrains Mono", color: C.red, marginLeft: 8, flexShrink: 0 }}>{fmtMoney(Number(e.amount))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ═══ COMPARISON US vs MX ═══ */}
      {panel === "comparison" && (() => {
        const all = dailyExpenses.filter(e => !isPayment(e));
        const usItems = all.filter(e => (e.country || detectCountry(e)) === "US");
        const mxItems = all.filter(e => (e.country || detectCountry(e)) === "MX");
        const usTotal = usItems.reduce((s, e) => s + Number(e.amount || 0), 0);
        const mxTotal = mxItems.reduce((s, e) => s + Number(e.amount || 0), 0);
        const grandTotal = usTotal + mxTotal;
        const catBk = (items) => { const m = {}; items.forEach(e => { const c = e.category || "otro"; m[c] = (m[c] || 0) + Number(e.amount || 0); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
        const usCats = catBk(usItems);
        const mxCats = catBk(mxItems);
        const monthly = {};
        all.forEach(e => { const ym = (e.expense_date || "").slice(0, 7); if (!ym) return; if (!monthly[ym]) monthly[ym] = { us: 0, mx: 0 }; monthly[ym][(e.country || detectCountry(e)) === "MX" ? "mx" : "us"] += Number(e.amount || 0); });
        const mos = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0]));
        const pBar = (val, max, color) => <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${max > 0 ? (val / max * 100) : 0}%`, height: "100%", background: color, borderRadius: 4 }} /></div>;
        return (
          <Card style={{ marginBottom: 16, borderColor: "#F59E0B" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <SectionTitle style={{ margin: 0 }}>🇺🇸 EUA vs 🇲🇽 México</SectionTitle>
              <CloseBtn onClick={() => setPanel(null)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 14, background: "#1e3a5f20", borderRadius: 10, border: "1px solid #3B82F640" }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>🇺🇸 EUA</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: "#3B82F6", marginTop: 4 }}>{fmtMoney(usTotal)}</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 2 }}>{usItems.length} gastos · {grandTotal > 0 ? (usTotal / grandTotal * 100).toFixed(0) : 0}%</div>
              </div>
              <div style={{ padding: 14, background: "#065f4620", borderRadius: 10, border: "1px solid #10B98140" }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>🇲🇽 México</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: "#10B981", marginTop: 4 }}>{fmtMoney(mxTotal)}</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 2 }}>{mxItems.length} gastos · {grandTotal > 0 ? (mxTotal / grandTotal * 100).toFixed(0) : 0}%</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>🇺🇸 Por categoría</div>
                {usCats.map(([cat, t]) => <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}><span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.text, width: 50 }}>{displayCat(cat)}</span>{pBar(t, usTotal, "#3B82F6")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.textDim, minWidth: 60, textAlign: "right" }}>{fmtMoney(t)}</span></div>)}
              </div>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>🇲🇽 Por categoría</div>
                {mxCats.length > 0 ? mxCats.map(([cat, t]) => <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}><span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.text, width: 50 }}>{displayCat(cat)}</span>{pBar(t, mxTotal, "#10B981")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.textDim, minWidth: 60, textAlign: "right" }}>{fmtMoney(t)}</span></div>) : <p style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>Sin gastos MX</p>}
              </div>
            </div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>Por mes</div>
            <div style={{ maxHeight: 200, overflow: "auto" }}>
              {mos.map(([ym, d]) => <div key={ym} style={{ display: "grid", gridTemplateColumns: "55px 1fr 70px 1fr 70px", gap: 4, padding: "4px 0", alignItems: "center" }}><span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.textDim }}>{ym}</span>{pBar(d.us, Math.max(d.us, d.mx), "#3B82F6")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#3B82F6", textAlign: "right" }}>{fmtMoney(d.us)}</span>{pBar(d.mx, Math.max(d.us, d.mx), "#10B981")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#10B981", textAlign: "right" }}>{fmtMoney(d.mx)}</span></div>)}
            </div>
          </Card>
        );
      })()}

      {/* ═══ FORM ═══ */}
      {panel === "form" && (
        <Card style={{ marginBottom: 16, borderColor: C.accent }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle style={{ margin: 0 }}>Nuevo Gasto</SectionTitle>
            <CloseBtn onClick={() => setPanel(null)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Concepto" value={form.concept} onChange={e => setForm({...form, concept: e.target.value})} style={inputStyle} />
            <input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} style={{...inputStyle, fontFamily: "JetBrains Mono"}} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr 1fr auto", gap: 12, marginBottom: 16 }}>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={inputStyle}>{cats.map(c => <option key={c}>{c}</option>)}</select>
            <select value={form.who} onChange={e => setForm({...form, who: e.target.value})} style={inputStyle}><option>Miguel</option><option>AnaP</option><option>Ambos</option></select>
            <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} style={inputStyle}><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select>
            <input placeholder="Fuente" value={form.source} onChange={e => setForm({...form, source: e.target.value})} style={inputStyle} />
            <button onClick={() => setForm({...form, country: form.country === "US" ? "MX" : "US"})} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 18, lineHeight: 1 }} title={form.country === "MX" ? "México" : "EUA"}>{form.country === "MX" ? "🇲🇽" : "🇺🇸"}</button>
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

      {/* ═══ EDIT MODAL ═══ */}
      {editingExpense && (
        <>
          <div onClick={() => setEditingExpense(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, zIndex: 10000, minWidth: mob ? "90vw" : 380, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.text }}>Editar gasto</h3>
              <CloseBtn onClick={() => setEditingExpense(null)} />
            </div>
            <div style={{ padding: "8px 0 14px", borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text }}>{editingExpense.concept}</p>
              <p style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.textDim }}>{fmtDate(editingExpense.expense_date)} · {fmtMoney(Number(editingExpense.amount))}</p>
              {matchCount > 1 && <p style={{ fontFamily: "DM Sans", fontSize: 11, color: C.accent, marginTop: 4 }}>{matchCount} gastos con este concepto — cambios se aplican a todos</p>}
            </div>
            {/* Country — FIRST */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>PAÍS <Flag country={editingExpense.country || detectCountry(editingExpense)} /></p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => matchCount > 1 ? applyToMatching(editingExpense, "country", "US") : applySingle(editingExpense.id, "country", "US")} style={{ padding: "7px 16px", background: (editingExpense.country || detectCountry(editingExpense)) === "US" ? `${C.accent}20` : C.surface2, border: `1px solid ${(editingExpense.country || detectCountry(editingExpense)) === "US" ? C.accent : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>🇺🇸 EUA</button>
                <button onClick={() => matchCount > 1 ? applyToMatching(editingExpense, "country", "MX") : applySingle(editingExpense.id, "country", "MX")} style={{ padding: "7px 16px", background: (editingExpense.country || detectCountry(editingExpense)) === "MX" ? `${C.accent}20` : C.surface2, border: `1px solid ${(editingExpense.country || detectCountry(editingExpense)) === "MX" ? C.accent : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>🇲🇽 México</button>
              </div>
              {matchCount > 1 && <p style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 4 }}>Se aplica a los {matchCount} gastos con este concepto</p>}
            </div>
            {/* Category */}
            <div style={{ marginBottom: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>CATEGORÍA <Badge color={C.blue}>{displayCat(editingExpense.category)}</Badge></p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {cats.map(cat => (
                  <button key={cat} onClick={() => matchCount > 1 ? applyToMatching(editingExpense, "category", cat) : applySingle(editingExpense.id, "category", cat)} disabled={applying} style={{ padding: "5px 12px", background: editingExpense.category === cat ? `${C.blue}20` : C.surface2, border: `1px solid ${editingExpense.category === cat ? C.blue : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text }}>{displayCat(cat)}</button>
                ))}
              </div>
            </div>
            {/* Subcategory */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>SUBCATEGORÍA {editingExpense.subcategory && <Badge color="#A78BFA">{editingExpense.subcategory}</Badge>}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(SUBCATEGORIES[editingExpense.category] || SUBCATEGORIES.otro).map(sub => (
                  <button key={sub} onClick={() => matchCount > 1 ? applyToMatching(editingExpense, "subcategory", sub) : applySingle(editingExpense.id, "subcategory", sub)} disabled={applying} style={{ padding: "5px 12px", background: editingExpense.subcategory === sub ? `#A78BFA25` : C.surface2, border: `1px solid ${editingExpense.subcategory === sub ? "#A78BFA" : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text }}>{sub}</button>
                ))}
              </div>
              <input placeholder="Otra subcategoría..." onKeyDown={e => { if (e.key === "Enter" && e.target.value) { matchCount > 1 ? applyToMatching(editingExpense, "subcategory", e.target.value) : applySingle(editingExpense.id, "subcategory", e.target.value); }}} style={{ ...inputStyle, marginTop: 6, fontSize: 12 }} />
            </div>
            {/* Tag */}
            <div>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>ASOCIAR CON {editingExpense.tag && <Badge color="#10B981">{editingExpense.tag}</Badge>}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {TAG_OPTIONS.map(tag => (
                  <button key={tag} onClick={() => matchCount > 1 ? applyToMatching(editingExpense, "tag", tag) : applySingle(editingExpense.id, "tag", tag)} disabled={applying} style={{ padding: "7px 14px", background: editingExpense.tag === tag ? `${C.green}15` : C.surface2, border: `1px solid ${editingExpense.tag === tag ? C.green : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text, textAlign: "left" }}>{tag}</button>
                ))}
                <input placeholder="Tag personalizado..." onKeyDown={e => { if (e.key === "Enter" && e.target.value) { matchCount > 1 ? applyToMatching(editingExpense, "tag", e.target.value) : applySingle(editingExpense.id, "tag", e.target.value); }}} style={{ ...inputStyle, marginTop: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                {editingExpense.tag && <Btn onClick={() => applySingle(editingExpense.id, "tag", null)} outline>Quitar tag</Btn>}
                {editingExpense.subcategory && <Btn onClick={() => applySingle(editingExpense.id, "subcategory", null)} outline>Quitar sub</Btn>}
              </div>
            </div>
            {applying && <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.accent, marginTop: 8 }}>Aplicando a {matchCount} registros...</p>}
          </div>
        </>
      )}

      {/* ═══ TABLE ═══ */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📝</div><p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos</p></div>
        ) : mob ? (
          <div style={{ maxHeight: "55vh", overflow: "auto" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.surface, padding: "8px 12px", borderBottom: `2px solid ${C.border}` }}><span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{sorted.length} gastos</span></div>
            {sorted.map((e, i) => {
              const pay = isPayment(e);
              return (
                <div key={e.id||i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }} onClick={() => e.id && setEditingExpense(e)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: pay ? C.green : C.text, fontWeight: pay ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{displayConcept(e)}</span>
                    <Flag country={e.country || detectCountry(e)} />
                    <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textDim, flexShrink: 0 }}>{shortCardLabel(e.source)}</span>
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: amountColor(e), flexShrink: 0 }}>{pay ? "+" : ""}{fmtMoney(Math.abs(Number(e.amount)))}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "DM Sans", fontSize: 10, color: C.textDim }}>
                    <span>{fmtDate(e.expense_date)}</span>
                    <Badge color={C.blue} style={{ fontSize: 8 }}>{displayCat(e.category)}</Badge>
                    {e.subcategory && <Badge color="#A78BFA" style={{ fontSize: 8 }}>{e.subcategory}</Badge>}
                    {e.tag && <Badge color="#10B981" style={{ fontSize: 8 }}>{e.tag}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
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
                <div key={e.id||i} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) 46px 20px 30px 26px 90px 66px", gap: 4, padding: "6px 8px", alignItems: "center", cursor: "pointer" }}
                  onClick={() => e.id && setEditingExpense(e)}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.surface2} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim }}>{fmtDate(e.expense_date)}</span>
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
