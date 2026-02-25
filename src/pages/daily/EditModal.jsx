// ═══════════════════════════════════════════
// Archivo: src/pages/daily/EditModal.jsx
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { C, inputStyle } from "../../lib/theme";
import { fmtMoney, fmtDateShort, detectCountry } from "../../lib/helpers";
import { Badge, Btn } from "../../components/UI";
import {
  displayCat, CATEGORIES, SUBCATEGORIES, TAG_OPTIONS,
  Flag, CloseBtn, isPayment,
} from "./shared";

const EditModal = ({ expense, matchCount, onApplyBatch, onApplySingle, onClose, applying, mob }) => {
  if (!expense) return null;

  const apply = (field, value) =>
    matchCount > 1 ? onApplyBatch(expense, field, value) : onApplySingle(expense.id, field, value);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, zIndex: 10000, minWidth: mob ? "90vw" : 380, maxHeight: "80vh", overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.text }}>Editar gasto</h3>
          <CloseBtn onClick={onClose} />
        </div>
        <div style={{ padding: "8px 0 14px", borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.text }}>{expense.concept}</p>
          <p style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: C.textDim }}>{fmtDateShort(expense.expense_date)} · {fmtMoney(Number(expense.amount))}</p>
          {matchCount > 1 && <p style={{ fontFamily: "DM Sans", fontSize: 11, color: C.accent, marginTop: 4 }}>{matchCount} gastos con este concepto — cambios se aplican a todos</p>}
        </div>

        {/* Country */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>PAÍS <Flag country={expense.country || detectCountry(expense)} /></p>
          <div style={{ display: "flex", gap: 8 }}>
            {["US", "MX"].map(code => (
              <button key={code} onClick={() => apply("country", code)} style={{ padding: "7px 16px", background: (expense.country || detectCountry(expense)) === code ? `${C.accent}20` : C.surface2, border: `1px solid ${(expense.country || detectCountry(expense)) === code ? C.accent : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>{code === "US" ? "🇺🇸 EUA" : "🇲🇽 México"}</button>
            ))}
          </div>
          {matchCount > 1 && <p style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 4 }}>Se aplica a los {matchCount} gastos con este concepto</p>}
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>CATEGORÍA <Badge color={C.blue}>{displayCat(expense.category)}</Badge></p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => apply("category", cat)} disabled={applying} style={{ padding: "5px 12px", background: expense.category === cat ? `${C.blue}20` : C.surface2, border: `1px solid ${expense.category === cat ? C.blue : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text }}>{displayCat(cat)}</button>
            ))}
          </div>
        </div>

        {/* Subcategory */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>SUBCATEGORÍA {expense.subcategory && <Badge color="#A78BFA">{expense.subcategory}</Badge>}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(SUBCATEGORIES[expense.category] || SUBCATEGORIES.otro).map(sub => (
              <button key={sub} onClick={() => apply("subcategory", sub)} disabled={applying} style={{ padding: "5px 12px", background: expense.subcategory === sub ? "#A78BFA25" : C.surface2, border: `1px solid ${expense.subcategory === sub ? "#A78BFA" : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text }}>{sub}</button>
            ))}
          </div>
          <input placeholder="Otra subcategoría..." onKeyDown={e => { if (e.key === "Enter" && e.target.value) { apply("subcategory", e.target.value); } }} style={{ ...inputStyle, marginTop: 6, fontSize: 12 }} />
        </div>

        {/* Tag */}
        <div>
          <p style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>ASOCIAR CON {expense.tag && <Badge color="#10B981">{expense.tag}</Badge>}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TAG_OPTIONS.map(tag => (
              <button key={tag} onClick={() => apply("tag", tag)} disabled={applying} style={{ padding: "7px 14px", background: expense.tag === tag ? `${C.green}15` : C.surface2, border: `1px solid ${expense.tag === tag ? C.green : C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.text, textAlign: "left" }}>{tag}</button>
            ))}
            <input placeholder="Tag personalizado..." onKeyDown={e => { if (e.key === "Enter" && e.target.value) { apply("tag", e.target.value); } }} style={{ ...inputStyle, marginTop: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {expense.tag && <Btn onClick={() => onApplySingle(expense.id, "tag", null)} outline>Quitar tag</Btn>}
            {expense.subcategory && <Btn onClick={() => onApplySingle(expense.id, "subcategory", null)} outline>Quitar sub</Btn>}
          </div>
        </div>

        {applying && <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.accent, marginTop: 8 }}>Aplicando a {matchCount} registros...</p>}
      </div>
    </>
  );
};

export default EditModal;
