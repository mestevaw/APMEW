// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/CarsView.jsx
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch, supaInsert, supaUpdate, supaDelete } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { CARS } from "./constants";
import { getDeadlineStatus } from "./helpers";
import { CarIcon } from "./icons";
import SupaExplorer from "./SupaExplorer";
import { DeadlinesList } from "./DeadlinesView";

const CarsView = ({ mob, drive, onBack }) => {
  const [selectedCar, setSelectedCar] = useState(null);
  const [deadlines, setDeadlines] = useState([]);

  const loadDeadlines = () => supaFetch("deadlines", { filters: "category=eq.coche" }).then(d => setDeadlines(d || [])).catch(() => {});
  useEffect(() => { loadDeadlines(); }, []);

  const getWorstStatus = (carName) => {
    const carDl = deadlines.filter(d => d.entity_name === carName);
    if (carDl.length === 0) return null;
    let worst = { urgency: -1 };
    for (const dl of carDl) {
      const st = getDeadlineStatus(dl.due_date);
      if (st.urgency > worst.urgency) worst = st;
    }
    return worst.urgency >= 0 ? worst : null;
  };

  if (selectedCar) return <CarDetail car={selectedCar} mob={mob} drive={drive} onBack={() => { setSelectedCar(null); loadDeadlines(); }} />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: C.accent }}><CarIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.accent, flex: 1 }}>Coches</h1>
        <Badge color={C.textDim}>{CARS.length}</Badge>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {CARS.map((car, i) => {
            const status = getWorstStatus(car.name);
            return (
              <button key={i} onClick={() => setSelectedCar(car)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px",
                background: "transparent", border: "none", cursor: "pointer", borderRadius: 8, width: "100%", textAlign: "left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: car.color }}><CarIcon /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 500, color: C.text }}>{car.name}</div>
                  {status && <div style={{ fontFamily: "DM Sans", fontSize: 11, color: status.color, marginTop: 2 }}>{status.urgency >= 2 ? "⚠️ " : ""}{status.label}</div>}
                </div>
                {status && <div style={{ width: 8, height: 8, borderRadius: "50%", background: status.color, flexShrink: 0 }} />}
                <Badge color={car.color}>{car.brand}</Badge>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

const CarDetail = ({ car, mob, drive, onBack }) => {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDocs, setShowDocs] = useState(false);

  const loadDeadlines = async () => {
    setLoading(true);
    const all = await supaFetch("deadlines", { filters: `category=eq.coche&entity_name=eq.${encodeURIComponent(car.name)}` });
    setDeadlines(all || []);
    setLoading(false);
  };
  useEffect(() => { loadDeadlines(); }, [car.name]);

  const handleSave = async (id, data) => {
    if (id) await supaUpdate("deadlines", id, data);
    else await supaInsert("deadlines", { ...data, category: "coche", entity_name: car.name });
    await loadDeadlines();
  };
  const handleDelete = async (id) => { await supaDelete("deadlines", id); await loadDeadlines(); };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: car.color }}><CarIcon /></span>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 22, fontWeight: 700, color: C.text }}>{car.name}</h1>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: car.color }}>{car.brand}</span>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>📅 Vencimientos</div>
        <DeadlinesList deadlines={deadlines} loading={loading} onSave={handleSave} onDelete={handleDelete} mob={mob} filterCategory="coche" filterEntity={car.name} />
      </Card>

      <button onClick={() => setShowDocs(!showDocs)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", marginBottom: 12,
        background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
        cursor: "pointer", width: "100%", fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.accent,
      }}>
        <span>{showDocs ? "▼" : "▶"}</span>
        <span>📂 Documentos en Drive</span>
      </button>
      {/* FIX v1.0: Se agrega drive={drive} — antes no se pasaba y SupaExplorer caía siempre al fallback de Supabase */}
      {showDocs && <SupaExplorer rootFolderId={car.folderId} mob={mob} drive={drive} />}
    </div>
  );
};

export { CarDetail };
export default CarsView;
