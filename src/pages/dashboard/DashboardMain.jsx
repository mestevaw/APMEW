// dashboard/DashboardMain.jsx
import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { fmt } from "../../lib/helpers";
import { I } from "../../lib/icons";
import { supaFetch } from "../../lib/supabase";
import { Card, StatCard, Badge, Spinner } from "../../components/UI";
import { KIDS, PROFILE_FOLDERS, PROPERTIES, OWNER_COLORS, OWNER_SHORT, CARS } from "./constants";
import { fmtMoney } from "./helpers";
import { CarIcon } from "./icons";
import PersonDetail from "./PersonDetail";
import PropertyDetail from "./PropertyDetail";
import PropertiesView from "./PropertiesView";
import OwnerDetail from "./OwnerDetail";
import CarsView from "./CarsView";
import DeadlinesView from "./DeadlinesView";

export const DashboardPage = ({ data, mob, drive, goToPage }) => {
  const { profiles, income, retIncome, expenses, assets, debts, checklist } = data;
  const [showKids, setShowKids] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showProperties, setShowProperties] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showCars, setShowCars] = useState(false);
  const [showDeadlines, setShowDeadlines] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);
  const nw = totalA - totalD;
  const [grossRentsMonthly, setGrossRentsMonthly] = useState(0);

  useEffect(() => {
    // Fetch latest year gross rents across all rental properties
    const fetchRents = async () => {
      const rentalAddrs = PROPERTIES.filter(p => !p.sold && !p.address.includes("Progreso") && !p.address.includes("Argo")).map(p => p.address);
      let total = 0;
      for (const addr of rentalAddrs) {
        const rows = await supaFetch("property_expenses", { filters: `property_address=eq.${encodeURIComponent(addr)}&expense_type=eq.gross_rents`, order: "period_year.desc", limit: 1 });
        if (rows && rows[0]) total += Number(rows[0].amount || 0);
      }
      setGrossRentsMonthly(Math.round(total / 12));
    };
    fetchRents();
  }, []);

  const ti = income.reduce((s, i) => s + Number(i.monthly_amount || 0), 0) + grossRentsMonthly;
  const tre = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);
  const tri = retIncome.reduce((s, i) => s + Number(i.monthly_amount || 0), 0);
  const cd = checklist.filter(c => c.is_completed).length;
  const ct = checklist.length;

  const p1 = profiles.find(p => p.name === "Miguel") || profiles[0];
  const p2 = profiles.find(p => p.name === "AnaP") || profiles[1];

  const goBack = () => { setSelectedPerson(null); setShowProperties(false); setSelectedProperty(null); setShowCars(false); setShowDeadlines(false); setSelectedOwner(null); };

  // ═══ SUBVIEWS ═══
  if (selectedPerson) return <PersonDetail person={selectedPerson} mob={mob} drive={drive} onBack={goBack} />;
  if (selectedOwner) return <OwnerDetail ownerName={selectedOwner} mob={mob} onBack={() => setSelectedOwner(null)} onSelectProperty={(p) => { setSelectedOwner(null); setSelectedProperty(p); }} />;
  if (selectedProperty) return <PropertyDetail property={selectedProperty} mob={mob} drive={drive} onBack={() => { setSelectedProperty(null); setShowProperties(true); }} onOwnerClick={(owner) => { setSelectedOwner(owner); }} />;
  if (showProperties) return <PropertiesView mob={mob} drive={drive} onSelectProperty={(p) => { setSelectedProperty(p); setShowProperties(false); }} onBack={goBack} />;
  if (showCars) return <CarsView mob={mob} drive={drive} onBack={goBack} />;
  if (showDeadlines) return <DeadlinesView mob={mob} onBack={goBack} />;

  // ═══ DASHBOARD ═══
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 16, marginBottom: mob ? 8 : 12 }}>
        {p1 && <button onClick={() => { setSelectedPerson({ name: p1.name, folderId: PROFILE_FOLDERS[p1.name] }); setShowKids(false); }} style={{
          flex: 1, padding: mob ? 12 : 16, background: C.surface2, borderRadius: 12,
          border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "fadeIn 0.5s ease 0s both",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <div style={{ fontFamily: "DM Sans", fontSize: mob ? 15 : 17, fontWeight: 600, color: C.accent, marginBottom: 8 }}>{p1?.name}</div>
          {[["Edad", p1?.current_age], ["Expectativa", p1?.life_expectancy], ["Años en retiro", p1?.retirement_years]].map(([l, v], j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: j === 2 ? C.green : C.text }}>{v ?? "—"}</span>
            </div>
          ))}
        </button>}

        <button onClick={() => { setShowKids(!showKids); setShowProperties(false); }} style={{
          background: "none", border: "none", cursor: "pointer", padding: mob ? 8 : 12,
          display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s", flexShrink: 0,
        }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
          <svg width={mob ? 24 : 30} height={mob ? 24 : 30} viewBox="0 0 24 24" fill={C.red} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>

        {p2 && <button onClick={() => { setSelectedPerson({ name: p2.name, folderId: PROFILE_FOLDERS[p2.name] }); setShowKids(false); }} style={{
          flex: 1, padding: mob ? 12 : 16, background: C.surface2, borderRadius: 12,
          border: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "fadeIn 0.5s ease 0.05s both",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <div style={{ fontFamily: "DM Sans", fontSize: mob ? 15 : 17, fontWeight: 600, color: C.accent, marginBottom: 8 }}>{p2?.name}</div>
          {[["Edad", p2?.current_age], ["Expectativa", p2?.life_expectancy], ["Años en retiro", p2?.retirement_years]].map(([l, v], j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{l}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: j === 2 ? C.green : C.text }}>{v ?? "—"}</span>
            </div>
          ))}
        </button>}
      </div>

      {showKids && (
        <div style={{ display: "flex", justifyContent: "center", gap: mob ? 16 : 24, padding: "12px 0", animation: "fadeIn 0.3s ease" }}>
          {KIDS.map((kid, i) => (
            <button key={i} onClick={() => { setSelectedPerson({ name: kid.name, folderId: kid.folderId, img: kid.img }); setShowKids(false); }} style={{
              background: "none", border: "none", cursor: "pointer", display: "flex",
              flexDirection: "column", alignItems: "center", gap: 8, transition: "transform 0.2s",
            }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <div style={{ width: mob ? 64 : 80, height: mob ? 64 : 80, borderRadius: 14, overflow: "hidden", border: `2px solid ${C.accent}60`, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                <img src={kid.img} alt={kid.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <span style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 13, fontWeight: 600, color: C.accent }}>{kid.name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: mob ? 12 : 16, flexWrap: "wrap" }}>
        <button onClick={() => { setShowProperties(true); setShowKids(false); setShowCars(false); }} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 20px",
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <span style={{ color: C.accent }}><HouseIcon /></span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Propiedades</span>
          <Badge color={C.textDim}>{PROPERTIES.filter(p => !p.sold).length}</Badge>
        </button>
        <button onClick={() => { setShowCars(true); setShowProperties(false); setShowKids(false); }} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 20px",
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#0EA5E9"; e.currentTarget.style.background = "#0EA5E915"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <span style={{ color: "#0EA5E9" }}><CarIcon /></span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0EA5E9" }}>Coches</span>
          <Badge color={C.textDim}>{CARS.length}</Badge>
        </button>
        <button onClick={() => { setShowDeadlines(true); setShowProperties(false); setShowCars(false); setShowKids(false); }} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 20px",
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#F59E0B"; e.currentTarget.style.background = "#F59E0B15"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <span style={{ color: "#F59E0B" }}><CalendarIcon /></span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>Vencimientos</span>
        </button>
        {goToPage && <button onClick={() => goToPage("daily")} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 20px",
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.accentGlow; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <span style={{ color: C.accent }}>{I.expenses}</span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent }}>Gastos Diarios</span>
        </button>}
        {goToPage && <button onClick={() => goToPage("daily")} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 20px",
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
        }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#F59E0B"; e.currentTarget.style.background = "#F59E0B15"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface2; }}>
          <span style={{ fontSize: 14 }}>🇺🇸🇲🇽</span>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>EUA vs México</span>
        </button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: mob ? 10 : 16, marginBottom: mob ? 16 : 28 }}>
        <StatCard label="PATRIMONIO NETO" value={fmt(nw)} sub={`Activos: ${fmt(totalA)}`} color={nw >= 0 ? C.green : C.red} icon={I.patrimony} delay={.1} mob={mob} />
        <StatCard label="INGRESOS ACTUALES" value={fmt(ti)} sub="Mensuales" color={C.blue} icon={I.income} delay={.15} mob={mob} />
        <StatCard label="GASTOS RETIRO" value={fmt(tre)} sub="Mensuales estimados" color={C.red} icon={I.expenses} delay={.2} mob={mob} />
        <StatCard label="INGRESOS RETIRO" value={fmt(tri)} sub="Mensuales proyectados" color={C.green} icon={I.income} delay={.25} mob={mob} />
      </div>

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
