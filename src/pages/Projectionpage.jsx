import { C } from "../lib/theme";
import { Card, Badge } from "../components/UI";

export const ChecklistPage = ({ checklist, onToggle, mob }) => {
  const cats = [...new Set(checklist.map(c => c.category))];

  return (
    <div>
      <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.text, marginBottom: 4 }}>Checklist Pre-Retiro</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: mob ? 12 : 14, color: C.textDim, marginBottom: 20 }}>Marca cada tarea conforme la completes</p>

      {cats.map((cat, ci) => {
        const items = checklist.filter(c => c.category === cat);
        const done = items.filter(c => c.is_completed).length;
        return (
          <Card key={cat} delay={ci * .08} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.accent }}>{cat}</span>
              <Badge color={done === items.length ? C.green : C.textDim}>{done}/{items.length}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(item => (
                <button key={item.id} onClick={() => onToggle(item)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: mob ? "10px 12px" : "10px 14px",
                  background: item.is_completed ? C.greenDim : C.surface2,
                  border: `1px solid ${item.is_completed ? C.green + "30" : C.border}`,
                  borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${item.is_completed ? C.green : C.borderLight}`,
                    background: item.is_completed ? C.green : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.is_completed && <svg width="12" height="12" fill="none" stroke={C.bg} strokeWidth="3" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>}
                  </div>
                  <span style={{
                    fontFamily: "DM Sans", fontSize: mob ? 13 : 14,
                    color: item.is_completed ? C.textDim : C.text,
                    textDecoration: item.is_completed ? "line-through" : "none",
                  }}>{item.action}</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
