import { useState } from "react";
import { C } from "../lib/theme";
import { fmt } from "../lib/helpers";
import { I } from "../lib/icons";
import { supaUpdate, supaInsert, supaDelete } from "../lib/supabase";
import { Card, Btn, Table, Modal } from "../components/UI";

export const CrudPage = ({ title, subtitle, table, items, columns, formFields, defaults, mob, reload, totalLabel, totalKey }) => {
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

  const handleDelete = async () => {
    if (confirm("¿Seguro?")) { await supaDelete(table, modal.row.id); setModal(null); reload(); }
  };

  const total = totalKey ? items.reduce((s, i) => s + Number(i[totalKey] || 0), 0) : null;

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>{subtitle}</p>
      <div style={{ marginBottom: 16 }}><Btn onClick={openAdd}>{I.plus} Agregar</Btn></div>
      <Card>
        <Table columns={columns} data={items} onEdit={openEdit} mob={mob} />
        {total !== null && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 14px 0", borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, fontWeight: 600, color: C.textDim }}>{totalLabel}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 17 : 20, fontWeight: 600, color: C.accent }}>{fmt(total)}</span>
            </div>
          </div>
        )}
      </Card>
      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar" : "Agregar"} fields={formFields} values={form}
          onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))}
          onSave={handleSave} onDelete={modal.mode === "edit" ? handleDelete : null}
          onCancel={() => setModal(null)} mob={mob} />
      )}
    </div>
  );
};
