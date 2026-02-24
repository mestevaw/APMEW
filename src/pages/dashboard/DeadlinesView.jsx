// dashboard/DeadlinesView.jsx
import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch, supaInsert, supaUpdate, supaDelete } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { DEADLINE_TYPES, DEADLINE_CATEGORIES, RECURRENCE_OPTIONS, PROPERTIES, CARS } from "./constants";
import { getDeadlineStatus, fmtDate, getTypeInfo, getCatInfo } from "./helpers";
import { CalendarIcon } from "./icons";

const dateStyle = { background: "#fff", color: "#111", borderColor: "#ccc", fontFamily: "DM Sans", fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" };


const DeadlinesList = ({ deadlines, loading, onSave, onDelete, mob, filterCategory, filterEntity }) => {
  const [editing, setEditing] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editType, setEditType] = useState("seguro");
  const [editCat, setEditCat] = useState(filterCategory || "coche");
  const [editEntity, setEditEntity] = useState(filterEntity || "");
  const [editRecurrence, setEditRecurrence] = useState(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  let filtered = deadlines;
  if (filterCategory) filtered = filtered.filter(d => d.category === filterCategory);
  if (filterEntity) filtered = filtered.filter(d => d.entity_name === filterEntity);
  filtered.sort((a, b) => {
    const sa = getDeadlineStatus(a.due_date).urgency;
    const sb = getDeadlineStatus(b.due_date).urgency;
    if (sb !== sa) return sb - sa;
    return (a.due_date || "9999").localeCompare(b.due_date || "9999");
  });

  const handleSave = async (dl) => {
    setSaving(true);
    await onSave(dl ? dl.id : null, {
      category: dl ? dl.category : editCat,
      entity_name: dl ? dl.entity_name : editEntity,
      deadline_type: dl ? dl.deadline_type : editType,
      due_date: editDate || null,
      notes: editNotes || null,
      recurrence: editRecurrence,
    });
    setEditing(null); setAdding(false); setSaving(false);
  };

  const startEdit = (dl) => {
    setEditing(dl.id); setEditDate(dl.due_date || ""); setEditNotes(dl.notes || "");
    setEditRecurrence(dl.recurrence || null);
  };

  const startAdd = () => {
    setAdding(true); setEditing(null); setEditDate(""); setEditNotes("");
    setEditType("seguro"); setEditCat(filterCategory || "coche"); setEditEntity(filterEntity || "");
    setEditRecurrence(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 16 }}><Spinner /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {filtered.map(dl => {
        const ti = getTypeInfo(dl.deadline_type);
        const ci = getCatInfo(dl.category);
        const status = getDeadlineStatus(dl.due_date);
        const isEditing = editing === dl.id;
        return (
          <div key={dl.id} style={{ padding: "10px 14px", background: C.surface2, borderRadius: 10, border: `1px solid ${status.urgency >= 2 ? status.color + "60" : C.border}` }}>
            {isEditing ? (
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{ti.icon} {dl.label || ti.label} — {dl.entity_name}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={dateStyle} />
                  <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notas" style={{ ...dateStyle, flex: 1, minWidth: 100 }} />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {RECURRENCE_OPTIONS.map(r => (
                    <button key={r.key || "none"} onClick={() => setEditRecurrence(r.key)} style={{
                      padding: "3px 10px", borderRadius: 12, border: `1px solid ${editRecurrence === r.key ? C.accent : C.border}`,
                      background: editRecurrence === r.key ? C.accentGlow : "transparent", cursor: "pointer",
                      fontFamily: "DM Sans", fontSize: 10, color: editRecurrence === r.key ? C.accent : C.textDim,
                    }}>{r.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleSave(dl)} disabled={saving} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer" }}>{saving ? "..." : "Guardar"}</button>
                  <button onClick={() => setEditing(null)} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer" }}>Cancelar</button>
                  <button onClick={() => { onDelete(dl.id); setEditing(null); }} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: `1px solid #EF444440`, background: "transparent", color: "#EF4444", cursor: "pointer", marginLeft: "auto" }}>Borrar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(dl)} style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{ti.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text }}>
                    {dl.label || ti.label}
                    {!filterEntity && <span style={{ color: C.textDim, fontWeight: 400 }}> · {dl.entity_name}</span>}
                  </div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: status.color }}>
                    {dl.due_date ? fmtDate(dl.due_date) : "Sin fecha"}
                    {dl.recurrence && <span style={{ color: C.textMuted }}> · {dl.recurrence}</span>}
                    {dl.notes ? ` · ${dl.notes}` : ""}
                  </div>
                </div>
                {dl.due_date && <div style={{ width: 10, height: 10, borderRadius: "50%", background: status.color, flexShrink: 0 }} />}
                {dl.due_date && <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: status.color, whiteSpace: "nowrap" }}>{status.label}</span>}
              </button>
            )}
          </div>
        );
      })}

      {/* Add new */}
      {adding ? (
        <div style={{ padding: "12px 14px", background: C.surface2, borderRadius: 10, border: `1px solid ${C.accent}40` }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 10 }}>+ Nuevo vencimiento</div>
          {!filterCategory && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {DEADLINE_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setEditCat(c.key)} style={{
                  padding: "3px 10px", borderRadius: 12, border: `1px solid ${editCat === c.key ? c.color : C.border}`,
                  background: editCat === c.key ? c.color + "18" : "transparent", cursor: "pointer",
                  fontFamily: "DM Sans", fontSize: 11, color: editCat === c.key ? c.color : C.textDim,
                }}>{c.icon} {c.label}</button>
              ))}
            </div>
          )}
          {!filterEntity && (
            <input type="text" value={editEntity} onChange={e => setEditEntity(e.target.value)} placeholder="Entidad (ej: Hyundai Tucson, 9519 Gillcross...)" style={{ ...dateStyle, width: "100%", marginBottom: 8, boxSizing: "border-box" }} />
          )}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {DEADLINE_TYPES.map(t => (
              <button key={t.key} onClick={() => setEditType(t.key)} style={{
                padding: "3px 10px", borderRadius: 12, border: `1px solid ${editType === t.key ? C.accent : C.border}`,
                background: editType === t.key ? C.accentGlow : "transparent", cursor: "pointer",
                fontFamily: "DM Sans", fontSize: 11, color: editType === t.key ? C.accent : C.textDim,
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={dateStyle} />
            <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notas" style={{ ...dateStyle, flex: 1, minWidth: 100 }} />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {RECURRENCE_OPTIONS.map(r => (
              <button key={r.key || "none"} onClick={() => setEditRecurrence(r.key)} style={{
                padding: "3px 10px", borderRadius: 12, border: `1px solid ${editRecurrence === r.key ? C.accent : C.border}`,
                background: editRecurrence === r.key ? C.accentGlow : "transparent", cursor: "pointer",
                fontFamily: "DM Sans", fontSize: 10, color: editRecurrence === r.key ? C.accent : C.textDim,
              }}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => handleSave(null)} disabled={saving || !editEntity && !filterEntity} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", cursor: "pointer", opacity: (!editEntity && !filterEntity) ? 0.5 : 1 }}>{saving ? "..." : "Crear"}</button>
            <button onClick={() => setAdding(false)} style={{ fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={startAdd} style={{ padding: "10px 14px", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 10, cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, color: C.textDim, width: "100%", textAlign: "center" }}>+ Agregar vencimiento</button>
      )}

      {filtered.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>Sin vencimientos registrados</p>
        </div>
      )}
    </div>
  );
};


const DeadlinesView = ({ mob, onBack }) => {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const loadAll = async () => {
    setLoading(true);
    const all = await supaFetch("deadlines", { order: "due_date" });
    setDeadlines(all || []);
    setLoading(false);
  };
  useEffect(() => { loadAll(); }, []);

  const handleSave = async (id, data) => {
    if (id) await supaUpdate("deadlines", id, data);
    else await supaInsert("deadlines", data);
    await loadAll();
  };
  const handleDelete = async (id) => { await supaDelete("deadlines", id); await loadAll(); };

  const overdue = deadlines.filter(d => d.due_date && getDeadlineStatus(d.due_date).urgency >= 3).length;
  const soon = deadlines.filter(d => d.due_date && getDeadlineStatus(d.due_date).urgency === 2).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: C.accent }}><CalendarIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.accent, flex: 1 }}>Vencimientos</h1>
        <Badge color={C.textDim}>{deadlines.length}</Badge>
      </div>

      {(overdue > 0 || soon > 0) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {overdue > 0 && <Badge color="#EF4444">🔴 {overdue} vencido{overdue > 1 ? "s" : ""}</Badge>}
          {soon > 0 && <Badge color="#F59E0B">🟡 {soon} próximo{soon > 1 ? "s" : ""}</Badge>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={{
          padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === "all" ? C.accent : C.border}`,
          background: filter === "all" ? C.accentGlow : "transparent", cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: filter === "all" ? C.accent : C.textDim,
        }}>Todos ({deadlines.length})</button>
        {DEADLINE_CATEGORIES.map(c => {
          const count = deadlines.filter(d => d.category === c.key).length;
          return (
            <button key={c.key} onClick={() => setFilter(c.key)} style={{
              padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === c.key ? c.color : C.border}`,
              background: filter === c.key ? c.color + "18" : "transparent", cursor: "pointer",
              fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: filter === c.key ? c.color : C.textDim,
            }}>{c.icon} {c.label} ({count})</button>
          );
        })}
      </div>

      <Card>
        <DeadlinesList
          deadlines={deadlines}
          loading={loading}
          onSave={handleSave}
          onDelete={handleDelete}
          mob={mob}
          filterCategory={filter === "all" ? null : filter}
        />
      </Card>
    </div>
  );
};


export { DeadlinesList };
export default DeadlinesView;
