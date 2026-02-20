import { useState } from "react";
import { C } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaUpdate, supaInsert, supaDelete } from "../lib/supabase";
import { Card, StatCard, SectionTitle, Badge, Btn, Table, Modal } from "../components/UI";

export const PatrimonyPage = ({ assets, debts, mob, reload }) => {
  const totalA = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
  const totalD = debts.reduce((s, d) => s + Number(d.outstanding_balance || 0), 0);

  const aF = [
    { key: "name", label: "Nombre" },
    { key: "asset_type", label: "Tipo", type: "select", options: [{ value: "real_estate", label: "Inmueble" }, { value: "investment", label: "Inversión" }, { value: "business", label: "Negocio" }, { value: "other", label: "Otro" }] },
    { key: "current_value", label: "Valor Actual", type: "number" },
    { key: "notes", label: "Notas" },
  ];
  const dF = [
    { key: "name", label: "Nombre" },
    { key: "outstanding_balance", label: "Saldo Pendiente", type: "number" },
    { key: "monthly_payment", label: "Pago Mensual", type: "number" },
    { key: "interest_rate", label: "Tasa Interés", type: "number" },
    { key: "notes", label: "Notas" },
  ];

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [eT, setET] = useState(null); // "asset" | "debt"

  const openAdd = (t) => {
    setET(t);
    setForm(t === "asset" ? { name: "", asset_type: "investment", current_value: 0 } : { name: "", outstanding_balance: 0, monthly_payment: 0 });
    setModal({ mode: "add" });
  };
  const openEdit = (row, t) => { setET(t); setForm({ ...row }); setModal({ mode: "edit", row }); };

  const handleSave = async () => {
    const tbl = eT === "asset" ? "assets" : "debts";
    const d = { ...form };
    (eT === "asset" ? aF : dF).forEach(f => { if (f.type === "number" && d[f.key] !== undefined) d[f.key] = Number(d[f.key]) || 0; });
    ["id", "created_at", "updated_at", "sort_order", "currency"].forEach(k => delete d[k]);
    if (modal.mode === "edit") await supaUpdate(tbl, modal.row.id, d);
    else await supaInsert(tbl, d);
    setModal(null); reload();
  };

  const handleDelete = async () => {
    if (confirm("¿Eliminar?")) { await supaDelete(eT === "asset" ? "assets" : "debts", modal.row.id); setModal(null); reload(); }
  };

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Patrimonio</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Activos, inversiones y deudas</p>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: mob ? 10 : 16, marginBottom: 20 }}>
        <StatCard label="TOTAL ACTIVOS" value={fmt(totalA)} color={C.green} delay={.05} mob={mob} />
        <StatCard label="TOTAL DEUDAS" value={fmt(totalD)} color={C.red} delay={.1} mob={mob} />
        <StatCard label="PATRIMONIO NETO" value={fmt(totalA - totalD)} color={totalA - totalD >= 0 ? C.accent : C.red} delay={.15} mob={mob} />
      </div>

      <Card delay={.2} style={{ marginBottom: 14 }}>
        <SectionTitle icon={I.patrimony} action={<Btn onClick={() => openAdd("asset")} small>{I.plus} Agregar</Btn>}>Activos</SectionTitle>
        <Table columns={[
          { label: "Activo", key: "name", bold: true },
          { label: "Tipo", key: "asset_type", render: r => <Badge color={r.asset_type === "real_estate" ? C.blue : r.asset_type === "investment" ? C.green : C.accent}>{r.asset_type === "real_estate" ? "Inmueble" : r.asset_type === "investment" ? "Inversión" : r.asset_type === "business" ? "Negocio" : "Otro"}</Badge> },
          { label: "Valor Actual", key: "current_value", align: "right", mono: true, render: r => fmt(Number(r.current_value)) },
        ]} data={assets} onEdit={r => openEdit(r, "asset")} mob={mob} />
      </Card>

      <Card delay={.25}>
        <SectionTitle icon={<span style={{ fontSize: 18 }}>💳</span>} action={<Btn onClick={() => openAdd("debt")} small>{I.plus} Agregar</Btn>}>Deudas</SectionTitle>
        <Table columns={[
          { label: "Deuda", key: "name", bold: true },
          { label: "Saldo", key: "outstanding_balance", align: "right", mono: true, render: r => fmt(Number(r.outstanding_balance)), color: r => Number(r.outstanding_balance) > 0 ? C.red : C.text },
          { label: "Pago Mensual", key: "monthly_payment", align: "right", mono: true, render: r => fmt(Number(r.monthly_payment)) },
        ]} data={debts} onEdit={r => openEdit(r, "debt")} mob={mob} />
      </Card>

      {modal && <Modal title={modal.mode === "edit" ? "Editar" : "Agregar"} fields={eT === "asset" ? aF : dF} values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null} onCancel={() => setModal(null)} mob={mob} />}
    </div>
  );
};
