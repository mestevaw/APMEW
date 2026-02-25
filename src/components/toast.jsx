// ═══════════════════════════════════════════
// Archivo: src/components/Toast.jsx
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ─── Context ───
const ToastCtx = createContext();

export const useToast = () => useContext(ToastCtx);

// ─── Provider: envuelve la app para dar acceso global ───
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "error", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    error:   (msg, ms) => addToast(msg, "error", ms),
    success: (msg, ms) => addToast(msg, "success", ms),
    info:    (msg, ms) => addToast(msg, "info", ms),
    warn:    (msg, ms) => addToast(msg, "warn", ms),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastCtx.Provider>
  );
};

// ─── Contenedor fijo abajo-derecha ───
const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: "fixed", bottom: 20, right: 20, zIndex: 99999,
    display: "flex", flexDirection: "column-reverse", gap: 8,
    pointerEvents: "none", maxWidth: 380,
  }}>
    {toasts.map(t => (
      <ToastItem key={t.id} toast={t} onRemove={onRemove} />
    ))}
  </div>
);

// ─── Colores por tipo ───
const STYLES = {
  error:   { bg: "#2D1418", border: "#F8717180", icon: "✕", color: "#F87171" },
  success: { bg: "#0F291A", border: "#4ADE8080", icon: "✓", color: "#4ADE80" },
  info:    { bg: "#0F1D2D", border: "#60A5FA80", icon: "ℹ", color: "#60A5FA" },
  warn:    { bg: "#2D2510", border: "#FBBF2480", icon: "⚠", color: "#FBBF24" },
};

// ─── Toast individual con auto-dismiss ───
const ToastItem = ({ toast, onRemove }) => {
  const [exiting, setExiting] = useState(false);
  const s = STYLES[toast.type] || STYLES.info;

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), toast.duration - 300);
    const remove = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => { clearTimeout(timer); clearTimeout(remove); };
  }, [toast, onRemove]);

  return (
    <div style={{
      pointerEvents: "auto",
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "flex-start", gap: 10,
      fontFamily: "DM Sans", fontSize: 13, color: "#E8E4DC",
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
      animation: exiting
        ? "toastOut 0.3s ease forwards"
        : "toastIn 0.3s ease both",
      cursor: "pointer",
      lineHeight: 1.5,
    }}
      onClick={() => onRemove(toast.id)}
    >
      <span style={{ color: s.color, fontSize: 15, fontWeight: 700, lineHeight: 1.4, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>
  );
};
