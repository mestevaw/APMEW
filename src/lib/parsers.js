// ═══════════════════════════════════════════
// Archivo: src/lib/parsers.js
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════
// Lógica de parsing de archivos CSV/XLSX para importar gastos.
// Extraído de DailyExpensesPage para mantenerlo manejable.

import { detectCountry } from "./helpers";

// ─── Load SheetJS on demand ───
const loadXLSX = () => new Promise((resolve, reject) => {
  if (window.XLSX) return resolve(window.XLSX);
  const s = document.createElement("script");
  s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
  s.onload  = () => resolve(window.XLSX);
  s.onerror = () => reject(new Error("No se pudo cargar SheetJS"));
  document.head.appendChild(s);
});

// ═══════════════════════════════════════════
// FILE PARSING — auto-detects CSV vs XLSX
// ═══════════════════════════════════════════
export const parseFileToRows = async (file) => {
  if (file.name.endsWith(".csv")) {
    const text = await file.text();
    return parseCSVToObjects(text);
  }
  const XLSX = await loadXLSX();
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf);
  const raw  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  return rawArrayToObjects(raw);
};

// ─── CSV → Array de objetos ───
const parseCSVToObjects = (text) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  let hIdx = 0;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("date") && (lower.includes("description") || lower.includes("amount"))) {
      hIdx = i;
      break;
    }
  }

  const headers = parseLine(lines[hIdx]);
  return lines.slice(hIdx + 1)
    .filter(l => l.trim())
    .map(line => {
      const vals = parseLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return obj;
    })
    .filter(r => Object.values(r).filter(v => v).length >= 2);
};

// Parser que respeta comillas (campos con comas internas)
const parseLine = (line) => {
  const fields = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"')                   { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes)      { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
};

// ─── XLSX raw array → Array de objetos ───
const rawArrayToObjects = (raw) => {
  let hIdx = 0;
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    const joined = raw[i].map(v => String(v || "").toLowerCase()).join(" ");
    if (joined.includes("date") && (joined.includes("description") || joined.includes("amount"))) {
      hIdx = i;
      break;
    }
  }
  const headers = raw[hIdx].map(h => String(h || "").trim());
  return raw.slice(hIdx + 1)
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? String(r[i]).trim() : ""; });
      return obj;
    })
    .filter(r => Object.values(r).filter(v => v).length >= 2);
};

// ═══════════════════════════════════════════
// MAPEO DE FILAS — detecta formato automáticamente
// ═══════════════════════════════════════════
export const autoMapRow = (row) => {
  const keys = Object.keys(row);
  // Capital One: "Transaction Date" + "Debit"
  if (keys.includes("Transaction Date") && keys.includes("Debit")) return mapCapitalOne(row);
  // AmEx: "Card Member" o ("Amount" + "Category")
  if (keys.includes("Card Member") || (keys.includes("Amount") && keys.includes("Category"))) return mapAmex(row);
  // Fallback
  return mapCapitalOne(row) || mapAmex(row);
};

// ─── Category maps ───
const VISA_CATS = {
  "Dining": "restaurantes", "Merchandise": "hogar", "Other Travel": "transporte",
  "Entertainment": "entretenimiento", "Health Care": "salud", "Healthcare": "salud",
  "Other Services": "servicios", "Gas/Automotive": "transporte", "Phone/Cable": "servicios",
  "Insurance": "servicios", "Utilities": "servicios", "Payment/Credit": "otro",
  "Airfare": "transporte", "Lodging": "transporte", "Other": "otro",
  "Internet": "servicios", "Professional Services": "servicios", "Car Rental": "transporte",
  "Fee/Interest Charge": "otro",
};

const AMEX_CATS = {
  "Restaurant": "restaurantes", "Groceries": "supermercado", "General Retail": "hogar",
  "Internet Purchase": "hogar", "Mail Order": "hogar", "Fuel": "transporte",
  "Vehicle": "transporte", "Cable": "servicios", "Communications": "servicios",
  "Business Services": "servicios",
};

const mapCapitalOne = (row) => {
  const date   = row["Transaction Date"] || "";
  const desc   = row["Description"] || "";
  const cat    = VISA_CATS[row["Category"]] || "otro";
  const debit  = parseFloat(row["Debit"]) || 0;
  const credit = parseFloat(row["Credit"]) || 0;
  const amount = debit > 0 ? debit : (credit > 0 ? -credit : 0);
  if (!date || amount === 0) return null;
  const result = {
    expense_date: date.slice(0, 10), concept: desc.slice(0, 100),
    category: cat, who: "Miguel", amount, payment_method: "tarjeta",
    source: "Capital One Visa",
  };
  result.country = detectCountry(result);
  return result;
};

const mapAmex = (row) => {
  const date   = row["Date"] || "";
  const desc   = row["Description"] || "";
  const member = row["Card Member"] || "";
  const amount = parseFloat(row["Amount"] || 0);
  const category = row["Category"] || "";
  if (!date || !amount) return null;

  let dateIso = date;
  if (date.includes("/")) {
    const p = date.split("/");
    dateIso = (p[2].length === 2 ? `20${p[2]}` : p[2]) + `-${p[0].padStart(2, "0")}-${p[1].padStart(2, "0")}`;
  }

  let cat = "otro";
  for (const [k, v] of Object.entries(AMEX_CATS)) {
    if (category.toLowerCase().includes(k.toLowerCase())) { cat = v; break; }
  }

  const who = member.toUpperCase().includes("HINOJOSA") ? "AnaP" : "Miguel";
  const result = {
    expense_date: dateIso.slice(0, 10), concept: desc.slice(0, 100).trim(),
    category: cat, who, amount: Math.abs(amount), payment_method: "tarjeta",
    source: "AmEx",
  };
  result.country = detectCountry(result);
  return result;
};
