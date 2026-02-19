import { useState, useEffect, useCallback } from "react";

// ─── Supabase Config ───
const SUPABASE_URL = "https://ziwkberfwctlvlwejznc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppd2tiZXJmd2N0bHZsd2Vqem5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjI1NTEsImV4cCI6MjA4NzA5ODU1MX0.MCALDM7gFOyIVuRQjis2rTP_FIsx-7deRJs-799Hm-8";

const supaFetch = async (table, options = {}) => {
  const { select = "*", order } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (order) url += `&order=${order}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
};

const supaUpdate = async (table, id, data) => {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
};

const supaInsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  return res.json();
};

const supaDelete = async (table, id) => {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "return=minimal" },
  });
};

const fmt = (n, d = 0) => {
  if (n == null || isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
};
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
};

const I = {
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
  trash: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  menu: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  close: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

const C = {
  bg: "#0C0F14", surface: "#151920", surface2: "#1C2230",
  border: "#2A3040", borderLight: "#353D50",
  accent: "#C8A862", accentDim: "#A08840", accentGlow: "rgba(200,168,98,0.12)",
  green: "#4ADE80", greenDim: "rgba(74,222,128,0.15)",
  red: "#F87171", redDim: "rgba(248,113,113,0.15)",
  blue: "#60A5FA", blueDim: "rgba(96,165,250,0.15)",
  text: "#E8E4DC", textDim: "#8A8A8A", textMuted: "#5A5A5A", white: "#FFF",
};

const baseStyles = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{background:${C.bg};overflow-x:hidden}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;

const Card = ({ children, style, delay = 0 }) => (<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 16px", animation: `fadeIn 0.5s ease ${delay}s both`, ...style }}>{children}</div>);
const StatCard = ({ label, value, sub, color = C.accent, icon, delay = 0, mob }) => (<Card delay={delay} style={{ display: "flex", flexDirection: "column", gap: 6, padding: mob ? "14px 12px" : "22px 24px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontFamily: "DM Sans", fontSize: mob ? 11 : 13, color: C.textDim, fontWeight: 500, letterSpacing: .5 }}>{label}</span>{icon && !mob && <span style={{ color, opacity: .6 }}>{icon}</span>}</div><span style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 22, fontWeight: 500, color, letterSpacing: -.5 }}>{value}</span>{sub && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>{sub}</span>}</Card>);
const SectionTitle = ({ children, icon, action }) => (<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{icon && <span style={{ color: C.accent }}>{icon}</span>}<h2 style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 600, color: C.text }}>{children}</h2></div>{action}</div>);
const Badge = ({ children, color = C.accent }) => (<span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 500, background: `${color}20`, color, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>);
const MiniBar = ({ value, max, color = C.accent }) => (<div style={{ width: "100%", height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: "100%", background: color, borderRadius: 3, transformOrigin: "left", animation: "barGrow 0.8s ease both" }} /></div>);
const Btn = ({ children, onClick, color = C.accent, outline, small, style: s }) => (<button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "6px 12px" : "10px 20px", background: outline ? "transparent" : color, border: outline ? `1px solid ${C.border}` : "none", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: small ? 12 : 14, fontWeight: 600, color: outline ? C.textDim : C.bg, transition: "all 0.2s", ...s }}>{children}</button>);
const BtnIcon = ({ icon, onClick, color = C.textDim, title }) => (<button title={title} onClick={onClick} style={{ background: "none", border: "none", color, cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }} onMouseEnter={e => e.currentTarget.style.color = C.accent} onMouseLeave={e => e.currentTarget.style.color = color}>{icon}</button>);
const Loading = () => (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 8 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ease infinite ${i * .2}s` }} />)}</div>);

const inputStyle = { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontFamily: "DM Sans", fontSize: 14, width: "100%", outline: "none" };

const Modal = ({ title, fields, values, onChange, onSave, onDelete, onCancel, mob }) => (<><div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000 }} /><div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: C.surface, border: `1px solid ${C.accent}40`, borderRadius: 16, padding: mob ? "20px 16px" : "28px 32px", zIndex: 1001, width: mob ? "calc(100% - 32px)" : 500, maxHeight: "85vh", overflowY: "auto" }}><h3 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>{title}</h3><div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{fields.map((f, i) => (<div key={i}><label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 4, display: "block" }}>{f.label}</label>{f.type === "select" ? (<select value={values[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} style={inputStyle}>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>) : (<input type={f.type || "text"} step={f.type === "number" ? "any" : undefined} placeholder={f.placeholder || ""} value={values[f.key] ?? ""} onChange={e => onChange(f.key, e.target.value)} style={{ ...inputStyle, fontFamily: f.type === "number" ? "JetBrains Mono" : "DM Sans" }} />)}</div>))}</div><div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}><div style={{ display: "flex", gap: 10 }}><Btn onClick={onSave}>Guardar</Btn><Btn onClick={onCancel} outline>Cancelar</Btn></div>{onDelete && <Btn onClick={onDelete} color={C.red} small style={{ opacity: .8 }}>{I.trash} Eliminar</Btn>}</div></div></>);

const Table = ({ columns, data, onEdit, onDelete, mob }) => (<div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: "DM Sans", minWidth: mob ? 500 : "auto" }}><thead><tr>{columns.map((col, i) => (<th key={i} style={{ textAlign: col.align || "left", padding: mob ? "8px 10px" : "10px 14px", fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: .5, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{col.label}</th>))}{(onEdit || onDelete) && <th style={{ width: 60, borderBottom: `1px solid ${C.border}` }} />}</tr></thead><tbody>{data.map((row, ri) => (<tr key={ri} onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{columns.map((col, ci) => (<td key={ci} style={{ textAlign: col.align || "left", padding: mob ? "9px 10px" : "11px 14px", fontSize: mob ? 13 : 14, color: col.color ? col.color(row) : C.text, fontFamily: col.mono ? "JetBrains Mono" : "DM Sans", fontWeight: col.bold ? 600 : 400, borderBottom: `1px solid ${C.border}08`, whiteSpace: "nowrap" }}>{col.render ? col.render(row) : row[col.key]}</td>))}{(onEdit || onDelete) && (<td style={{ padding: "8px", borderBottom: `1px solid ${C.border}08`, whiteSpace: "nowrap" }}><div style={{ display: "flex", gap: 2 }}>{onEdit && <BtnIcon icon={I.edit} onClick={() => onEdit(row)} title="Editar" />}{onDelete && <BtnIcon icon={I.trash} onClick={() => onDelete(row)} color={C.red + "80"} title="Eliminar" />}</div></td>)}</tr>))}</tbody></table></div>);

const NavItem = ({ icon, label, active, onClick }) => (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px", background: active ? C.accentGlow : "transparent", border: "none", borderRadius: 10, cursor: "pointer", color: active ? C.accent : C.textDim, fontFamily: "DM Sans", fontSize: 14, fontWeight: active ? 600 : 400, borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent", textAlign: "left" }}>{icon}<span>{label}</span></button>);

const DashboardPage = ({ data, mob }) => {
  const { profiles, income, retIncome, expenses, assets, debts, checklist } = data;
  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const nw = totalA - totalD;
  const ti = income.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const tre = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);
  const tri = retIncome.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const cd = checklist.filter(c => c.is_completed).length;
  const ct = checklist.length;
  const miguel = profiles.find(p => p.name === "Miguel");
  return (<div>
    <div style={{ marginBottom: mob ? 20 : 28 }}><h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 22 : 26, fontWeight: 700, color: C.text }}>Buenos días, {miguel?.name || profiles[0]?.name || ""} 👋</h1><p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginTop: 4 }}>Resumen financiero — {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</p></div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mob ? 10 : 16, marginBottom: mob ? 16 : 28 }}>
      <StatCard label="PATRIMONIO NETO" value={fmt(nw)} sub={`Activos: ${fmt(totalA)}`} color={nw >= 0 ? C.green : C.red} icon={I.patrimony} delay={.05} mob={mob} />
      <StatCard label="INGRESOS ACTUALES" value={fmt(ti)} sub="Mensuales" color={C.blue} icon={I.income} delay={.1} mob={mob} />
      <StatCard label="GASTOS RETIRO" value={fmt(tre)} sub="Mensuales estimados" color={C.red} icon={I.expenses} delay={.15} mob={mob} />
      <StatCard label="INGRESOS RETIRO" value={fmt(tri)} sub="Mensuales proyectados" color={C.green} icon={I.income} delay={.2} mob={mob} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 12 : 16, marginBottom: mob ? 16 : 28 }}>
      <Card delay={.25}><SectionTitle icon={I.patrimony}>Perfiles</SectionTitle><div style={{ display: "flex", gap: mob ? 10 : 20, flexDirection: mob ? "column" : "row" }}>{profiles.map((p, i) => (<div key={i} style={{ flex: 1, padding: mob ? 12 : 16, background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}><div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 600, color: C.accent, marginBottom: 10 }}>{p.name}</div>{[["Edad", p.current_age], ["Expectativa", p.life_expectancy], ["Años en retiro", p.retirement_years]].map(([l, v], j) => (<div key={j} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>{l}</span><span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: j === 2 ? C.green : C.text }}>{v}</span></div>))}</div>))}</div></Card>
      <Card delay={.3}><SectionTitle icon={I.checklist}>Checklist Pre-Retiro</SectionTitle><div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}><div style={{ flex: 1 }}><MiniBar value={cd} max={ct} color={C.green} /></div><Badge color={C.green}>{cd}/{ct}</Badge></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{["FINANZAS", "SEGUROS Y SALUD", "LEGAL Y FISCAL", "PENSIONES"].map(cat => { const items = checklist.filter(c => c.category === cat); const done = items.filter(c => c.is_completed).length; return (<div key={cat} style={{ padding: "8px 12px", background: C.surface2, borderRadius: 8, display: "flex", justifyContent: "space-between" }}><span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span><span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: done === items.length ? C.green : C.text }}>{done}/{items.length}</span></div>); })}</div></Card>
    </div>
    <Card delay={.35}><SectionTitle icon={I.projection}>Balance Retiro</SectionTitle><div style={{ display: "flex", gap: mob ? 12 : 24, flexDirection: mob ? "column" : "row", alignItems: "center" }}><div style={{ flex: 1, width: "100%" }}>{[["Ingresos retiro", tri, C.green], ["Gastos retiro", tre, C.red]].map(([l, v, c]) => (<div key={l} style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "DM Sans", fontSize: 13, color: c }}>{l}</span><span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: c }}>{fmt(v)}/mes</span></div><MiniBar value={v} max={Math.max(tri, tre)} color={c} /></div>))}</div><div style={{ padding: mob ? "12px 20px" : "16px 24px", background: tri >= tre ? C.greenDim : C.redDim, borderRadius: 12, textAlign: "center", minWidth: mob ? "100%" : 140 }}><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: .5 }}>Diferencia</div><div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 18 : 20, fontWeight: 600, color: tri >= tre ? C.green : C.red }}>{fmt(tri - tre)}</div><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>mensual</div></div></div></Card>
  </div>);
};

const CrudPage = ({ title, subtitle, table, items, columns, formFields, defaults, mob, reload, totalLabel, totalKey }) => {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const openAdd = () => { setForm({ ...defaults }); setModal({ mode: "add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ mode: "edit", row }); };
  const handleSave = async () => {
    const cleaned = { ...form };
    formFields.forEach(f => { if (f.type === "number" && cleaned[f.key] !== undefined) cleaned[f.key] = Number(cleaned[f.key]) || 0; });
    ["id", "created_at", "updated_at", "retirement_years", "sort_order", "currency", "is_active"].forEach(k => delete cleaned[k]);
    if (modal.mode === "edit") await supaUpdate(table, modal.row.id, cleaned);
    else await supaInsert(table, cleaned);
    setModal(null); reload();
  };
  const handleDelete = async () => { if (confirm("¿Seguro que quieres eliminar esto?")) { await supaDelete(table, modal.row.id); setModal(null); reload(); } };
  const total = totalKey ? items.reduce((s, i) => s + Number(i[totalKey] || 0), 0) : null;
  return (<div>
    <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</h1>
    <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>{subtitle}</p>
    <div style={{ marginBottom: 16 }}><Btn onClick={openAdd}>{I.plus} Agregar</Btn></div>
    <Card><Table columns={columns} data={items} onEdit={openEdit} mob={mob} />{total !== null && (<div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 14px 0", borderTop: `1px solid ${C.border}`, marginTop: 8 }}><div style={{ display: "flex", gap: 16, alignItems: "center" }}><span style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, fontWeight: 600, color: C.textDim }}>{totalLabel || "TOTAL"}</span><span style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 20, fontWeight: 600, color: C.accent }}>{fmt(total)}</span></div></div>)}</Card>
    {modal && <Modal title={modal.mode === "edit" ? "Editar" : "Agregar"} fields={formFields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null} onCancel={() => setModal(null)} mob={mob} />}
  </div>);
};

const ExpensesPage = ({ expenses, categories, mob, reload }) => {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const grouped = categories.map(cat => ({ ...cat, items: expenses.filter(e => e.category_id === cat.id), subtotal: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.monthly_amount || 0), 0) }));
  const total = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);
  const openAdd = (catId) => { setForm({ category_id: catId, concept: "", monthly_amount: 0, notes: "" }); setModal({ mode: "add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ mode: "edit", row }); };
  const fields = [{ key: "concept", label: "Concepto" }, { key: "monthly_amount", label: "Monto Mensual", type: "number" }, { key: "category_id", label: "Categoría", type: "select", options: categories.map(c => ({ value: c.id, label: c.name })) }, { key: "notes", label: "Notas" }];
  const handleSave = async () => { const d = { concept: form.concept, monthly_amount: Number(form.monthly_amount) || 0, category_id: form.category_id, notes: form.notes || null }; if (modal.mode === "edit") await supaUpdate("retirement_expenses", modal.row.id, d); else await supaInsert("retirement_expenses", d); setModal(null); reload(); };
  const handleDelete = async () => { if (confirm("¿Eliminar?")) { await supaDelete("retirement_expenses", modal.row.id); setModal(null); reload(); } };
  return (<div>
    <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos en Retiro</h1>
    <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Proyección de gastos mensuales</p>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(140px,1fr))", gap: mob ? 8 : 12, marginBottom: 20 }}>{grouped.map((g, i) => (<Card key={i} delay={i * .05} style={{ padding: "12px 14px", textAlign: "center" }}><div style={{ fontSize: 20, marginBottom: 4 }}>{g.icon}</div><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>{g.name}</div><div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 14 : 16, fontWeight: 600, color: C.accent }}>{fmt(g.subtotal)}</div></Card>))}<Card delay={.3} style={{ padding: "12px 14px", textAlign: "center", borderColor: C.accent }}><div style={{ fontSize: 20, marginBottom: 4 }}>💰</div><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>TOTAL</div><div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 14 : 16, fontWeight: 600, color: C.red }}>{fmt(total)}</div></Card></div>
    {grouped.map((g, gi) => (<Card key={gi} delay={gi * .05} style={{ marginBottom: 14 }}><SectionTitle icon={<span style={{ fontSize: 18 }}>{g.icon}</span>} action={<Btn onClick={() => openAdd(g.id)} small>{I.plus} Agregar</Btn>}>{g.name}</SectionTitle><Table columns={[{ label: "Concepto", key: "concept", bold: true }, { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) }, { label: "Notas", key: "notes", color: () => C.textDim }]} data={g.items} onEdit={openEdit} mob={mob} /><div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: `1px solid ${C.border}`, marginTop: 8 }}><span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginRight: 12 }}>Subtotal</span><span style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 600, color: C.accent }}>{fmt(g.subtotal)}</span></div></Card>))}
    {modal && <Modal title={modal.mode === "edit" ? "Editar Gasto" : "Nuevo Gasto"} fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null} onCancel={() => setModal(null)} mob={mob} />}
  </div>);
};

const PatrimonyPage = ({ assets, debts, mob, reload }) => {
  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const assetFields = [{ key: "name", label: "Nombre" }, { key: "asset_type", label: "Tipo", type: "select", options: [{ value: "real_estate", label: "Inmueble" }, { value: "investment", label: "Inversión" }, { value: "business", label: "Negocio" }, { value: "other", label: "Otro" }] }, { key: "current_value", label: "Valor Actual", type: "number" }, { key: "notes", label: "Notas" }];
  const debtFields = [{ key: "name", label: "Nombre" }, { key: "outstanding_balance", label: "Saldo Pendiente", type: "number" }, { key: "monthly_payment", label: "Pago Mensual", type: "number" }, { key: "interest_rate", label: "Tasa Interés", type: "number" }, { key: "notes", label: "Notas" }];
  const [modal, setModal] = useState(null); const [form, setForm] = useState({}); const [editType, setEditType] = useState(null);
  const openAdd = (t) => { setEditType(t); setForm(t === "asset" ? { name: "", asset_type: "investment", current_value: 0 } : { name: "", outstanding_balance: 0, monthly_payment: 0 }); setModal({ mode: "add" }); };
  const openEdit = (row, t) => { setEditType(t); setForm({ ...row }); setModal({ mode: "edit", row }); };
  const handleSave = async () => { const tbl = editType === "asset" ? "assets" : "debts"; const d = { ...form }; (editType === "asset" ? assetFields : debtFields).forEach(f => { if (f.type === "number" && d[f.key] !== undefined) d[f.key] = Number(d[f.key]) || 0; }); ["id", "created_at", "updated_at", "sort_order", "currency"].forEach(k => delete d[k]); if (modal.mode === "edit") await supaUpdate(tbl, modal.row.id, d); else await supaInsert(tbl, d); setModal(null); reload(); };
  const handleDelete = async () => { if (confirm("¿Eliminar?")) { await supaDelete(editType === "asset" ? "assets" : "debts", modal.row.id); setModal(null); reload(); } };
  return (<div>
    <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Patrimonio</h1>
    <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Activos, inversiones y deudas</p>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: mob ? 10 : 16, marginBottom: 20 }}><StatCard label="TOTAL ACTIVOS" value={fmt(totalA)} color={C.green} delay={.05} mob={mob} /><StatCard label="TOTAL DEUDAS" value={fmt(totalD)} color={C.red} delay={.1} mob={mob} /><StatCard label="PATRIMONIO NETO" value={fmt(totalA - totalD)} color={totalA - totalD >= 0 ? C.accent : C.red} delay={.15} mob={mob} /></div>
    <Card delay={.2} style={{ marginBottom: 14 }}><SectionTitle icon={I.patrimony} action={<Btn onClick={() => openAdd("asset")} small>{I.plus} Agregar</Btn>}>Activos</SectionTitle><Table columns={[{ label: "Activo", key: "name", bold: true }, { label: "Tipo", key: "asset_type", render: r => <Badge color={r.asset_type === "real_estate" ? C.blue : r.asset_type === "investment" ? C.green : C.accent}>{r.asset_type === "real_estate" ? "Inmueble" : r.asset_type === "investment" ? "Inversión" : r.asset_type === "business" ? "Negocio" : "Otro"}</Badge> }, { label: "Valor Actual", key: "current_value", align: "right", mono: true, render: r => fmt(Number(r.current_value)) }]} data={assets} onEdit={r => openEdit(r, "asset")} mob={mob} /></Card>
    <Card delay={.25}><SectionTitle icon={<span style={{ fontSize: 18 }}>💳</span>} action={<Btn onClick={() => openAdd("debt")} small>{I.plus} Agregar</Btn>}>Deudas</SectionTitle><Table columns={[{ label: "Deuda", key: "name", bold: true }, { label: "Saldo", key: "outstanding_balance", align: "right", mono: true, render: r => fmt(Number(r.outstanding_balance)), color: r => Number(r.outstanding_balance) > 0 ? C.red : C.text }, { label: "Pago Mensual", key: "monthly_payment", align: "right", mono: true, render: r => fmt(Number(r.monthly_payment)) }]} data={debts} onEdit={r => openEdit(r, "debt")} mob={mob} /></Card>
    {modal && <Modal title={modal.mode === "edit" ? "Editar" : "Agregar"} fields={editType === "asset" ? assetFields : debtFields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null} onCancel={() => setModal(null)} mob={mob} />}
  </div>);
};

const ChecklistPage = ({ checklist, onToggle, mob }) => {
  const cats = [...new Set(checklist.map(c => c.category))];
  return (<div><h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Checklist Pre-Retiro</h1><p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Marca cada tarea conforme la completes</p>{cats.map((cat, ci) => { const items = checklist.filter(c => c.category === cat); const done = items.filter(c => c.is_completed).length; return (<Card key={cat} delay={ci * .08} style={{ marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.accent }}>{cat}</span><Badge color={done === items.length ? C.green : C.textDim}>{done}/{items.length}</Badge></div><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{items.map(item => (<button key={item.id} onClick={() => onToggle(item)} style={{ display: "flex", alignItems: "center", gap: 12, padding: mob ? "10px 12px" : "10px 14px", background: item.is_completed ? C.greenDim : C.surface2, border: `1px solid ${item.is_completed ? C.green + "30" : C.border}`, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left" }}><div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${item.is_completed ? C.green : C.borderLight}`, background: item.is_completed ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{item.is_completed && <svg width="12" height="12" fill="none" stroke={C.bg} strokeWidth="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>}</div><span style={{ fontFamily: "DM Sans", fontSize: mob ? 13 : 14, color: item.is_completed ? C.textDim : C.text, textDecoration: item.is_completed ? "line-through" : "none" }}>{item.action}</span></button>))}</div></Card>); })}</div>);
};

const ProjectionPage = ({ profiles, assumptions, mob }) => {
  const p1 = profiles.find(p => p.name === "Miguel") || profiles[0]; const p2 = profiles.find(p => p.name === "AnaP") || profiles[1];
  const supuestos = [assumptions.find(a => a.key === "inflation_rate"), assumptions.find(a => a.key === "pre_retirement_return"), assumptions.find(a => a.key === "retirement_return"), assumptions.find(a => a.key === "safe_withdrawal_rate")].filter(Boolean);
  const years = Array.from({ length: 31 }, (_, i) => ({ year: i, ageP1: p1 ? p1.current_age + i : "-", ageP2: p2 ? p2.current_age + i : "-" }));
  return (<div><h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Proyección 30 Años</h1><p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Simulación del patrimonio</p><div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: mob ? 8 : 12, marginBottom: 20 }}>{supuestos.map((a, i) => (<Card key={i} delay={i * .05} style={{ padding: "12px 14px", textAlign: "center" }}><div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{a.label}</div><div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 20, fontWeight: 600, color: C.accent }}>{pct(Number(a.value))}</div></Card>))}</div><Card delay={.2}><Table columns={[{ label: "Año", key: "year", mono: true, bold: true }, { label: p1?.name || "P1", key: "ageP1", mono: true }, { label: p2?.name || "P2", key: "ageP2", mono: true }, { label: "Aportación", key: "x", mono: true, align: "right", render: () => fmt(0) }, { label: "Rendimiento", key: "x2", mono: true, align: "right", render: () => fmt(0) }, { label: "Retiro", key: "x3", mono: true, align: "right", render: () => fmt(0) }, { label: "Patrimonio", key: "x4", mono: true, align: "right", render: () => <span style={{ color: C.accent }}>{fmt(0)}</span> }]} data={years} mob={mob} /></Card></div>);
};

const DailyExpensesPage = ({ dailyExpenses, onAdd, mob, reload }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" });
  const cats = ["supermercado", "transporte", "salud", "entretenimiento", "servicios", "restaurantes", "hogar", "otro"];
  const handleSubmit = async () => { if (!form.concept || !form.amount) return; await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] }); setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" }); setShowForm(false); };
  const handleDeleteDaily = async (row) => { if (confirm("¿Eliminar?")) { await supaDelete("daily_expenses", row.id); reload(); } };
  return (<div><h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos del Día a Día</h1><p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Registro de gastos reales</p>
    {!showForm ? <Btn onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>{I.plus} Registrar Gasto</Btn> : (<Card style={{ marginBottom: 20, borderColor: C.accent }}><SectionTitle>Nuevo Gasto</SectionTitle><div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}><input placeholder="Concepto" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} style={inputStyle} /><input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: "JetBrains Mono" }} /></div><div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>{cats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select><select value={form.who} onChange={e => setForm({ ...form, who: e.target.value })} style={inputStyle}><option>Miguel</option><option>AnaP</option><option>Ambos</option></select><select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={inputStyle}><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></div><div style={{ display: "flex", gap: 10 }}><Btn onClick={handleSubmit}>Guardar</Btn><Btn onClick={() => setShowForm(false)} outline>Cancelar</Btn></div></Card>)}
    <Card>{dailyExpenses.length === 0 ? (<div style={{ textAlign: "center", padding: mob ? 30 : 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📝</div><p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos registrados</p></div>) : (<Table columns={[{ label: "Fecha", key: "expense_date", mono: true }, { label: "Concepto", key: "concept", bold: true }, { label: "Categoría", key: "category", render: r => <Badge>{r.category}</Badge> }, { label: "Quién", key: "who" }, { label: "Monto", key: "amount", align: "right", mono: true, render: r => fmt(Number(r.amount)), color: () => C.red }]} data={dailyExpenses} onDelete={handleDeleteDaily} mob={mob} />)}</Card>
  </div>);
};

const DocumentsPage = ({ documents, onAdd, mob, reload }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "seguros", google_drive_url: "", description: "" });
  const docCats = ["seguros", "inversiones", "impuestos", "legal", "propiedades", "personal", "otro"];
  const handleSubmit = async () => { if (!form.title) return; await onAdd(form); setForm({ title: "", category: "seguros", google_drive_url: "", description: "" }); setShowForm(false); };
  const handleDeleteDoc = async (row) => { if (confirm("¿Eliminar?")) { await supaDelete("documents", row.id); reload(); } };
  return (<div><h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Documentos</h1><p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Índice de documentos en Google Drive</p>
    {!showForm ? <Btn onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>{I.plus} Agregar Documento</Btn> : (<Card style={{ marginBottom: 20, borderColor: C.accent }}><SectionTitle>Nuevo Documento</SectionTitle><div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}><input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>{docCats.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select></div><input placeholder="URL de Google Drive" value={form.google_drive_url} onChange={e => setForm({ ...form, google_drive_url: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} /><input placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, marginBottom: 16 }} /><div style={{ display: "flex", gap: 10 }}><Btn onClick={handleSubmit}>Guardar</Btn><Btn onClick={() => setShowForm(false)} outline>Cancelar</Btn></div></Card>)}
    <Card>{documents.length === 0 ? (<div style={{ textAlign: "center", padding: mob ? 30 : 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📂</div><p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay documentos indexados</p></div>) : (<Table columns={[{ label: "Título", key: "title", bold: true }, { label: "Categoría", key: "category", render: r => <Badge>{r.category}</Badge> }, { label: "Descripción", key: "description", color: () => C.textDim }, { label: "Link", key: "google_drive_url", render: r => r.google_drive_url ? <a href={r.google_drive_url} target="_blank" rel="noopener" style={{ color: C.blue, textDecoration: "none", fontSize: 13 }}>Abrir ↗</a> : "—" }]} data={documents} onDelete={handleDeleteDoc} mob={mob} />)}</Card>
  </div>);
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mob = useIsMobile();
  const [data, setData] = useState({ profiles: [], assumptions: [], income: [], retIncome: [], expenses: [], expenseCategories: [], assets: [], debts: [], checklist: [], documents: [], dailyExpenses: [] });

  const loadData = useCallback(async () => {
    try {
      const [profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses] = await Promise.all([
        supaFetch("profiles", { order: "name" }), supaFetch("financial_assumptions", { order: "key" }),
        supaFetch("current_income", { order: "sort_order" }), supaFetch("retirement_income", { order: "sort_order" }),
        supaFetch("retirement_expenses", { order: "sort_order" }), supaFetch("expense_categories", { order: "sort_order" }),
        supaFetch("assets", { order: "sort_order" }), supaFetch("debts", { order: "sort_order" }),
        supaFetch("checklist_items", { order: "sort_order" }), supaFetch("documents", { order: "created_at.desc" }),
        supaFetch("daily_expenses", { order: "expense_date.desc,created_at.desc" }),
      ]);
      setData({ profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses });
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const toggleChecklist = async (item) => { await supaUpdate("checklist_items", item.id, { is_completed: !item.is_completed, completed_date: !item.is_completed ? new Date().toISOString().split("T")[0] : null }); loadData(); };
  const addDailyExpense = async (e) => { await supaInsert("daily_expenses", e); loadData(); };
  const addDocument = async (d) => { await supaInsert("documents", d); loadData(); };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: I.dashboard }, { id: "income", label: "Ingresos Actuales", icon: I.income },
    { id: "retIncome", label: "Ingresos Retiro", icon: I.income }, { id: "expenses", label: "Gastos Retiro", icon: I.expenses },
    { id: "patrimony", label: "Patrimonio", icon: I.patrimony }, { id: "projection", label: "Proyección 30 Años", icon: I.projection },
    { id: "checklist", label: "Checklist", icon: I.checklist }, { id: "daily", label: "Gastos Diarios", icon: I.daily },
    { id: "docs", label: "Documentos", icon: I.docs },
  ];
  const handleNav = (id) => { setPage(id); if (mob) setSidebarOpen(false); };

  const renderPage = () => {
    if (loading) return <Loading />;
    switch (page) {
      case "dashboard": return <DashboardPage data={data} mob={mob} />;
      case "income": return <CrudPage title="Ingresos Actuales" subtitle="Últimos ingresos antes de retirarse" table="current_income" items={data.income} mob={mob} reload={loadData} totalLabel="TOTAL MENSUAL" totalKey="monthly_amount" columns={[{ label: "Fuente", key: "source", bold: true }, { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) }, { label: "Notas", key: "notes", color: () => C.textDim }]} formFields={[{ key: "source", label: "Fuente de Ingreso" }, { key: "monthly_amount", label: "Monto Mensual", type: "number" }, { key: "notes", label: "Notas" }]} defaults={{ source: "", monthly_amount: 0, notes: "" }} />;
      case "retIncome": return <CrudPage title="Ingresos en Retiro" subtitle="Fuentes de ingreso una vez retirados" table="retirement_income" items={data.retIncome} mob={mob} reload={loadData} totalLabel="TOTAL MENSUAL" totalKey="monthly_amount" columns={[{ label: "Fuente", key: "source", bold: true }, { label: "Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) }, { label: "Anual", key: "annual_amount", align: "right", mono: true, render: r => r.annual_amount ? fmt(Number(r.annual_amount)) : "—" }, { label: "Notas", key: "notes", color: () => C.textDim }]} formFields={[{ key: "source", label: "Fuente de Ingreso" }, { key: "monthly_amount", label: "Monto Mensual", type: "number" }, { key: "annual_amount", label: "Monto Anual", type: "number" }, { key: "notes", label: "Notas" }]} defaults={{ source: "", monthly_amount: 0, annual_amount: 0, notes: "" }} />;
      case "expenses": return <ExpensesPage expenses={data.expenses} categories={data.expenseCategories} mob={mob} reload={loadData} />;
      case "patrimony": return <PatrimonyPage assets={data.assets} debts={data.debts} mob={mob} reload={loadData} />;
      case "projection": return <ProjectionPage profiles={data.profiles} assumptions={data.assumptions} mob={mob} />;
      case "checklist": return <ChecklistPage checklist={data.checklist} onToggle={toggleChecklist} mob={mob} />;
      case "daily": return <DailyExpensesPage dailyExpenses={data.dailyExpenses} onAdd={addDailyExpense} mob={mob} reload={loadData} />;
      case "docs": return <DocumentsPage documents={data.documents} onAdd={addDocument} mob={mob} reload={loadData} />;
      default: return <DashboardPage data={data} mob={mob} />;
    }
  };

  return (<div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
    <style>{baseStyles}</style>
    {mob && (<div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", height: 56 }}><button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4, display: "flex" }}>{sidebarOpen ? I.close : I.menu}</button><span style={{ fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>APMEW</span><div style={{ width: 32 }} /></div>)}
    {mob && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 290 }} />}
    <nav style={{ width: mob ? 260 : 240, background: C.surface, borderRight: `1px solid ${C.border}`, padding: mob ? "68px 12px 20px" : "20px 12px", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300, transform: mob && !sidebarOpen ? "translateX(-100%)" : "translateX(0)", transition: "transform 0.3s ease" }}>
      {!mob && (<div style={{ padding: "8px 16px 24px", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}><div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>APMEW</div><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 2, letterSpacing: .5 }}>PLANIFICACIÓN FINANCIERA</div></div>)}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>{navItems.map(item => <NavItem key={item.id} {...item} active={page === item.id} onClick={() => handleNav(item.id)} />)}</div>
      <div style={{ padding: "14px 16px", background: C.surface2, borderRadius: 10, marginTop: 16 }}><div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Conectado a Supabase</div><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} /><span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.green }}>Online</span></div></div>
    </nav>
    <main style={{ marginLeft: mob ? 0 : 240, flex: 1, padding: mob ? "72px 16px 24px" : "32px 40px", maxWidth: 1200, width: "100%" }}>{renderPage()}</main>
  </div>);
}
