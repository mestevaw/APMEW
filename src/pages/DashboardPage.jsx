// Archivo: src/pages/DashboardPage.jsx
// Versión: 2.0
// Fecha: 2026-02-20

import { C } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { Card, StatCard, SectionTitle, Badge, MiniBar } from "../components/UI";

export const DashboardPage = ({ data, mob, onProfileClick, onHeartClick }) => {
  const { profiles, income, retIncome, expenses, assets, debts, checklist } = data;
  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const nw = totalA - totalD;
  const ti = income.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const tre = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);
  const tri = retIncome.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const cd = checklist.filter(c => c.is_completed).length;
  const ct = checklist.length;

  const p1 = profiles.find(p => p.name === "Miguel") || profiles[0];
  const p2 = profiles.find(p => p.name === "AnaP") || profiles[1];

  const ProfileBtn = ({ profile, delay }) => (
    <button
      onClick={() => onProfileClick && onProfileClick(profile)}
      style={{
        flex: 1, padding: mob ? 12 : 16, background: C.surface2, borderRadius: 12,
        border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left",
        transition: "all 0.2s", animation: `fadeIn 0.5s ease ${delay}s both`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}
    >
      <div style={{ fontFamily: "DM Sans", fontSize: mob ? 15 : 17, fontWeight: 600, color: C.accent, marginBottom: 8 }}>{profile?.name || "—"}</div>
      {[["Edad", profile?.current_age], ["Expectativa", profile?.life_expectancy], ["Años en retiro", profile?.retirement_years]].map(([l, v], j) => (
        <div key={j} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{l}</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: j === 2 ? C.green : C.text }}>{v ?? "—"}</span>
        </div>
      ))}
    </button>
  );

  const HeartBtn = () => (
    <button
      onClick={() => onHeartClick && onHeartClick()}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: mob ? 8 : 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.2s", flexShrink: 0,
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <svg width={mob ? 24 : 30} height={mob ? 24 : 30} viewBox="0 0 24 24" fill={C.red} stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    </button>
  );

  return (
    <div>
      {/* Profiles row */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 16, marginBottom: mob ? 16 : 24 }}>
        {p1 && <ProfileBtn profile={p1} delay={0} />}
        <HeartBtn />
        {p2 && <ProfileBtn profile={p2} delay={0.05} />}
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mob ? 10 : 16, marginBottom: mob ? 16 : 28 }}>
        <StatCard label="PATRIMONIO NETO" value={fmt(nw)} sub={`Activos: ${fmt(totalA)}`} color={nw >= 0 ? C.green : C.red} icon={I.patrimony} delay={.1} mob={mob} />
        <StatCard label="INGRESOS ACTUALES" value={fmt(ti)} sub="Mensuales" color={C.blue} icon={I.income} delay={.15} mob={mob} />
        <StatCard label="GASTOS RETIRO" value={fmt(tre)} sub="Mensuales estimados" color={C.red} icon={I.expenses} delay={.2} mob={mob} />
        <StatCard label="INGRESOS RETIRO" value={fmt(tri)} sub="Mensuales proyectados" color={C.green} icon={I.income} delay={.25} mob={mob} />
      </div>

      {/* Checklist summary */}
      <Card delay={.3} style={{ marginBottom: mob ? 16 : 28 }}>
        <SectionTitle icon={I.checklist}>Checklist Pre-Retiro</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <div style={{ flex: 1 }}><MiniBar value={cd} max={ct} color={C.green} /></div>
          <Badge color={C.green}>{cd}/{ct}</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {["FINANZAS", "SEGUROS Y SALUD", "LEGAL Y FISCAL", "PENSIONES"].map(cat => {
            const items = checklist.filter(c => c.category === cat);
            const done = items.filter(c => c.is_completed).length;
            return (
              <div key={cat} style={{ padding: "8px 12px", background: C.surface2, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: done === items.length ? C.green : C.text }}>{done}/{items.length}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Balance retiro */}
      <Card delay={.35}>
        <SectionTitle icon={I.projection}>Balance Retiro</SectionTitle>
        <div style={{ display: "flex", gap: mob ? 12 : 24, flexDirection: mob ? "column" : "row", alignItems: "center" }}>
          <div style={{ flex: 1, width: "100%" }}>
            {[["Ingresos retiro", tri, C.green], ["Gastos retiro", tre, C.red]].map(([l, v, c]) => (
              <div key={l} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, color: c }}>{l}</span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, color: c }}>{fmt(v)}/mes</span>
                </div>
                <MiniBar value={v} max={Math.max(tri, tre)} color={c} />
              </div>
            ))}
          </div>
          <div style={{ padding: mob ? "12px 20px" : "16px 24px", background: tri >= tre ? C.greenDim : C.redDim, borderRadius: 12, textAlign: "center", minWidth: mob ? "100%" : 140 }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: .5 }}>Diferencia</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 18 : 20, fontWeight: 600, color: tri >= tre ? C.green : C.red }}>{fmt(tri - tre)}</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>mensual</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
