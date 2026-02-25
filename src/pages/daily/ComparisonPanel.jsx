// ═══════════════════════════════════════════
// Archivo: src/pages/daily/ComparisonPanel.jsx
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { C } from "../../lib/theme";
import { fmtMoney, detectCountry } from "../../lib/helpers";
import { Card, SectionTitle } from "../../components/UI";
import { isPayment, displayCat, CloseBtn } from "./shared";

const pBar = (val, max, color) => (
  <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
    <div style={{ width: `${max > 0 ? (val / max * 100) : 0}%`, height: "100%", background: color, borderRadius: 4 }} />
  </div>
);

const ComparisonPanel = ({ dailyExpenses, onClose }) => {
  const all = dailyExpenses.filter(e => !isPayment(e));
  const usItems = all.filter(e => (e.country || detectCountry(e)) === "US");
  const mxItems = all.filter(e => (e.country || detectCountry(e)) === "MX");
  const usTotal = usItems.reduce((s, e) => s + Number(e.amount || 0), 0);
  const mxTotal = mxItems.reduce((s, e) => s + Number(e.amount || 0), 0);
  const grandTotal = usTotal + mxTotal;

  const catBk = (items) => {
    const m = {};
    items.forEach(e => { const c = e.category || "otro"; m[c] = (m[c] || 0) + Number(e.amount || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const usCats = catBk(usItems);
  const mxCats = catBk(mxItems);

  const monthly = {};
  all.forEach(e => {
    const ym = (e.expense_date || "").slice(0, 7);
    if (!ym) return;
    if (!monthly[ym]) monthly[ym] = { us: 0, mx: 0 };
    monthly[ym][(e.country || detectCountry(e)) === "MX" ? "mx" : "us"] += Number(e.amount || 0);
  });
  const mos = Object.entries(monthly).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <Card style={{ marginBottom: 16, borderColor: "#F59E0B" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <SectionTitle style={{ margin: 0 }}>🇺🇸 EUA vs 🇲🇽 México</SectionTitle>
        <CloseBtn onClick={onClose} />
      </div>

      {/* Totals */}
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

      {/* By category */}
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

      {/* Monthly */}
      <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>Por mes</div>
      <div style={{ maxHeight: 200, overflow: "auto" }}>
        {mos.map(([ym, d]) => <div key={ym} style={{ display: "grid", gridTemplateColumns: "55px 1fr 70px 1fr 70px", gap: 4, padding: "4px 0", alignItems: "center" }}><span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.textDim }}>{ym}</span>{pBar(d.us, Math.max(d.us, d.mx), "#3B82F6")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#3B82F6", textAlign: "right" }}>{fmtMoney(d.us)}</span>{pBar(d.mx, Math.max(d.us, d.mx), "#10B981")}<span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: "#10B981", textAlign: "right" }}>{fmtMoney(d.mx)}</span></div>)}
      </div>
    </Card>
  );
};

export default ComparisonPanel;
