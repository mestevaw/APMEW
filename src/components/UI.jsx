import { C, inputStyle } from "../lib/theme";
import { I } from "../lib/icons";

// ─── Card ───
export const Card = ({ children, style, delay = 0 }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 16px", animation: `fadeIn 0.5s ease ${delay}s both`, ...style }}>
    {children}
  </div>
);

// ─── StatCard ───
export const StatCard = ({ label, value, sub, color = C.accent, icon, delay = 0, mob }) => (
  <Card delay={delay} style={{ display: "flex", flexDirection: "column", gap: 6, padding: mob ? "14px 12px" : "22px 24px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontFamily: "DM Sans", fontSize: mob ? 11 : 13, color: C.textDim, fontWeight: 500, letterSpacing: .5 }}>{label}</span>
      {icon && !mob && <span style={{ color, opacity: .6 }}>{icon}</span>}
    </div>
    <span style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 22, fontWeight: 500, color, letterSpacing: -.5 }}>{value}</span>
    {sub && <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>{sub}</span>}
  </Card>
);

// ─── SectionTitle ───
export const SectionTitle = ({ children, icon, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {icon && <span style={{ color: C.accent }}>{icon}</span>}
      <h2 style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 600, color: C.text }}>{children}</h2>
    </div>
    {action}
  </div>
);

// ─── Badge ───
export const Badge = ({ children, color = C.accent }) => (
  <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 500, background: `${color}20`, color, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

// ─── MiniBar ───
export const MiniBar = ({ value, max, color = C.accent }) => (
  <div style={{ width: "100%", height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
    <div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: "100%", background: color, borderRadius: 3, transformOrigin: "left", animation: "barGrow 0.8s ease both" }} />
  </div>
);

// ─── Buttons ───
export const Btn = ({ children, onClick, color = C.accent, outline, small, disabled, style: s }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: small ? "6px 12px" : "10px 20px",
    background: outline ? "transparent" : disabled ? C.surface2 : color,
    border: outline ? `1px solid ${C.border}` : "none",
    borderRadius: 8, cursor: disabled ? "default" : "pointer",
    fontFamily: "DM Sans", fontSize: small ? 12 : 14, fontWeight: 600,
    color: outline ? C.textDim : disabled ? C.textMuted : C.bg,
    opacity: disabled ? .5 : 1, transition: "all 0.2s", ...s,
  }}>{children}</button>
);

export const BtnIcon = ({ icon, onClick, color = C.textDim, title }) => (
  <button title={title} onClick={onClick} style={{ background: "none", border: "none", color, cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
    onMouseEnter={e => e.currentTarget.style.color = C.accent}
    onMouseLeave={e => e.currentTarget.style.color = color}>
    {icon}
  </button>
);

// ─── Loading / Spinner ───
export const Loading = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 8 }}>
    {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ease infinite ${i * .2}s` }} />)}
  </div>
);

export const Spinner = () => (
  <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
);

// ─── Table ───
export const Table = ({ columns, data, onEdit, onDelete, mob }) => (
  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontFamily: "DM Sans", minWidth: mob ? 500 : "auto" }}>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={{ textAlign: col.align || "left", padding: mob ? "8px 10px" : "10px 14px", fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: .5, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{col.label}</th>
          ))}
          {(onEdit || onDelete) && <th style={{ width: 60, borderBottom: `1px solid ${C.border}` }} />}
        </tr>
      </thead>
      <tbody>
        {data.map((row, ri) => (
          <tr key={ri} onMouseEnter={e => e.currentTarget.style.background = C.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {columns.map((col, ci) => (
              <td key={ci} style={{ textAlign: col.align || "left", padding: mob ? "9px 10px" : "11px 14px", fontSize: mob ? 13 : 14, color: col.color ? col.color(row) : C.text, fontFamily: col.mono ? "JetBrains Mono" : "DM Sans", fontWeight: col.bold ? 600 : 400, borderBottom: `1px solid ${C.border}08`, whiteSpace: "nowrap" }}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
            {(onEdit || onDelete) && (
              <td style={{ padding: "8px", borderBottom: `1px solid ${C.border}08`, whiteSpace: "nowrap" }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {onEdit && <BtnIcon icon={I.edit} onClick={() => onEdit(row)} title="Editar" />}
                  {onDelete && <BtnIcon icon={I.trash} onClick={() => onDelete(row)} color={C.red + "80"} title="Eliminar" />}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Modal ───
export const Modal = ({ title, fields, values, onChange, onSave, onDelete, onCancel, mob }) => (
  <>
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000 }} />
    <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: C.surface, border: `1px solid ${C.accent}40`, borderRadius: 16, padding: mob ? "20px 16px" : "28px 32px", zIndex: 1001, width: mob ? "calc(100% - 32px)" : 500, maxHeight: "85vh", overflowY: "auto" }}>
      <h3 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fields.map((f, i) => (
          <div key={i}>
            <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 4, display: "block" }}>{f.label}</label>
            {f.type === "select" ? (
              <select value={values[f.key] || ""} onChange={e => onChange(f.key, e.target.value)} style={inputStyle}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type || "text"} step={f.type === "number" ? "any" : undefined} placeholder={f.placeholder || ""} value={values[f.key] ?? ""} onChange={e => onChange(f.key, e.target.value)} style={{ ...inputStyle, fontFamily: f.type === "number" ? "JetBrains Mono" : "DM Sans" }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={onSave}>Guardar</Btn>
          <Btn onClick={onCancel} outline>Cancelar</Btn>
        </div>
        {onDelete && <Btn onClick={onDelete} color={C.red} small style={{ opacity: .8 }}>{I.trash} Eliminar</Btn>}
      </div>
    </div>
  </>
);

// ─── NavItem ───
export const NavItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px",
    background: active ? C.accentGlow : "transparent", border: "none", borderRadius: 10,
    cursor: "pointer", color: active ? C.accent : C.textDim,
    fontFamily: "DM Sans", fontSize: 14, fontWeight: active ? 600 : 400,
    borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent", textAlign: "left",
  }}>{icon}<span>{label}</span></button>
);
