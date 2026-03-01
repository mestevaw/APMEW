// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/ChoresView.jsx
// Vista: División de Labores del Hogar
// Fecha: 2026-03-01
// ═══════════════════════════════════════════

import { useState } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { Card, Badge } from "../../components/UI";
import { ChoresIcon } from "./icons";

// ─── Datos del Excel "División de Tareas" ───
const CHORES = [
  { cat: "COCINA Y ALIMENTACIÓN", tasks: [
    { task: "Preparar desayuno",       who: "Miguel", freq: "Diaria",         hrs: 4,   notes: "Mr. Esteva loves da' cookin'" },
    { task: "Preparar comida/cena",    who: "Miguel", freq: "Diaria",         hrs: 4,   notes: "Mr. Esteva loves da' cookin'" },
    { task: "Lavar platos",            who: "Miguel", freq: "Diaria",         hrs: 3,   notes: "Y guardar trastes limpios" },
    { task: "Planificar menú semanal", who: "Miguel", freq: "Semanal",        hrs: 1,   notes: "Hacerlo juntos el domingo" },
    { task: "Compras de supermercado", who: "Miguel", freq: "Semanal",        hrs: 1,   notes: "Incluye guardar todo" },
  ]},
  { cat: "LIMPIEZA GENERAL", tasks: [
    { task: "Barrer / Aspirar pisos",     who: "Miguel", freq: "2-3 veces/sem.", hrs: 2,   notes: "Todas las áreas comunes" },
    { task: "Trapear pisos",              who: "AnaP",   freq: "Semanal",        hrs: 1.5, notes: "Alternar con aspirado" },
    { task: "Limpiar baños",              who: "Ambos",  freq: "Semanal",        hrs: 1.5, notes: "Escusado, lavabo, ducha" },
    { task: "Limpiar cocina a fondo",     who: "Ambos",  freq: "Semanal",        hrs: 1.5, notes: "Electrodomésticos, superficies" },
    { task: "Sacudir y ordenar sala",     who: "AnaP",   freq: "Semanal",        hrs: 1,   notes: "Mantener orden diario" },
    { task: "Limpiar ventanas y espejos", who: "Miguel", freq: "Quincenal",      hrs: 0.5, notes: "Rotar con otras tareas" },
  ]},
  { cat: "LAVANDERÍA Y ROPA", tasks: [
    { task: "Lavar ropa Miguel",  who: "Miguel", freq: "2-3 veces/sem.", hrs: 2   },
    { task: "Lavar ropa AnaP",    who: "AnaP",   freq: "2-3 veces/sem.", hrs: 1.5 },
    { task: "Toallas y sábanas",  who: "AnaP",   freq: "Semanal",        hrs: 1.5 },
  ]},
  { cat: "MANTENIMIENTO DEL HOGAR", tasks: [
    { task: "Sacar basura / Reciclaje",  who: "Miguel", freq: "Diaria",         hrs: 1,   notes: "Separar reciclables" },
    { task: "Reparaciones menores",      who: "Ambos",  freq: "Según necesidad", hrs: 1,   notes: "Focos, filtros, pintura" },
    { task: "Organizar espacios/clósets", who: "AnaP",  freq: "Mensual",         hrs: 0.5, notes: "Donar lo que no se usa" },
    { task: "Cuidado de plantas/jardín", who: "AnaP",   freq: "Semanal",         hrs: 1,   notes: "Regar, podar, mantener" },
    { task: "Cuidado de Rosita",         who: "Miguel", freq: "Diaria",          hrs: 3,   notes: "Alimentar, limpiar, veterinario" },
  ]},
  { cat: "ADMINISTRACIÓN DEL HOGAR", tasks: [
    { task: "Pagar cuentas / Finanzas", who: "Ambos",  freq: "Mensual",         hrs: 0.5, notes: "Presupuesto compartido" },
    { task: "Trámites y gestiones",     who: "AnaP",   freq: "Según necesidad", hrs: 0.5, notes: "Coordinar servicios" },
    { task: "Planificación familiar",   who: "Ambos",  freq: "Semanal",         hrs: 0.5, notes: "Revisar agenda y pendientes" },
  ]},
];

const WHO_COLOR = { Miguel: "#60A5FA", AnaP: "#F472B6", Ambos: "#C8A862" };
const WHO_LABEL = { Miguel: "Miguel", AnaP: "AnaP", Ambos: "Ambos" };

const CAT_EMOJI = {
  "COCINA Y ALIMENTACIÓN": "🍳",
  "LIMPIEZA GENERAL": "🧹",
  "LAVANDERÍA Y ROPA": "👕",
  "MANTENIMIENTO DEL HOGAR": "🔧",
  "ADMINISTRACIÓN DEL HOGAR": "📋",
};

const ChoresView = ({ mob, onBack }) => {
  const [filter, setFilter] = useState("all");

  // ─── Compute summaries ───
  const allTasks = CHORES.flatMap(c => c.tasks);
  const miguelHrs = allTasks.filter(t => t.who === "Miguel").reduce((s, t) => s + t.hrs, 0);
  const anapHrs   = allTasks.filter(t => t.who === "AnaP").reduce((s, t) => s + t.hrs, 0);
  const ambosHrs  = allTasks.filter(t => t.who === "Ambos").reduce((s, t) => s + t.hrs, 0);
  const totalHrs  = miguelHrs + anapHrs + ambosHrs;

  const filtered = filter === "all" ? CHORES : CHORES.map(c => ({
    ...c,
    tasks: c.tasks.filter(t => t.who === filter),
  })).filter(c => c.tasks.length > 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: "#A78BFA" }}><ChoresIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: "#A78BFA", flex: 1 }}>Labores del Hogar</h1>
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
            <div style={{ fontFamily: "JetBrains Mono", fontSize: mob ? 18 : 22, fontWeight: 600, color: s.color }}>{s.hrs}<span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>hrs/sem</span></div>
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
      {filtered.map((cat, ci) => (
        <Card key={ci} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>{CAT_EMOJI[cat.cat] || "📌"}</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>{cat.cat}</span>
            <Badge color={C.textDim}>{cat.tasks.length}</Badge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cat.tasks.map((t, ti) => (
              <div key={ti} style={{
                display: "flex", alignItems: "center", gap: mob ? 8 : 12,
                padding: "8px 12px", background: C.surface2, borderRadius: 8,
                borderLeft: `3px solid ${WHO_COLOR[t.who] || C.border}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.text }}>{t.task}</div>
                  {t.notes && <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 2 }}>{t.notes}</div>}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: mob ? 6 : 10, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "DM Sans", fontSize: 10, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 10,
                    background: (WHO_COLOR[t.who] || C.accent) + "18",
                    color: WHO_COLOR[t.who] || C.accent,
                  }}>{WHO_LABEL[t.who] || t.who}</span>

                  {!mob && (
                    <span style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim, minWidth: 65, textAlign: "right" }}>{t.freq}</span>
                  )}

                  <span style={{
                    fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600,
                    color: C.accent, minWidth: 32, textAlign: "right",
                  }}>{t.hrs}h</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "12px 0", fontFamily: "DM Sans", fontSize: 11, color: C.textMuted }}>
        Plan "Equidad es Progreso" · Horas semanales estimadas
      </div>
    </div>
  );
};

export default ChoresView;
