import { useState } from "react";
import { C } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaUpdate, supaInsert, supaDelete } from "../lib/supabase";
import { Card, SectionTitle, Btn, Table, Modal } from "../components/UI";

export const ExpensesPage = ({ expenses, categories, mob, reload }) => {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const grouped = categories.map(cat => ({
    ...cat,
    items: expenses.filter(e => e.category_id === cat.id),
    subtotal: expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + Number(e.monthly_amount || 0), 0),
  }));
  const total = expenses.reduce((s, e) => s + Number(e.monthly_amount || 0), 0);

  const openAdd = (catId) => { setForm({ category_id: catId, concept: "", monthly_amount: 0, notes: "" }); setModal({ mode: "add" }); };
  const openEdit = (row) => { setForm({ ...row }); setModal({ mode: "edit", row }); };

  const fields = [
    { key: "concept", label: "Concepto" },
    { key: "monthly_amount", label: "Monto Mensual", type: "number" },
    { key: "category_id", label: "Categoría", type: "select", options: categories.map(c => ({ value: c.id, label: c.name })) },
    { key: "notes", label: "Notas" },
  ];

  const handleSave = async () => {
    const d = { concept: form.concept, monthly_amount: Number(form.monthly_amount) || 0, category_id: form.category_id, notes: form.notes || null };
    if (modal.mode === "edit") await supaUpdate("retirement_expenses", modal.row.id, d);
    else await supaInsert("retirement_expenses", d);
    setModal(null); reload();
  };

  const handleDelete = async () => {
    if (confirm("¿Eliminar?")) { await supaDelete("retirement_expenses", modal.row.id); setModal(null); reload(); }
  };

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos en Retiro</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Proyección de gastos mensuales</p>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(140px,1fr))", gap: mob ? 8 : 12, marginBottom: 20 }}>
        {grouped.map((g, i) => (
          <Card key={i} delay={i * .05} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{g.icon}</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>{g.name}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 14 : 16, fontWeight: 600, color: C.accent }}>{fmt(g.subtotal)}</div>
          </Card>
        ))}
        <Card delay={.3} style={{ padding: "12px 14px", textAlign: "center", borderColor: C.accent }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>💰</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>TOTAL</div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 14 : 16, fontWeight: 600, color: C.red }}>{fmt(total)}</div>
        </Card>
      </div>

      {grouped.map((g, gi) => (
        <Card key={gi} delay={gi * .05} style={{ marginBottom: 14 }}>
          <SectionTitle icon={<span style={{ fontSize: 18 }}>{g.icon}</span>} action={<Btn onClick={() => openAdd(g.id)} small>{I.plus} Agregar</Btn>}>{g.name}</SectionTitle>
          <Table columns={[
            { label: "Concepto", key: "concept", bold: true },
            { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
            { label: "Notas", key: "notes", color: () => C.textDim },
          ]} data={g.items} onEdit={openEdit} mob={mob} />
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginRight: 12 }}>Subtotal</span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 600, color: C.accent }}>{fmt(g.subtotal)}</span>
          </div>
        </Card>
      ))}

      {modal && <Modal title={modal.mode === "edit" ? "Editar Gasto" : "Nuevo Gasto"} fields={fields} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null} onCancel={() => setModal(null)} mob={mob} />}
    </div>
  );
};
