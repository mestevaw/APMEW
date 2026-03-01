// ═══════════════════════════════════════════
// Archivo: src/components/Menu.jsx
// Módulo consolidado de menús dropdown
// (antes duplicado en dashboard/MenuComponents y daily/shared)
// ═══════════════════════════════════════════

import { useEffect, useRef } from "react";
import { C } from "../lib/theme";

export const DropMenu = ({ open, onClose, children, style }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} style={{
      position: "absolute", right: 0, top: "100%", marginTop: 6, background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
      minWidth: 220, zIndex: 100, overflow: "hidden", ...style,
    }}>{children}</div>
  );
};

export const MenuBtn = ({ onClick, children, active }) => (
  <button onClick={onClick} style={{
    width: "100%", textAlign: "left", padding: "10px 16px",
    background: active ? C.accentGlow : "transparent", border: "none", cursor: "pointer",
    fontFamily: "DM Sans", fontSize: 13, color: active ? C.accent : C.text,
    display: "flex", alignItems: "center", gap: 8,
  }}
    onMouseEnter={e => e.currentTarget.style.background = C.surface2}
    onMouseLeave={e => e.currentTarget.style.background = active ? C.accentGlow : "transparent"}
  >{children}</button>
);

export const MenuDivider = () => (
  <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
);

export const MenuLabel = ({ children }) => (
  <div style={{ padding: "8px 16px 4px", fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>
);

export const HamburgerBtn = ({ open, onClick }) => (
  <button onClick={onClick} style={{
    background: open ? C.accentGlow : "none", border: `1px solid ${open ? C.accent : C.border}`,
    cursor: "pointer", padding: "8px 10px", borderRadius: 8, color: open ? C.accent : C.text,
    display: "flex", alignItems: "center",
  }}>
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  </button>
);

export const CloseBtn = ({ onClick }) => (
  <button onClick={onClick} style={{
    background: "none", border: "none", cursor: "pointer", color: C.textDim,
    fontSize: 18, padding: "2px 6px", lineHeight: 1,
  }}
    onMouseEnter={e => e.currentTarget.style.color = C.text}
    onMouseLeave={e => e.currentTarget.style.color = C.textDim}
  >✕</button>
);
