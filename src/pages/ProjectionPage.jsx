import { C } from "../lib/theme";
import { fmt, pct } from "../lib/helpers";
import { Card, Table } from "../components/UI";

export const ProjectionPage = ({ profiles, assumptions, mob }) => {
  const p1 = profiles.find(p => p.name === "Miguel") || profiles[0];
  const p2 = profiles.find(p => p.name === "AnaP") || profiles[1];
  const supuestos = [
    assumptions.find(a => a.key === "inflation_rate"),
    assumptions.find(a => a.key === "pre_retirement_return"),
    assumptions.find(a => a.key === "retirement_return"),
    assumptions.find(a => a.key === "safe_withdrawal_rate"),
  ].filter(Boolean);
  const years = Array.from({ length: 31 }, (_, i) => ({ year: i, ageP1: p1 ? p1.current_age + i : "-", ageP2: p2 ? p2.current_age + i : "-" }));

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Proyección 30 Años</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Simulación del patrimonio</p>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: mob ? 8 : 12, marginBottom: 20 }}>
        {supuestos.map((a, i) => (
          <Card key={i} delay={i * .05} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>{a.label}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 20, fontWeight: 600, color: C.accent }}>{pct(Number(a.value))}</div>
          </Card>
        ))}
      </div>

      <Card delay={.2}>
        <Table columns={[
          { label: "Año", key: "year", mono: true, bold: true },
          { label: p1?.name || "P1", key: "ageP1", mono: true },
          { label: p2?.name || "P2", key: "ageP2", mono: true },
          { label: "Aportación", key: "x", mono: true, align: "right", render: () => fmt(0) },
          { label: "Rendimiento", key: "x2", mono: true, align: "right", render: () => fmt(0) },
          { label: "Retiro", key: "x3", mono: true, align: "right", render: () => fmt(0) },
          { label: "Patrimonio", key: "x4", mono: true, align: "right", render: () => <span style={{ color: C.accent }}>{fmt(0)}</span> },
        ]} data={years} mob={mob} />
      </Card>
    </div>
  );
};
