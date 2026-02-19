import { useState, useEffect, useCallback } from "react";

// ─── Supabase Config ───
const SUPABASE_URL = "https://ziwkberfwctlvlwejznc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppd2tiZXJmd2N0bHZsd2Vqem5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjI1NTEsImV4cCI6MjA4NzA5ODU1MX0.MCALDM7gFOyIVuRQjis2rTP_FIsx-7deRJs-799Hm-8";

const supaFetch = async (table, options = {}) => {
  const { select = "*", order, filters, rpc } = options;
  let url;
  if (rpc) {
    url = `${SUPABASE_URL}/rest/v1/rpc/${rpc}`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (order) url += `&order=${order}`;
    if (filters) url += `&${filters}`;
  }
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: rpc ? "return=representation" : undefined,
    },
    method: rpc ? "POST" : "GET",
    body: rpc ? JSON.stringify({}) : undefined,
  });
  return res.json();
};

const supaUpdate = async (table, id, data) => {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
};

const supaInsert = async (table, data) => {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
};

// ─── Formatters ───
const fmt = (n, decimals = 0) => {
  if (n == null || isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n);
};
const pct = (n) => `${(n * 100).toFixed(1)}%`;

// ─── Responsive hook ───
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

// ─── Icons (inline SVG) ───
const Icons = {
  dashboard: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  income: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2v20M17 7l-5-5-5 5"/><path d="M3 17h18"/></svg>,
  expenses: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>,
  patrimony: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 21h18M3 10h18M5 6l7-3 7 3"/><path d="M6 10v11M10 10v11M14 10v11M18 10v11"/></svg>,
  checklist: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  docs: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  daily: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  projection: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  edit: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  plus: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  menu: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  close: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ─── Styles ───
const COLORS = {
  bg: "#0C0F14", surface: "#151920", surface2: "#1C2230",
  border: "#2A3040", borderLight: "#353D50",
  accent: "#C8A862", accentDim: "#A08840", accentGlow: "rgba(200,168,98,0.12)",
  green: "#4ADE80", greenDim: "rgba(74,222,128,0.15)",
  red: "#F87171", redDim: "rgba(248,113,113,0.15)",
  blue: "#60A5FA", blueDim: "rgba(96,165,250,0.15)",
  text: "#E8E4DC", textDim: "#8A8A8A", textMuted: "#5A5A5A",
  white: "#FFFFFF",
};

const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${COLORS.bg}; overflow-x: hidden; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
  @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

// ─── Components ───

const Card = ({ children, style, delay = 0 }) => (
  <div style={{
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: 14, padding: "18px 16px",
    animation: `fadeIn 0.5s ease ${delay}s both`,
    ...style,
  }}>{children}</div>
);

const StatCard = ({ label, value, sub, color = COLORS.accent, icon, delay = 0, isMobile }) => (
  <Card delay={delay} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, padding: isMobile ? "14px 12px" : "22px 24px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontFamily: "DM Sans", fontSize: isMobile ? 11 : 13, color: COLORS.textDim, fontWeight: 500, letterSpacing: 0.5 }}>{label}</span>
      {icon && !isMobile && <span style={{ color, opacity: 0.6 }}>{icon}</span>}
    </div>
    <span style={{ fontFamily: "JetBrains Mono", fontSize: isMobile ? 17 : 22, fontWeight: 500, color, letterSpacing: -0.5 }}>{value}</span>
    {sub && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textMuted }}>{sub}</span>}
  </Card>
);

const SectionTitle = ({ children, icon, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {icon && <span style={{ color: COLORS.accent }}>{icon}</span>}
      <h2 style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 600, color: COLORS.text, letterSpacing: 0.3 }}>{children}</h2>
    </div>
    {action}
  </div>
);

const Badge = ({ children, color = COLORS.accent }) => (
  <span style={{
    fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 500,
    background: `${color}20`, color, padding: "3px 10px",
    borderRadius: 20, letterSpacing: 0.3, whiteSpace: "nowrap",
  }}>{children}</span>
);

const MiniBar = ({ value, max, color = COLORS.accent }) => {
  const pctVal = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: "100%", height: 6, background: COLORS.surface2, borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        width: `${pctVal}%`, height: "100%", background: color,
        borderRadius: 3, transformOrigin: "left",
        animation: "barGrow 0.8s ease both",
      }} />
    </div>
  );
};

const Table = ({ columns, data, onEdit, isMobile }) => (
  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: "DM Sans", minWidth: isMobile ? 500 : "auto" }}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{
              textAlign: col.align || "left", padding: isMobile ? "8px 10px" : "10px 14px",
              fontSize: 11, fontWeight: 600, color: COLORS.textDim,
              letterSpacing: 0.5, textTransform: "uppercase",
              borderBottom: `1px solid ${COLORS.border}`,
              whiteSpace: "nowrap",
            }}>{col.label}</th>
          ))}
          {onEdit && <th style={{ width: 40, borderBottom: `1px solid ${COLORS.border}` }} />}
        </tr>
      </thead>
      <tbody>
        {data.map((row, ri) => (
          <tr key={ri} style={{ transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {columns.map((col, ci) => (
              <td key={ci} style={{
                textAlign: col.align || "left", padding: isMobile ? "9px 10px" : "11px 14px",
                fontSize: isMobile ? 13 : 14, color: col.color ? col.color(row) : COLORS.text,
                fontFamily: col.mono ? "JetBrains Mono" : "DM Sans",
                fontWeight: col.bold ? 600 : 400,
                borderBottom: `1px solid ${COLORS.border}08`,
                whiteSpace: "nowrap",
              }}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
            {onEdit && (
              <td style={{ padding: "8px", borderBottom: `1px solid ${COLORS.border}08` }}>
                <button onClick={() => onEdit(row)} style={{
                  background: "none", border: "none", color: COLORS.textDim,
                  cursor: "pointer", padding: 4, borderRadius: 6,
                  display: "flex", alignItems: "center",
                }} onMouseEnter={e => e.currentTarget.style.color = COLORS.accent}
                   onMouseLeave={e => e.currentTarget.style.color = COLORS.textDim}>
                  {Icons.edit}
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Loading = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 8 }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 8, height: 8, borderRadius: "50%", background: COLORS.accent,
        animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
      }} />
    ))}
  </div>
);

// ─── Nav Item ───
const NavItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 12,
    width: "100%", padding: "10px 16px",
    background: active ? COLORS.accentGlow : "transparent",
    border: "none", borderRadius: 10, cursor: "pointer",
    color: active ? COLORS.accent : COLORS.textDim,
    fontFamily: "DM Sans", fontSize: 14, fontWeight: active ? 600 : 400,
    transition: "all 0.2s", letterSpacing: 0.2,
    borderLeft: active ? `3px solid ${COLORS.accent}` : "3px solid transparent",
    textAlign: "left",
  }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = COLORS.surface2; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? COLORS.accentGlow : "transparent"; }}>
    {icon}
    <span>{label}</span>
  </button>
);

// ─── PAGES ───

// Dashboard Overview
const DashboardPage = ({ data, isMobile }) => {
  const { profiles, income, retIncome, expenses, assets, debts, checklist } = data;
  const totalAssets = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalDebts = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const netWorth = totalAssets - totalDebts;
  const totalIncomeMonthly = income.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const totalRetExpMonthly = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);
  const totalRetIncMonthly = retIncome.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const checkDone = checklist.filter(c => c.is_completed).length;
  const checkTotal = checklist.length;
  const miguel = profiles.find(p => p.name === "Miguel");
  const greeting = miguel ? miguel.name : (profiles[0]?.name || "");

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: COLORS.text, letterSpacing: -0.5 }}>
          Buenos días, {greeting} 👋
        </h1>
        <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginTop: 4 }}>
          Resumen financiero — {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 28 }}>
        <StatCard label="PATRIMONIO NETO" value={fmt(netWorth)} sub={`Activos: ${fmt(totalAssets)}`} color={netWorth >= 0 ? COLORS.green : COLORS.red} icon={Icons.patrimony} delay={0.05} isMobile={isMobile} />
        <StatCard label="INGRESOS ACTUALES" value={fmt(totalIncomeMonthly)} sub="Mensuales" color={COLORS.blue} icon={Icons.income} delay={0.1} isMobile={isMobile} />
        <StatCard label="GASTOS RETIRO" value={fmt(totalRetExpMonthly)} sub="Mensuales estimados" color={COLORS.red} icon={Icons.expenses} delay={0.15} isMobile={isMobile} />
        <StatCard label="INGRESOS RETIRO" value={fmt(totalRetIncMonthly)} sub="Mensuales proyectados" color={COLORS.green} icon={Icons.income} delay={0.2} isMobile={isMobile} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: isMobile ? 16 : 28 }}>
        <Card delay={0.25}>
          <SectionTitle icon={Icons.patrimony}>Perfiles</SectionTitle>
          <div style={{ display: "flex", gap: isMobile ? 10 : 20, flexDirection: isMobile ? "column" : "row" }}>
            {profiles.map((p, i) => (
              <div key={i} style={{
                flex: 1, padding: isMobile ? 12 : 16, background: COLORS.surface2,
                borderRadius: 10, border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 600, color: COLORS.accent, marginBottom: 10 }}>{p.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[["Edad", p.current_age], ["Expectativa", p.life_expectancy], ["Años en retiro", p.retirement_years]].map(([label, val], j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.textDim }}>{label}</span>
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: j === 2 ? COLORS.green : COLORS.text }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.3}>
          <SectionTitle icon={Icons.checklist}>Checklist Pre-Retiro</SectionTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div style={{ flex: 1 }}><MiniBar value={checkDone} max={checkTotal} color={COLORS.green} /></div>
            <Badge color={COLORS.green}>{checkDone}/{checkTotal}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["FINANZAS", "SEGUROS Y SALUD", "LEGAL Y FISCAL", "PENSIONES"].map(cat => {
              const items = checklist.filter(c => c.category === cat);
              const done = items.filter(c => c.is_completed).length;
              return (
                <div key={cat} style={{ padding: "8px 12px", background: COLORS.surface2, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textDim }}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: done === items.length ? COLORS.green : COLORS.text }}>{done}/{items.length}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card delay={0.35}>
        <SectionTitle icon={Icons.projection}>Balance Retiro: Ingresos vs Gastos</SectionTitle>
        <div style={{ display: "flex", gap: isMobile ? 12 : 24, alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
          <div style={{ flex: 1, width: "100%" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.green }}>Ingresos retiro</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: COLORS.green }}>{fmt(totalRetIncMonthly)}/mes</span>
              </div>
              <MiniBar value={totalRetIncMonthly} max={Math.max(totalRetIncMonthly, totalRetExpMonthly)} color={COLORS.green} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.red }}>Gastos retiro</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: COLORS.red }}>{fmt(totalRetExpMonthly)}/mes</span>
              </div>
              <MiniBar value={totalRetExpMonthly} max={Math.max(totalRetIncMonthly, totalRetExpMonthly)} color={COLORS.red} />
            </div>
          </div>
          <div style={{
            padding: isMobile ? "12px 20px" : "16px 24px",
            background: totalRetIncMonthly >= totalRetExpMonthly ? COLORS.greenDim : COLORS.redDim,
            borderRadius: 12, textAlign: "center", minWidth: isMobile ? "100%" : 140,
          }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Diferencia</div>
            <div style={{
              fontFamily: "JetBrains Mono", fontSize: isMobile ? 18 : 20, fontWeight: 600,
              color: totalRetIncMonthly >= totalRetExpMonthly ? COLORS.green : COLORS.red,
            }}>{fmt(totalRetIncMonthly - totalRetExpMonthly)}</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textDim }}>mensual</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Income Pages
const IncomePage = ({ title, subtitle, items, fields, isMobile }) => (
  <div>
    <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{title}</h1>
    <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>{subtitle}</p>
    <Card>
      <Table columns={fields} data={items} isMobile={isMobile} />
      <div style={{
        display: "flex", justifyContent: "flex-end", padding: "14px 14px 0",
        borderTop: `1px solid ${COLORS.border}`, marginTop: 8,
      }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, fontWeight: 600, color: COLORS.textDim }}>TOTAL MENSUAL</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: isMobile ? 17 : 20, fontWeight: 600, color: COLORS.accent }}>
            {fmt(items.reduce((s, i) => s + Number(i.monthly_amount || 0), 0))}
          </span>
        </div>
      </div>
    </Card>
  </div>
);

// Expenses Page
const ExpensesPage = ({ expenses, categories, isMobile }) => {
  const grouped = categories.map(cat => ({
    ...cat,
    items: expenses.filter(e => e.category_id === cat.id),
    subtotal: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.monthly_amount || 0), 0),
  }));
  const total = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Gastos en Retiro</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Proyección de gastos mensuales</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(140px, 1fr))", gap: isMobile ? 8 : 12, marginBottom: 20 }}>
        {grouped.map((g, i) => (
          <Card key={i} delay={i * 0.05} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{g.icon}</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>{g.name}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: isMobile ? 14 : 16, fontWeight: 600, color: COLORS.accent }}>{fmt(g.subtotal)}</div>
          </Card>
        ))}
        <Card delay={0.3} style={{ padding: "12px 14px", textAlign: "center", borderColor: COLORS.accent }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>💰</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>TOTAL</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: isMobile ? 14 : 16, fontWeight: 600, color: COLORS.red }}>{fmt(total)}</div>
        </Card>
      </div>

      {grouped.map((g, gi) => (
        <Card key={gi} delay={gi * 0.05} style={{ marginBottom: 14 }}>
          <SectionTitle icon={<span style={{ fontSize: 18 }}>{g.icon}</span>}>{g.name}</SectionTitle>
          <Table columns={[
            { label: "Concepto", key: "concept", bold: true },
            { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
            { label: "Notas", key: "notes", color: () => COLORS.textDim },
          ]} data={g.items} isMobile={isMobile} />
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, marginTop: 8 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.textDim, marginRight: 12 }}>Subtotal</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 600, color: COLORS.accent }}>{fmt(g.subtotal)}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};

// Patrimony Page
const PatrimonyPage = ({ assets, debts, isMobile }) => {
  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Patrimonio</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Activos, inversiones y deudas</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 10 : 16, marginBottom: 20 }}>
        <StatCard label="TOTAL ACTIVOS" value={fmt(totalA)} color={COLORS.green} delay={0.05} isMobile={isMobile} />
        <StatCard label="TOTAL DEUDAS" value={fmt(totalD)} color={COLORS.red} delay={0.1} isMobile={isMobile} />
        <StatCard label="PATRIMONIO NETO" value={fmt(totalA - totalD)} color={totalA - totalD >= 0 ? COLORS.accent : COLORS.red} delay={0.15} isMobile={isMobile} />
      </div>

      <Card delay={0.2} style={{ marginBottom: 14 }}>
        <SectionTitle icon={Icons.patrimony}>Activos</SectionTitle>
        <Table columns={[
          { label: "Activo", key: "name", bold: true },
          { label: "Tipo", key: "asset_type", render: r => <Badge color={r.asset_type === "real_estate" ? COLORS.blue : r.asset_type === "investment" ? COLORS.green : COLORS.accent}>
            {r.asset_type === "real_estate" ? "Inmueble" : r.asset_type === "investment" ? "Inversión" : r.asset_type === "business" ? "Negocio" : "Otro"}</Badge> },
          { label: "Valor Actual", key: "current_value", align: "right", mono: true, render: r => fmt(Number(r.current_value)) },
        ]} data={assets} isMobile={isMobile} />
      </Card>

      <Card delay={0.25}>
        <SectionTitle icon={<span style={{ fontSize: 18 }}>💳</span>}>Deudas</SectionTitle>
        <Table columns={[
          { label: "Deuda", key: "name", bold: true },
          { label: "Saldo", key: "outstanding_balance", align: "right", mono: true, render: r => fmt(Number(r.outstanding_balance)), color: r => Number(r.outstanding_balance) > 0 ? COLORS.red : COLORS.text },
          { label: "Pago Mensual", key: "monthly_payment", align: "right", mono: true, render: r => fmt(Number(r.monthly_payment)) },
        ]} data={debts} isMobile={isMobile} />
      </Card>
    </div>
  );
};

// Checklist Page
const ChecklistPage = ({ checklist, onToggle, isMobile }) => {
  const cats = [...new Set(checklist.map(c => c.category))];
  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Checklist Pre-Retiro</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Marca cada tarea conforme la completes</p>
      {cats.map((cat, ci) => {
        const items = checklist.filter(c => c.category === cat);
        const done = items.filter(c => c.is_completed).length;
        return (
          <Card key={cat} delay={ci * 0.08} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: COLORS.accent }}>{cat}</span>
              <Badge color={done === items.length ? COLORS.green : COLORS.textDim}>{done}/{items.length}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((item) => (
                <button key={item.id} onClick={() => onToggle(item)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: isMobile ? "10px 12px" : "10px 14px",
                  background: item.is_completed ? COLORS.greenDim : COLORS.surface2,
                  border: `1px solid ${item.is_completed ? COLORS.green + "30" : COLORS.border}`,
                  borderRadius: 10, cursor: "pointer", width: "100%",
                  transition: "all 0.2s", textAlign: "left",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${item.is_completed ? COLORS.green : COLORS.borderLight}`,
                    background: item.is_completed ? COLORS.green : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.is_completed && <svg width="12" height="12" fill="none" stroke={COLORS.bg} strokeWidth="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>}
                  </div>
                  <span style={{
                    fontFamily: "DM Sans", fontSize: isMobile ? 13 : 14,
                    color: item.is_completed ? COLORS.textDim : COLORS.text,
                    textDecoration: item.is_completed ? "line-through" : "none",
                  }}>{item.action}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

// Projection Page
const ProjectionPage = ({ profiles, assumptions, isMobile }) => {
  const p1 = profiles.find(p => p.name === "Miguel") || profiles[0];
  const p2 = profiles.find(p => p.name === "AnaP") || profiles[1];
  const inflRate = assumptions.find(a => a.key === "inflation_rate");
  const preRet = assumptions.find(a => a.key === "pre_retirement_return");
  const retRet = assumptions.find(a => a.key === "retirement_return");
  const swr = assumptions.find(a => a.key === "safe_withdrawal_rate");

  const years = Array.from({ length: 31 }, (_, i) => ({
    year: i,
    ageP1: p1 ? p1.current_age + i : "-",
    ageP2: p2 ? p2.current_age + i : "-",
  }));

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Proyección 30 Años</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Simulación del patrimonio</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 12, marginBottom: 20 }}>
        {[inflRate, preRet, retRet, swr].filter(Boolean).map((a, i) => (
          <Card key={i} delay={i * 0.05} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 10, color: COLORS.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.label}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: isMobile ? 17 : 20, fontWeight: 600, color: COLORS.accent }}>{pct(Number(a.value))}</div>
          </Card>
        ))}
      </div>

      <Card delay={0.2}>
        <Table columns={[
          { label: "Año", key: "year", mono: true, bold: true },
          { label: `${p1?.name || "P1"}`, key: "ageP1", mono: true },
          { label: `${p2?.name || "P2"}`, key: "ageP2", mono: true },
          { label: "Aportación", key: "x", mono: true, align: "right", render: () => fmt(0) },
          { label: "Rendimiento", key: "x2", mono: true, align: "right", render: () => fmt(0) },
          { label: "Retiro", key: "x3", mono: true, align: "right", render: () => fmt(0) },
          { label: "Patrimonio", key: "x4", mono: true, align: "right", render: () => <span style={{ color: COLORS.accent }}>{fmt(0)}</span> },
        ]} data={years} isMobile={isMobile} />
      </Card>
    </div>
  );
};

// Daily Expenses Page
const DailyExpensesPage = ({ dailyExpenses, onAdd, isMobile }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" });

  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" });
    setShowForm(false);
  };

  const cats = ["supermercado", "transporte", "salud", "entretenimiento", "servicios", "restaurantes", "hogar", "otro"];

  const inputStyle = {
    background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "10px 14px", color: COLORS.text,
    fontFamily: "DM Sans", fontSize: 14, width: "100%", outline: "none",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Gastos del Día a Día</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Registro de gastos reales</p>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 24px", background: COLORS.accent,
          border: "none", borderRadius: 10, cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
          color: COLORS.bg, marginBottom: 20,
        }}>{Icons.plus} Registrar Gasto</button>
      ) : (
        <Card style={{ marginBottom: 20, borderColor: COLORS.accent }}>
          <SectionTitle>Nuevo Gasto</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Concepto" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} style={inputStyle} />
            <input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: "JetBrains Mono" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {cats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select value={form.who} onChange={e => setForm({ ...form, who: e.target.value })} style={inputStyle}>
              <option>Miguel</option><option>AnaP</option><option>Ambos</option>
            </select>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}>
              <option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSubmit} style={{
              padding: "10px 24px", background: COLORS.accent, border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans",
              fontSize: 14, fontWeight: 600, color: COLORS.bg, flex: isMobile ? 1 : "none",
            }}>Guardar</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "10px 24px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans",
              fontSize: 14, color: COLORS.textDim, flex: isMobile ? 1 : "none",
            }}>Cancelar</button>
          </div>
        </Card>
      )}

      <Card>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: isMobile ? 30 : 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, color: COLORS.textDim }}>Aún no hay gastos registrados</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.textMuted }}>Usa el botón "Registrar Gasto" para empezar</p>
          </div>
        ) : (
          <Table columns={[
            { label: "Fecha", key: "expense_date", mono: true },
            { label: "Concepto", key: "concept", bold: true },
            { label: "Categoría", key: "category", render: r => <Badge>{r.category}</Badge> },
            { label: "Quién", key: "who" },
            { label: "Monto", key: "amount", align: "right", mono: true, render: r => fmt(Number(r.amount)), color: () => COLORS.red },
          ]} data={dailyExpenses} isMobile={isMobile} />
        )}
      </Card>
    </div>
  );
};

// Documents Page
const DocumentsPage = ({ documents, onAdd, isMobile }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "seguros", google_drive_url: "", description: "" });

  const handleSubmit = async () => {
    if (!form.title) return;
    await onAdd(form);
    setForm({ title: "", category: "seguros", google_drive_url: "", description: "" });
    setShowForm(false);
  };

  const docCats = ["seguros", "inversiones", "impuestos", "legal", "propiedades", "personal", "otro"];
  const inputStyle = {
    background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "10px 14px", color: COLORS.text,
    fontFamily: "DM Sans", fontSize: 14, width: "100%", outline: "none",
  };

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Documentos</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: isMobile ? 12 : 14, color: COLORS.textDim, marginBottom: 20 }}>Índice de documentos en Google Drive</p>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 24px", background: COLORS.accent,
          border: "none", borderRadius: 10, cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
          color: COLORS.bg, marginBottom: 20,
        }}>{Icons.plus} Agregar Documento</button>
      ) : (
        <Card style={{ marginBottom: 20, borderColor: COLORS.accent }}>
          <SectionTitle>Nuevo Documento</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Título del documento" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {docCats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <input placeholder="URL de Google Drive" value={form.google_drive_url} onChange={e => setForm({ ...form, google_drive_url: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
          <input placeholder="Descripción (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSubmit} style={{
              padding: "10px 24px", background: COLORS.accent, border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: COLORS.bg, flex: isMobile ? 1 : "none",
            }}>Guardar</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "10px 24px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 14, color: COLORS.textDim, flex: isMobile ? 1 : "none",
            }}>Cancelar</button>
          </div>
        </Card>
      )}

      <Card>
        {documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: isMobile ? 30 : 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, color: COLORS.textDim }}>Aún no hay documentos indexados</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: COLORS.textMuted }}>Agrega tus documentos de Google Drive</p>
          </div>
        ) : (
          <Table columns={[
            { label: "Título", key: "title", bold: true },
            { label: "Categoría", key: "category", render: r => <Badge>{r.category}</Badge> },
            { label: "Descripción", key: "description", color: () => COLORS.textDim },
            { label: "Link", key: "google_drive_url", render: r => r.google_drive_url ? (
              <a href={r.google_drive_url} target="_blank" rel="noopener" style={{ color: COLORS.blue, textDecoration: "none", fontSize: 13 }}>Abrir ↗</a>
            ) : "—" },
          ]} data={documents} isMobile={isMobile} />
        )}
      </Card>
    </div>
  );
};

// ─── MAIN APP ───
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const [data, setData] = useState({
    profiles: [], assumptions: [], income: [], retIncome: [],
    expenses: [], expenseCategories: [], assets: [], debts: [],
    checklist: [], documents: [], dailyExpenses: [],
  });

  const loadData = useCallback(async () => {
    try {
      const [profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses] = await Promise.all([
        supaFetch("profiles", { order: "name" }),
        supaFetch("financial_assumptions", { order: "key" }),
        supaFetch("current_income", { order: "sort_order" }),
        supaFetch("retirement_income", { order: "sort_order" }),
        supaFetch("retirement_expenses", { order: "sort_order" }),
        supaFetch("expense_categories", { order: "sort_order" }),
        supaFetch("assets", { order: "sort_order" }),
        supaFetch("debts", { order: "sort_order" }),
        supaFetch("checklist_items", { order: "sort_order" }),
        supaFetch("documents", { order: "created_at.desc" }),
        supaFetch("daily_expenses", { order: "expense_date.desc,created_at.desc" }),
      ]);
      setData({ profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses });
    } catch (err) {
      console.error("Error loading data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleChecklist = async (item) => {
    await supaUpdate("checklist_items", item.id, {
      is_completed: !item.is_completed,
      completed_date: !item.is_completed ? new Date().toISOString().split("T")[0] : null,
    });
    loadData();
  };

  const addDailyExpense = async (expense) => {
    await supaInsert("daily_expenses", expense);
    loadData();
  };

  const addDocument = async (doc) => {
    await supaInsert("documents", doc);
    loadData();
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "income", label: "Ingresos Actuales", icon: Icons.income },
    { id: "retIncome", label: "Ingresos Retiro", icon: Icons.income },
    { id: "expenses", label: "Gastos Retiro", icon: Icons.expenses },
    { id: "patrimony", label: "Patrimonio", icon: Icons.patrimony },
    { id: "projection", label: "Proyección 30 Años", icon: Icons.projection },
    { id: "checklist", label: "Checklist", icon: Icons.checklist },
    { id: "daily", label: "Gastos Diarios", icon: Icons.daily },
    { id: "docs", label: "Documentos", icon: Icons.docs },
  ];

  const handleNav = (id) => {
    setPage(id);
    if (isMobile) setSidebarOpen(false);
  };

  const renderPage = () => {
    if (loading) return <Loading />;
    switch (page) {
      case "dashboard": return <DashboardPage data={data} isMobile={isMobile} />;
      case "income": return <IncomePage title="Ingresos Actuales" subtitle="Últimos ingresos antes de retirarse" items={data.income} isMobile={isMobile}
        fields={[
          { label: "Fuente", key: "source", bold: true },
          { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
          { label: "Notas", key: "notes", color: () => COLORS.textDim },
        ]} />;
      case "retIncome": return <IncomePage title="Ingresos en Retiro" subtitle="Fuentes de ingreso una vez retirados" items={data.retIncome} isMobile={isMobile}
        fields={[
          { label: "Fuente", key: "source", bold: true },
          { label: "Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
          { label: "Anual", key: "annual_amount", align: "right", mono: true, render: r => r.annual_amount ? fmt(Number(r.annual_amount)) : "—" },
          { label: "Notas", key: "notes", color: () => COLORS.textDim },
        ]} />;
      case "expenses": return <ExpensesPage expenses={data.expenses} categories={data.expenseCategories} isMobile={isMobile} />;
      case "patrimony": return <PatrimonyPage assets={data.assets} debts={data.debts} isMobile={isMobile} />;
      case "projection": return <ProjectionPage profiles={data.profiles} assumptions={data.assumptions} isMobile={isMobile} />;
      case "checklist": return <ChecklistPage checklist={data.checklist} onToggle={toggleChecklist} isMobile={isMobile} />;
      case "daily": return <DailyExpensesPage dailyExpenses={data.dailyExpenses} onAdd={addDailyExpense} isMobile={isMobile} />;
      case "docs": return <DocumentsPage documents={data.documents} onAdd={addDocument} isMobile={isMobile} />;
      default: return <DashboardPage data={data} isMobile={isMobile} />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg, fontFamily: "DM Sans" }}>
      <style>{baseStyles}</style>

      {/* Mobile header */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", height: 56,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "none", border: "none", color: COLORS.accent,
            cursor: "pointer", padding: 4, display: "flex",
          }}>{sidebarOpen ? Icons.close : Icons.menu}</button>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, color: COLORS.accent, letterSpacing: 2 }}>APMEW</span>
          <div style={{ width: 32 }} />
        </div>
      )}

      {/* Overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 290, transition: "opacity 0.3s",
        }} />
      )}

      {/* Sidebar */}
      <nav style={{
        width: isMobile ? 260 : 240,
        background: COLORS.surface,
        borderRight: `1px solid ${COLORS.border}`,
        padding: isMobile ? "68px 12px 20px" : "20px 12px",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0,
        zIndex: 300,
        transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.3s ease",
      }}>
        {!isMobile && (
          <div style={{
            padding: "8px 16px 24px", borderBottom: `1px solid ${COLORS.border}`,
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color: COLORS.accent, letterSpacing: 2 }}>APMEW</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textMuted, marginTop: 2, letterSpacing: 0.5 }}>PLANIFICACIÓN FINANCIERA</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {navItems.map(item => (
            <NavItem key={item.id} {...item} active={page === item.id} onClick={() => handleNav(item.id)} />
          ))}
        </div>

        <div style={{
          padding: "14px 16px", background: COLORS.surface2,
          borderRadius: 10, marginTop: 16,
        }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Conectado a Supabase</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.green }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: COLORS.green }}>Online</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        marginLeft: isMobile ? 0 : 240,
        flex: 1,
        padding: isMobile ? "72px 16px 24px" : "32px 40px",
        maxWidth: 1200,
        width: "100%",
      }}>
        {renderPage()}
      </main>
    </div>
  );
}
