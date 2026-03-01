// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/ChoresView.jsx
// Vista: División de Labores del Hogar (CRUD)
// Tabla Supabase: household_chores
// Fecha: 2026-03-01
// ═══════════════════════════════════════════
//
// SQL para crear la tabla:
//
//   CREATE TABLE household_chores (
//     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     category TEXT NOT NULL,
//     task TEXT NOT NULL,
//     who TEXT NOT NULL DEFAULT 'Ambos',
//     frequency TEXT DEFAULT 'Semanal',
//     hours_per_week NUMERIC DEFAULT 1,
//     notes TEXT,
//     sort_order INT DEFAULT 0,
//     created_at TIMESTAMPTZ DEFAULT now()
//   );
//
//   ALTER TABLE household_chores ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Allow all" ON household_chores FOR ALL USING (true) WITH CHECK (true);
//
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch, supaInsert, supaUpdate, supaDelete, supaBatchInsert } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { ChoresIcon } from "./icons";

// ─── Constantes ───
const WHO_OPTIONS = ["Miguel", "AnaP", "Ambos"];
const WHO_COLOR = { Miguel: "#60A5FA", AnaP: "#F472B6", Ambos: "#C8A862" };
const WHO_LABEL = { Miguel: "Miguel", AnaP: "AnaP", Ambos: "Ambos" };

const FREQ_OPTIONS = ["Diaria", "2-3 veces/sem.", "Semanal", "Quincenal", "Mensual", "Según necesidad"];

const CAT_EMOJI = {
  "COCINA Y ALIMENTACIÓN": "🍳",
  "LIMPIEZA GENERAL": "🧹",
  "LAVANDERÍA Y ROPA": "👕",
  "MANTENIMIENTO DEL HOGAR": "🔧",
  "ADMINISTRACIÓN DEL HOGAR": "📋",
};

// ─── Seed: datos iniciales del Excel (solo se insertan si la tabla está vacía) ───
const SEED_DATA = [
  { cat: "COCINA Y ALIMENTACIÓN", tasks: [
    { task: "Preparar desayuno",       who: "Miguel", frequency: "Diaria",         hours_per_week: 4,   notes: "Mr. Esteva loves da' cookin'" },
    { task: "Preparar comida/cena",    who: "Miguel", frequency: "Diaria",         hours_per_week: 4,   notes: "Mr. Esteva loves da' cookin'" },
    { task: "Lavar platos",            who: "Miguel", frequency: "Diaria",         hours_per_week: 3,   notes: "Y guardar trastes limpios" },
    { task: "Planificar menú semanal", who: "Miguel", frequency: "Semanal",        hours_per_week: 1,   notes: "Hacerlo juntos el domingo" },
    { task: "Compras de supermercado", who: "Miguel", frequency: "Semanal",        hours_per_week: 1,   notes: "Incluye guardar todo" },
  ]},
  { cat: "LIMPIEZA GENERAL", tasks: [
    { task: "Barrer / Aspirar pisos",     who: "Miguel", frequency: "2-3 veces/sem.", hours_per_week: 2,   notes: "Todas las áreas comunes" },
    { task: "Trapear pisos",              who: "AnaP",   frequency: "Semanal",        hours_per_week: 1.5, notes: "Alternar con aspirado" },
    { task: "Limpiar baños",              who: "Ambos",  frequency: "Semanal",        hours_per_week: 1.5, notes: "Escusado, lavabo, ducha" },
    { task: "Limpiar cocina a fondo",     who: "Ambos",  frequency: "Semanal",        hours_per_week: 1.5, notes: "Electrodomésticos, superficies" },
    { task: "Sacudir y ordenar sala",     who: "AnaP",   frequency: "Semanal",        hours_per_week: 1,   notes: "Mantener orden diario" },
    { task: "Limpiar ventanas y espejos", who: "Miguel", frequency: "Quincenal",      hours_per_week: 0.5, notes: "Rotar con otras tareas" },
  ]},
  { cat: "LAVANDERÍA Y ROPA", tasks: [
    { task: "Lavar ropa Miguel",  who: "Miguel", frequency: "2-3 veces/sem.", hours_per_week: 2   },
    { task: "Lavar ropa AnaP",    who: "AnaP",   frequency: "2-3 veces/sem.", hours_per_week: 1.5 },
    { task: "Toallas y sábanas",  who: "AnaP",   frequency: "Semanal",        hours_per_week: 1.5 },
  ]},
  { cat: "MANTENIMIENTO DEL HOGAR", tasks: [
    { task: "Sacar basura / Reciclaje",   who: "Miguel", frequency: "Diaria",          hours_per_week: 1,   notes: "Separar reciclables" },
    { task: "Reparaciones menores",       who: "Ambos",  frequency: "Según necesidad", hours_per_week: 1,   notes: "Focos, filtros, pintura" },
    { task: "Organizar espacios/clósets", who: "AnaP",   frequency: "Mensual",         hours_per_week: 0.5, notes: "Donar lo que no se usa" },
    { task: "Cuidado de plantas/jardín",  who: "AnaP",   frequency: "Semanal",         hours_per_week: 1,   notes: "Regar, podar, mantener" },
    { task: "Cuidado de Rosita",          who: "Miguel", frequency: "Diaria",          hours_per_week: 3,   notes: "Alimentar, limpiar, veterinario" },
  ]},
  { cat: "ADMINISTRACIÓN DEL HOGAR", tasks: [
    { task: "Pagar cuentas / Finanzas", who: "Ambos", frequency: "Mensual",         hours_per_week: 0.5, notes: "Presupuesto compartido" },
    { task: "Trámites y gestiones",     who: "AnaP",  frequency: "Según necesidad", hours_per_week: 0.5, notes: "Coordinar servicios" },
    { task: "Planificación familiar",   who: "Ambos", frequency: "Semanal",         hours_per_week: 0.5, notes: "Revisar agenda y pendientes" },
  ]},
];

const buildSeedRows = () => {
  const rows = [];
  let order = 0;
  for (const cat of SEED_DATA) {
    for (const t of cat.tasks) {
      rows.push({
        category: cat.cat,
        task: t.task,
        who: t.who,
        frequency: t.frequency,
        hours_per_week: t.hours_per_week,
        notes: t.notes || null,
        sort_order: order++,
      });
    }
  }
  return rows;
};

// ─── Estilos de input (consistentes con DeadlinesView) ───
const fieldStyle = {
  background: "#fff", color: "#111", borderColor: "#ccc",
  fontFamily: "DM Sans", fontSize: 13, padding: "6px 10px",
  borderRadius: 6, border: "1px solid #ccc", outline: "none",
};

// ─── Pill selector reutilizable ───
const PillSelect = ({ options, value, onChange, colorFn }) => (
  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
    {options.map(opt => {
      const active = value === opt;
      const color = colorFn ? colorFn(opt) : C.accent;
      return (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "3px 10px", borderRadius: 12, cursor: "pointer",
          border: `1px solid ${active ? color : C.border}`,
          background: active ? color + "20" : "transparent",
          fontFamily: "DM Sans", fontSize: 11, color: active ? color : C.textDim,
          transition: "all 0.15s",
        }}>{opt}</button>
      );
    })}
  </div>
);

// ─── Inline edit / add form ───
const ChoreForm = ({ form, onChange, onSave, onCancel, onDelete, saving, isNew, mob }) => {
  const set = (key, val) => onChange({ ...form, [key]: val });
  return (
    <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.accent}40` }}>
      {/* Task name */}
      <input
        type="text" value={form.task} placeholder="Nombre de la tarea"
        onChange={e => set("task", e.target.value)}
        style={{ ...fieldStyle, width: "100%", marginBottom: 8, fontWeight: 600, boxSizing: "border-box" }}
        autoFocus
      />

      {/* Who */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Responsable</div>
        <PillSelect options={WHO_OPTIONS} value={form.who} onChange={v => set("who", v)} colorFn={w => WHO_COLOR[w] || C.accent} />
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Frecuencia</div>
        <PillSelect options={FREQ_OPTIONS} value={form.frequency} onChange={v => set("frequency", v)} />
      </div>

      {/* Hours + Notes */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 90 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Hrs/sem</div>
          <input type="number" step="0.5" min="0" value={form.hours_per_week} onChange={e => set("hours_per_week", e.target.value)}
            style={{ ...fieldStyle, width: "100%", fontFamily: "JetBrains Mono", boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Notas</div>
          <input type="text" value={form.notes || ""} placeholder="Notas (opcional)" onChange={e => set("notes", e.target.value)}
            style={{ ...fieldStyle, width: "100%", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={onSave} disabled={saving || !form.task.trim()} style={{
          fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6,
          border: "none", background: C.accent, color: "#fff", cursor: "pointer",
          opacity: (!form.task.trim() || saving) ? 0.5 : 1,
        }}>{saving ? "..." : isNew ? "Crear" : "Guardar"}</button>
        <button onClick={onCancel} style={{
          fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6,
          border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer",
        }}>Cancelar</button>
        {onDelete && (
          <button onClick={onDelete} style={{
            fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6,
            border: `1px solid #EF444440`, background: "transparent", color: "#EF4444",
            cursor: "pointer", marginLeft: "auto",
          }}>Eliminar</button>
        )}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
const ChoresView = ({ mob, onBack }) => {
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Adding task
  const [addingCat, setAddingCat] = useState(null);
  const [addForm, setAddForm] = useState({});

  // Adding category
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // ─── Load data (seed if empty) ───
  const loadAll = async () => {
    setLoading(true);
    try {
      let rows = await supaFetch("household_chores", { order: "sort_order,created_at" });
      if (!rows || rows.length === 0) {
        rows = await supaBatchInsert("household_chores", buildSeedRows());
      }
      setChores(rows || []);
    } catch (err) {
      console.error("Error loading household_chores:", err);
    }
    setLoading(false);
  };
  useEffect(() => { loadAll(); }, []);

  // ─── CRUD ───
  const handleSave = async (id, data) => {
    setSaving(true);
    try {
      if (id) await supaUpdate("household_chores", id, data);
      else await supaInsert("household_chores", data);
      await loadAll();
    } catch (err) {
      console.error("Error saving chore:", err);
    }
    setSaving(false);
    setEditingId(null);
    setAddingCat(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      await supaDelete("household_chores", id);
      await loadAll();
    } catch (err) {
      console.error("Error deleting chore:", err);
    }
    setEditingId(null);
  };

  // ─── Editing helpers ───
  const startEdit = (chore) => {
    setEditingId(chore.id);
    setEditForm({
      task: chore.task,
      who: chore.who,
      frequency: chore.frequency,
      hours_per_week: chore.hours_per_week,
      notes: chore.notes || "",
    });
    setAddingCat(null);
  };

  const startAdd = (cat) => {
    setAddingCat(cat);
    setAddForm({ task: "", who: "Ambos", frequency: "Semanal", hours_per_week: 1, notes: "" });
    setEditingId(null);
  };

  // ─── Derived data ───
  const categories = [...new Set(chores.map(c => c.category))];
  const allTasks = chores;
  const miguelHrs = allTasks.filter(t => t.who === "Miguel").reduce((s, t) => s + Number(t.hours_per_week || 0), 0);
  const anapHrs   = allTasks.filter(t => t.who === "AnaP").reduce((s, t) => s + Number(t.hours_per_week || 0), 0);
  const ambosHrs  = allTasks.filter(t => t.who === "Ambos").reduce((s, t) => s + Number(t.hours_per_week || 0), 0);
  const totalHrs  = miguelHrs + anapHrs + ambosHrs;

  const filteredCats = filter === "all"
    ? categories
    : categories.filter(cat => chores.some(c => c.category === cat && c.who === filter));

  // ─── Loading ───
  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
          <span style={{ color: "#A78BFA" }}><ChoresIcon /></span>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: "#A78BFA", flex: 1 }}>Labores del Hogar</h1>
        </div>
        <div style={{ textAlign: "center", padding: 40 }}><Spinner /></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: "#A78BFA" }}><ChoresIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: "#A78BFA", flex: 1 }}>Labores del Hogar</h1>
        <Badge color={C.textDim}>{chores.length}</Badge>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Miguel", hrs: miguelHrs, color: WHO_COLOR.Miguel },
          { label: "AnaP", hrs: anapHrs, color: WHO_COLOR.AnaP },
          { label: "Compartidas", hrs: ambosHrs, color: WHO_COLOR.Ambos },
          { label: "Total hogar", hrs: totalHrs, color: C.text },
        ].map((s, i) => (
          <div key={i} style={{ padding: mob ? "10px 12px" : "14px 16px", background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 18 : 22, fontWeight: 600, color: s.color }}>
              {s.hrs}<span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>hrs/sem</span>
            </div>
            {i < 3 && (
              <div style={{ marginTop: 6, height: 4, background: C.bg, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${totalHrs > 0 ? (s.hrs / totalHrs) * 100 : 0}%`, height: "100%", background: s.color, borderRadius: 2 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "all", label: `Todos (${allTasks.length})`, color: C.accent },
          { key: "Miguel", label: `Miguel (${allTasks.filter(t => t.who === "Miguel").length})`, color: WHO_COLOR.Miguel },
          { key: "AnaP", label: `AnaP (${allTasks.filter(t => t.who === "AnaP").length})`, color: WHO_COLOR.AnaP },
          { key: "Ambos", label: `Ambos (${allTasks.filter(t => t.who === "Ambos").length})`, color: WHO_COLOR.Ambos },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "5px 14px", borderRadius: 20, cursor: "pointer",
            border: `1px solid ${filter === f.key ? f.color : C.border}`,
            background: filter === f.key ? f.color + "18" : "transparent",
            fontFamily: "DM Sans", fontSize: 12, fontWeight: 500,
            color: filter === f.key ? f.color : C.textDim,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Task categories */}
      {filteredCats.map((cat, ci) => {
        const catTasks = chores
          .filter(c => c.category === cat && (filter === "all" || c.who === filter))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const catHrs = catTasks.reduce((s, t) => s + Number(t.hours_per_week || 0), 0);

        return (
          <Card key={ci} style={{ marginBottom: 12 }}>
            {/* Category header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>{CAT_EMOJI[cat] || "📌"}</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>{cat}</span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.textDim }}>{catHrs}h</span>
              <Badge color={C.textDim}>{catTasks.length}</Badge>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {catTasks.map((t) => {
                // ── Editing this task ──
                if (editingId === t.id) {
                  return (
                    <ChoreForm
                      key={t.id} form={editForm} mob={mob} saving={saving} isNew={false}
                      onChange={setEditForm}
                      onSave={() => handleSave(t.id, {
                        task: editForm.task,
                        who: editForm.who,
                        frequency: editForm.frequency,
                        hours_per_week: Number(editForm.hours_per_week) || 0,
                        notes: editForm.notes || null,
                      })}
                      onCancel={() => { setEditingId(null); setEditForm({}); }}
                      onDelete={() => handleDelete(t.id)}
                    />
                  );
                }

                // ── Display task (click to edit) ──
                return (
                  <button key={t.id} onClick={() => startEdit(t)} style={{
                    display: "flex", alignItems: "center", gap: mob ? 8 : 12,
                    padding: "8px 12px", background: C.surface2, borderRadius: 8,
                    border: "none", borderLeft: `3px solid ${WHO_COLOR[t.who] || C.border}`,
                    cursor: "pointer", width: "100%", textAlign: "left", transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg}
                    onMouseLeave={e => e.currentTarget.style.background = C.surface2}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text }}>{t.task}</div>
                      {t.notes && <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 2 }}>{t.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: mob ? 6 : 10, flexShrink: 0 }}>
                      <span style={{
                        fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: (WHO_COLOR[t.who] || C.accent) + "18", color: WHO_COLOR[t.who] || C.accent,
                      }}>{WHO_LABEL[t.who] || t.who}</span>
                      {!mob && <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, minWidth: 65, textAlign: "right" }}>{t.frequency}</span>}
                      <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, color: C.accent, minWidth: 32, textAlign: "right" }}>{Number(t.hours_per_week)}h</span>
                      <svg width="12" height="12" fill="none" stroke={C.textMuted} strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </div>
                  </button>
                );
              })}

              {/* Add task in this category */}
              {addingCat === cat ? (
                <ChoreForm
                  form={addForm} mob={mob} saving={saving} isNew={true}
                  onChange={setAddForm}
                  onSave={() => {
                    const maxSort = catTasks.reduce((m, t) => Math.max(m, t.sort_order || 0), 0);
                    handleSave(null, {
                      category: cat,
                      task: addForm.task,
                      who: addForm.who,
                      frequency: addForm.frequency,
                      hours_per_week: Number(addForm.hours_per_week) || 0,
                      notes: addForm.notes || null,
                      sort_order: maxSort + 1,
                    });
                  }}
                  onCancel={() => { setAddingCat(null); setAddForm({}); }}
                />
              ) : (
                <button onClick={() => startAdd(cat)} style={{
                  padding: "8px 14px", background: "transparent",
                  border: `1px dashed ${C.border}`, borderRadius: 8, cursor: "pointer",
                  fontFamily: "DM Sans", fontSize: 12, color: C.textDim,
                  width: "100%", textAlign: "center", transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
                >+ Agregar tarea</button>
              )}
            </div>
          </Card>
        );
      })}

      {/* Show add form for a brand-new category (not yet in DB) */}
      {addingCat && !categories.includes(addingCat) && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📌</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>{addingCat}</span>
          </div>
          <ChoreForm
            form={addForm} mob={mob} saving={saving} isNew={true}
            onChange={setAddForm}
            onSave={() => handleSave(null, {
              category: addingCat,
              task: addForm.task,
              who: addForm.who,
              frequency: addForm.frequency,
              hours_per_week: Number(addForm.hours_per_week) || 0,
              notes: addForm.notes || null,
              sort_order: 0,
            })}
            onCancel={() => { setAddingCat(null); setAddForm({}); }}
          />
        </Card>
      )}

      {/* Add new category */}
      {addingNewCat ? (
        <Card style={{ marginBottom: 12, border: `1px solid ${C.accent}40` }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 10 }}>Nueva categoría</div>
          <input
            type="text" value={newCatName} placeholder="Nombre de la categoría (ej: CUIDADO PERSONAL)"
            onChange={e => setNewCatName(e.target.value.toUpperCase())}
            style={{ ...fieldStyle, width: "100%", marginBottom: 10, fontWeight: 600, boxSizing: "border-box" }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                if (!newCatName.trim()) return;
                const catName = newCatName.trim();
                setAddingNewCat(false);
                setNewCatName("");
                startAdd(catName);
              }}
              disabled={!newCatName.trim()}
              style={{
                fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6,
                border: "none", background: C.accent, color: "#fff", cursor: "pointer",
                opacity: newCatName.trim() ? 1 : 0.5,
              }}
            >Continuar</button>
            <button onClick={() => { setAddingNewCat(false); setNewCatName(""); }} style={{
              fontFamily: "DM Sans", fontSize: 12, padding: "5px 14px", borderRadius: 6,
              border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer",
            }}>Cancelar</button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setAddingNewCat(true)} style={{
          padding: "12px", background: "transparent", width: "100%",
          border: `1px dashed ${C.border}`, borderRadius: 10, cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 13, color: C.textDim, textAlign: "center",
          marginBottom: 16, transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#A78BFA"; e.currentTarget.style.color = "#A78BFA"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
        >+ Nueva categoría</button>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "8px 0", fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>
        Plan "Equidad es Progreso" · Toca cualquier tarea para editarla
      </div>
    </div>
  );
};

export default ChoresView;
