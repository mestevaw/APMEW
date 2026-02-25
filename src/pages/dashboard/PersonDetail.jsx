// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PersonDetail.jsx
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { Card } from "../../components/UI";
import SupaExplorer from "./SupaExplorer";

const PersonDetail = ({ person, mob, drive, onBack }) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
      {person.img && <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", border: `2px solid ${C.accent}60`, flexShrink: 0 }}><img src={person.img} alt={person.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.accent }}>{person.name}</h1>
    </div>
    {/* FIX v1.0: Se agrega drive={drive} — antes no se pasaba y SupaExplorer caía siempre al fallback de Supabase */}
    <SupaExplorer rootFolderId={person.folderId} mob={mob} drive={drive} />
  </div>
);

export default PersonDetail;
