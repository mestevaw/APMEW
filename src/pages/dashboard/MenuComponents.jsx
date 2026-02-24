// dashboard/MenuComponents.jsx
import { useEffect, useRef } from "react";
import { C } from "../../lib/theme";

const DropMenu = ({ open, onClose, children, style }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  if (!open) return null;
  return (
    <div ref={menuRef} style={{
      position: "absolute", right: 0, top: "100%", marginTop: 6, background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
      minWidth: 200, zIndex: 100, overflow: "hidden", ...style,
    }}>{children}</div>
  );
};
const MenuBtn = ({ onClick, children, active }) => (
  <button onClick={onClick} style={{
    width: "100%", textAlign: "left", padding: "10px 16px",
    background: active ? C.accentGlow : "transparent", border: "none", cursor: "pointer",
    fontFamily: "DM Sans", fontSize: 13, color: active ? C.accent : C.text, display: "flex", alignItems: "center", gap: 8,
  }}
    onMouseEnter={e => e.currentTarget.style.background = C.surface2}
    onMouseLeave={e => e.currentTarget.style.background = active ? C.accentGlow : "transparent"}
  >{children}</button>
);
const MenuDivider = () => <div style={{ height: 1, background: C.border, margin: "4px 0" }} />;
const MenuLabel = ({ children }) => <div style={{ padding: "8px 16px 4px", fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
const HamburgerBtn = ({ open, onClick }) => (
  <button onClick={onClick} style={{
    background: open ? C.accentGlow : "none", border: `1px solid ${open ? C.accent : C.border}`,
    cursor: "pointer", padding: "8px 10px", borderRadius: 8, color: open ? C.accent : C.text, display: "flex", alignItems: "center",
  }}><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
);


export { DropMenu, MenuBtn, MenuDivider, MenuLabel, HamburgerBtn };
