// ═══════════════════════════════════════════
// Archivo: src/pages/OwnersPage.jsx
// Versión: V1
// Fecha: 2026-03-10
// ═══════════════════════════════════════════
// DESCRIPCIÓN:
// Página dedicada a los dueños de propiedades.
// Muestra 4 tabs por dueño:
//   1. Documentos  — documentos en Supabase filtrados por dueño
//   2. Impuestos   — property_taxes agrupados de todas sus propiedades
//   3. Cuentas     — owner_bank_accounts (tabla nueva, graceful fallback)
//   4. Gastos      — property_expenses agrupados por tipo y año
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { supaFetch, supaInsert, supaDelete } from "../lib/supabase";
import { Card, Badge, Spinner, Btn } from "../components/UI";
import { PROPERTIES, OWNER_COLORS, OWNER_SHORT, getPropExpenseTypes } from "./dashboard/constants";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const unique = (arr) => [...new Set(arr)];

// Propiedades agrupadas por dueño
const OWNERS = unique(PROPERTIES.map((p) => p.owner)).sort();

const ownerProps = (ownerName) => PROPERTIES.filter((p) => p.owner === ownerName);

const TABS = [
  { id: "documentos", label: "Documentos", icon: "📄" },
  { id: "impuestos",  label: "Impuestos",  icon: "🏛️" },
  { id: "cuentas",    label: "Cuentas",    icon: "🏦" },
  { id: "gastos",     label: "Gastos",     icon: "💸" },
];

// ─── Sub-component: Tab bar ──────────────────────────────────────────────────
const TabBar = ({ active, onChange, mob }) => (
  <div style={{
    display: "flex", gap: 4,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: 20,
    overflowX: "auto",
  }}>
    {TABS.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          padding: mob ? "8px 14px" : "10px 20px",
          background: "none",
          border: "none",
          borderBottom: active === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
          cursor: "pointer",
          fontFamily: "DM Sans",
          fontSize: mob ? 12 : 13,
          fontWeight: active === t.id ? 600 : 400,
          color: active === t.id ? C.accent : C.textDim,
          whiteSpace: "nowrap",
          transition: "all 0.15s",
          marginBottom: -1,
        }}
      >
        {t.icon} {t.label}
      </button>
    ))}
  </div>
);

// ─── Tab: Documentos ────────────────────────────────────────────────────────
const DocumentosTab = ({ ownerName, mob }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Filter documents whose folder_path contains the owner short name or property address
        const props = ownerProps(ownerName).map((p) => p.address);
        const allDocs = await supaFetch("documents", { order: "folder_path,title" });
        const short = (OWNER_SHORT[ownerName] || ownerName).toLowerCase();
        const ownerLower = ownerName.toLowerCase();
        const filtered = (allDocs || []).filter((d) => {
          const path = (d.folder_path || "").toLowerCase();
          const title = (d.title || "").toLowerCase();
          return (
            path.includes(short) ||
            path.includes(ownerLower) ||
            props.some((addr) => path.includes(addr.toLowerCase()) || title.includes(addr.toLowerCase()))
          );
        });
        setDocs(filtered);
      } catch (err) {
        console.error("[OwnersPage] Error loading docs:", err);
        setDocs([]);
      }
      setLoading(false);
    };
    load();
  }, [ownerName]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  if (docs.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
          No hay documentos indexados para este dueño.
        </div>
      </Card>
    );
  }

  // Group by folder_path
  const byFolder = {};
  docs.forEach((d) => {
    const folder = d.folder_path || "Sin carpeta";
    if (!byFolder[folder]) byFolder[folder] = [];
    byFolder[folder].push(d);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Object.entries(byFolder).map(([folder, items]) => (
        <Card key={folder}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            📁 {folder}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((doc, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 10px", background: C.surface2, borderRadius: 7,
                gap: 8,
              }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📄 {doc.title || doc.file_name || "Sin nombre"}
                </span>
                {doc.drive_file_id && (
                  <a
                    href={`https://drive.google.com/file/d/${doc.drive_file_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "DM Sans", fontSize: 11, color: C.accent, textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    Ver ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};

// ─── Tab: Impuestos ──────────────────────────────────────────────────────────
const ImpuestosTab = ({ ownerName, mob }) => {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const props = ownerProps(ownerName);
        const results = await Promise.all(
          props.map((p) =>
            supaFetch("property_taxes", {
              filters: `property_address=eq.${encodeURIComponent(p.address)}`,
              order: "tax_year.desc",
            })
          )
        );
        const all = results.flat().filter(Boolean);
        setTaxes(all);
        // Default to most recent year
        const years = unique(all.map((t) => t.tax_year)).sort((a, b) => b - a);
        if (years.length > 0) setSelYear(years[0]);
      } catch (err) {
        console.error("[OwnersPage] Error loading taxes:", err);
      }
      setLoading(false);
    };
    load();
  }, [ownerName]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  const years = unique(taxes.map((t) => t.tax_year)).sort((a, b) => b - a);
  const filtered = selYear ? taxes.filter((t) => t.tax_year === selYear) : taxes;
  const total = filtered.reduce((s, t) => s + Number(t.property_tax || 0), 0);

  const selectStyle = {
    fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
    background: C.surface2, color: C.accent,
    border: `1px solid ${C.border}`, borderRadius: 6,
    padding: "4px 10px", cursor: "pointer",
  };

  if (taxes.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
          No hay registros de impuestos para este dueño.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Year selector + total */}
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>
            🏛️ Property Taxes
          </span>
          {years.length > 0 && (
            <select value={selYear || ""} onChange={(e) => setSelYear(Number(e.target.value))} style={selectStyle}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: C.accentGlow, borderRadius: 8 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Total {selYear}</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: C.accent }}>{fmt(total)}</span>
        </div>
      </Card>

      {/* Table of taxes by property */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Detalle por Propiedad — {selYear}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
            Sin registros para {selYear}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((t, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 12px", background: C.surface2, borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.property_address}
                  </div>
                  {t.paid_date && (
                    <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      Pagado: {t.paid_date}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.text }}>
                    {fmt(Number(t.property_tax || 0))}
                  </div>
                  {t.status && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6,
                      background: t.status === "paid" ? `${C.green}20` : `${C.red}20`,
                      color: t.status === "paid" ? C.green : C.red,
                    }}>
                      {t.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historical bar chart by year */}
      {years.length > 1 && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Historial por Año
          </div>
          {years.map((yr) => {
            const ytotal = taxes.filter((t) => t.tax_year === yr).reduce((s, t) => s + Number(t.property_tax || 0), 0);
            const maxY = Math.max(...years.map((y) => taxes.filter((t) => t.tax_year === y).reduce((s, t) => s + Number(t.property_tax || 0), 0)));
            const pct = maxY > 0 ? (ytotal / maxY) * 100 : 0;
            return (
              <div key={yr} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: yr === selYear ? C.accent : C.textDim, fontWeight: yr === selYear ? 600 : 400 }}>{yr}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: yr === selYear ? C.accent : C.text }}>{fmt(ytotal)}</span>
                </div>
                <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: yr === selYear ? C.accent : C.border, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};

// ─── Tab: Cuentas Bancarias ──────────────────────────────────────────────────
const CuentasTab = ({ ownerName, mob }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ bank_name: "", account_type: "", account_number: "", balance: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await supaFetch("owner_bank_accounts", {
        filters: `owner_name=eq.${encodeURIComponent(ownerName)}`,
        order: "bank_name",
      });
      setAccounts(rows || []);
      setTableExists(true);
    } catch (err) {
      // Table may not exist yet — show graceful empty state
      setTableExists(false);
      setAccounts([]);
    }
    setLoading(false);
  }, [ownerName]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.bank_name.trim()) return;
    try {
      await supaInsert("owner_bank_accounts", {
        owner_name: ownerName,
        bank_name: form.bank_name,
        account_type: form.account_type,
        account_number: form.account_number,
        balance: form.balance ? Number(form.balance) : null,
        notes: form.notes,
      });
      setForm({ bank_name: "", account_type: "", account_number: "", balance: "", notes: "" });
      setAdding(false);
      load();
    } catch (err) {
      console.error("[OwnersPage] Error adding account:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta cuenta?")) return;
    try {
      await supaDelete("owner_bank_accounts", id);
      load();
    } catch (err) {
      console.error("[OwnersPage] Error deleting account:", err);
    }
  };

  const inputS = {
    fontFamily: "DM Sans", fontSize: 13, background: C.surface2,
    border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
    color: C.text, outline: "none", width: "100%",
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary card */}
      {accounts.length > 0 && (
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>
              🏦 {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700, color: C.green }}>
              {fmt(totalBalance)}
            </span>
          </div>
        </Card>
      )}

      {/* Account list */}
      {accounts.length > 0 && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {accounts.map((acc, i) => (
              <div key={acc.id || i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", background: C.surface2, borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>{acc.bank_name}</div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    {[acc.account_type, acc.account_number].filter(Boolean).join(" · ")}
                    {acc.notes ? ` · ${acc.notes}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {acc.balance != null && (
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: C.green }}>
                      {fmt(Number(acc.balance))}
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(acc.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, marginTop: 2 }}
                    onMouseEnter={e => e.currentTarget.style.color = C.red}
                    onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !adding && (
        <Card>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              {tableExists
                ? "No hay cuentas registradas para este dueño."
                : "La tabla owner_bank_accounts aún no existe en Supabase."}
            </div>
          </div>
        </Card>
      )}

      {/* Add form */}
      {adding && (
        <Card>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>
            ➕ Nueva Cuenta
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { key: "bank_name", label: "Banco *", placeholder: "Chase, Citi, BBVA…" },
              { key: "account_type", label: "Tipo", placeholder: "Checking, Savings, Business…" },
              { key: "account_number", label: "Últimos 4 dígitos", placeholder: "xxxx" },
              { key: "balance", label: "Balance", placeholder: "0.00", type: "number" },
              { key: "notes", label: "Notas", placeholder: "Notas opcionales" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>{label}</div>
                <input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={inputS}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn onClick={handleAdd} small>Guardar</Btn>
              <Btn onClick={() => setAdding(false)} small outline>Cancelar</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Add button */}
      {!adding && tableExists && (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 16px", background: "none",
            border: `1px dashed ${C.border}`, borderRadius: 10,
            cursor: "pointer", color: C.textDim, fontFamily: "DM Sans", fontSize: 13,
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
        >
          + Agregar Cuenta
        </button>
      )}
    </div>
  );
};

// ─── Tab: Gastos ─────────────────────────────────────────────────────────────
const GastosTab = ({ ownerName, mob }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const props = ownerProps(ownerName);
        const results = await Promise.all(
          props.map((p) =>
            supaFetch("property_expenses", {
              filters: `property_address=eq.${encodeURIComponent(p.address)}`,
              order: "period_year.desc,period_month.desc",
            })
          )
        );
        const all = results.flat().filter(Boolean).map((e) => ({ ...e, amount: Number(e.amount || 0) }));
        setExpenses(all);
        const years = unique(all.map((e) => e.period_year)).sort((a, b) => b - a);
        if (years.length > 0) setSelYear(years[0]);
      } catch (err) {
        console.error("[OwnersPage] Error loading expenses:", err);
      }
      setLoading(false);
    };
    load();
  }, [ownerName]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>;

  const years = unique(expenses.map((e) => e.period_year)).sort((a, b) => b - a);
  const yearData = selYear ? expenses.filter((e) => e.period_year === selYear) : expenses;

  // Group by expense_type
  const byType = {};
  yearData.forEach((e) => {
    if (!byType[e.expense_type]) byType[e.expense_type] = { total: 0, rows: [] };
    byType[e.expense_type].total += e.amount;
    byType[e.expense_type].rows.push(e);
  });

  const sortedTypes = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = sortedTypes.reduce((s, [, v]) => s + v.total, 0);
  const incomeTotal = sortedTypes.filter(([k]) => k === "gross_rents").reduce((s, [, v]) => s + v.total, 0);
  const expenseTotal = grandTotal - incomeTotal;

  const TYPE_LABELS = {
    gross_rents: { label: "Rentas Totales", icon: "💰", income: true },
    maintenance: { label: "Maintenance", icon: "🔧" },
    insurance: { label: "Insurance", icon: "🛡️" },
    legal_fees: { label: "Legal Fees", icon: "⚖️" },
    repairs: { label: "Repairs", icon: "🔨" },
    property_tax: { label: "Property Taxes", icon: "🏛️" },
    utilities: { label: "Utilities", icon: "💡" },
    depreciation: { label: "Depreciation", icon: "📉" },
    other_expenses: { label: "Other", icon: "📋" },
    electricity: { label: "Luz", icon: "💡" },
    water: { label: "Agua", icon: "💧" },
    gas: { label: "Gas", icon: "🔥" },
    hoa: { label: "Mantenimiento", icon: "🏘️" },
  };

  const selectStyle = {
    fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
    background: C.surface2, color: C.accent,
    border: `1px solid ${C.border}`, borderRadius: 6,
    padding: "4px 10px", cursor: "pointer",
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontFamily: "DM Sans", fontSize: 13 }}>
          No hay gastos registrados para este dueño.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary card */}
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text }}>Resumen {selYear}</span>
          {years.length > 0 && (
            <select value={selYear || ""} onChange={(e) => setSelYear(Number(e.target.value))} style={selectStyle}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {incomeTotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: `${C.green}12`, borderRadius: 8 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.green }}>💰 Rentas Totales</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.green }}>{fmt(incomeTotal)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.accentGlow, borderRadius: 8 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>💸 Total Gastos</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(expenseTotal)}</span>
          </div>
          {incomeTotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: incomeTotal - expenseTotal >= 0 ? `${C.green}10` : `${C.red}10`, borderRadius: 8 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: incomeTotal - expenseTotal >= 0 ? C.green : C.red }}>📊 Net</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 700, color: incomeTotal - expenseTotal >= 0 ? C.green : C.red }}>{fmt(incomeTotal - expenseTotal)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Expenses by type, expandable */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Detalle por Categoría
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedTypes.map(([type, { total, rows }]) => {
            const meta = TYPE_LABELS[type] || { label: type, icon: "📋" };
            const isOpen = expanded[type];
            const isIncome = meta.income;
            return (
              <div key={type}>
                <button
                  onClick={() => setExpanded((ex) => ({ ...ex, [type]: !isOpen }))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", background: isIncome ? `${C.green}12` : C.surface2,
                    borderRadius: isOpen ? "8px 8px 0 0" : 8, border: "none", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isIncome ? `${C.green}20` : C.accentGlow}
                  onMouseLeave={e => e.currentTarget.style.background = isIncome ? `${C.green}12` : C.surface2}
                >
                  <span style={{ fontSize: 14 }}>{meta.icon}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: isIncome ? C.green : C.text, flex: 1, textAlign: "left" }}>{meta.label}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600, color: isIncome ? C.green : C.accent }}>{fmt(total)}</span>
                  <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div style={{ background: C.surface, borderRadius: "0 0 8px 8px", border: `1px solid ${C.border}`, borderTop: "none" }}>
                    {rows.slice(0, 50).map((r, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 14px", borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                            {r.property_address}
                          </span>
                          <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>
                            {r.period_year}{r.period_month ? `/${String(r.period_month).padStart(2, "0")}` : ""}
                            {r.notes ? ` · ${r.notes}` : ""}
                          </span>
                        </div>
                        <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: isIncome ? C.green : C.text, flexShrink: 0, marginLeft: 8 }}>
                          {fmt(r.amount)}
                        </span>
                      </div>
                    ))}
                    {rows.length > 50 && (
                      <div style={{ padding: "6px 14px", fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>
                        +{rows.length - 50} más…
                      </div>
                    )}
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

// ─── Owner Detail View ───────────────────────────────────────────────────────
const OwnerPageDetail = ({ ownerName, mob, onBack }) => {
  const [tab, setTab] = useState("documentos");
  const color = OWNER_COLORS[ownerName] || C.accent;
  const props = ownerProps(ownerName);
  const activeProps = props.filter((p) => !p.sold);
  const soldProps = props.filter((p) => p.sold);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}
        >
          {I.back}
        </button>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${color}20`, border: `1px solid ${color}60`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          🏢
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 22, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {ownerName}
          </h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>
              {activeProps.length} propiedades activas
            </span>
            {soldProps.length > 0 && (
              <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>
                · {soldProps.length} vendidas
              </span>
            )}
          </div>
        </div>
        {/* Property chips */}
        {!mob && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 300 }}>
            {activeProps.slice(0, 4).map((p, i) => (
              <span key={i} style={{
                fontFamily: "DM Sans", fontSize: 10, padding: "3px 8px",
                background: `${color}15`, color, borderRadius: 6, border: `1px solid ${color}30`,
              }}>
                {p.address.split(" ").slice(0, 2).join(" ")}
              </span>
            ))}
            {activeProps.length > 4 && (
              <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, padding: "3px 4px" }}>
                +{activeProps.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <TabBar active={tab} onChange={setTab} mob={mob} />

      {/* Tab content */}
      {tab === "documentos" && <DocumentosTab ownerName={ownerName} mob={mob} />}
      {tab === "impuestos"  && <ImpuestosTab  ownerName={ownerName} mob={mob} />}
      {tab === "cuentas"    && <CuentasTab    ownerName={ownerName} mob={mob} />}
      {tab === "gastos"     && <GastosTab     ownerName={ownerName} mob={mob} />}
    </div>
  );
};

// ─── Owner card (list view) ──────────────────────────────────────────────────
const OwnerCard = ({ ownerName, onClick, mob }) => {
  const color = OWNER_COLORS[ownerName] || C.accent;
  const props = ownerProps(ownerName);
  const active = props.filter((p) => !p.sold);
  const sold = props.filter((p) => p.sold);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        padding: mob ? "14px 16px" : "18px 20px",
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, cursor: "pointer",
        transition: "all 0.2s",
        animation: "fadeIn 0.4s ease both",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}08`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}20`, border: `1px solid ${color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0,
        }}>
          🏢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: mob ? 15 : 17, fontWeight: 700, color, marginBottom: 4 }}>
            {ownerName}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.text }}>
              🏠 {active.length} activas
            </span>
            {sold.length > 0 && (
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>
                · {sold.length} vendidas
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {TABS.map((t) => (
            <span key={t.id} style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>
              {t.icon}
            </span>
          ))}
        </div>
        <span style={{ color: C.textDim, fontSize: 14, marginLeft: 4 }}>▸</span>
      </div>
    </button>
  );
};

// ─── Main Export ─────────────────────────────────────────────────────────────
export const OwnersPage = ({ mob }) => {
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <OwnerPageDetail ownerName={selected} mob={mob} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 26, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          🏢 Dueños
        </h1>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
          Documentos, impuestos, cuentas y gastos por propietario.
        </p>
      </div>

      {/* Owner grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OWNERS.map((ownerName) => (
          <OwnerCard
            key={ownerName}
            ownerName={ownerName}
            mob={mob}
            onClick={() => setSelected(ownerName)}
          />
        ))}
      </div>
    </div>
  );
};
