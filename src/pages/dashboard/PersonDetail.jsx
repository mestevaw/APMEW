// dashboard/PersonDetail.jsx
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
    <SupaExplorer rootFolderId={person.folderId} mob={mob} />
  </div>
);

// ═══════════════════════════════════════════

export default PersonDetail;
