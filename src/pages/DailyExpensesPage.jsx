import { useState } from "react";
import { C, inputStyle } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaDelete } from "../lib/supabase";
import { Card, SectionTitle, Badge, Btn, Table } from "../components/UI";

export const DailyExpensesPage = ({ dailyExpenses, onAdd, mob, reload }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" });
  const cats = ["supermercado", "transporte", "salud", "entretenimiento", "servicios", "restaurantes", "hogar", "otro"];

  const handleSubmit = async () => {
    if (!form.concept || !form.amount) return;
    await onAdd({ ...form, amount: Number(form.amount), expense_date: new Date().toISOString().split("T")[0] });
    setForm({ concept: "", amount: "", category: "supermercado", who: "Miguel", payment_method: "tarjeta" });
    setShowForm(false);
  };

  const handleDeleteDaily = async (row) => {
    if (confirm("¿Eliminar?")) { await supaDelete("daily_expenses", row.id); reload(); }
  };

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Gastos del Día a Día</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Registro de gastos reales</p>

      {!showForm ? (
        <Btn onClick={() => setShowForm(true)} style={{ marginBottom: 20 }}>{I.plus} Registrar Gasto</Btn>
      ) : (
        <Card style={{ marginBottom: 20, borderColor: C.accent }}>
          <SectionTitle>Nuevo Gasto</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Concepto" value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} style={inputStyle} />
            <input placeholder="Monto" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: "JetBrains Mono" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
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
            <Btn onClick={handleSubmit}>Guardar</Btn>
            <Btn onClick={() => setShowForm(false)} outline>Cancelar</Btn>
          </div>
        </Card>
      )}

      <Card>
        {dailyExpenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, color: C.textDim }}>Aún no hay gastos registrados</p>
          </div>
        ) : (
          <Table columns={[
            { label: "Fecha", key: "expense_date", mono: true },
            { label: "Concepto", key: "concept", bold: true },
            { label: "Categoría", key: "category", render: r => <Badge>{r.category}</Badge> },
            { label: "Quién", key: "who" },
            { label: "Monto", key: "amount", align: "right", mono: true, render: r => fmt(Number(r.amount)), color: () => C.red },
          ]} data={dailyExpenses} onDelete={handleDeleteDaily} mob={mob} />
        )}
      </Card>
    </div>
  );
};
