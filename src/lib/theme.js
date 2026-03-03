// ═══════════════════════════════════════════
// Archivo: src/lib/theme.js
// Versión: 2
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

export const C = {
  bg: "#0C0F14", surface: "#151920", surface2: "#1C2230",
  border: "#2A3040", borderLight: "#353D50",
  accent: "#C8A862", accentDim: "#A08840", accentGlow: "rgba(200,168,98,0.12)",
  green: "#4ADE80", greenDim: "rgba(74,222,128,0.15)",
  red: "#F87171", redDim: "rgba(248,113,113,0.15)",
  blue: "#60A5FA", blueDim: "rgba(96,165,250,0.15)",
  orange: "#F97316", orangeDim: "rgba(249,115,22,0.15)", // ✅ Agregado para Maud Watson
  text: "#E8E4DC", textDim: "#8A8A8A", textMuted: "#5A5A5A", white: "#FFF",
};

export const baseStyles = `
  :root {
    --bg: ${C.bg}; --surface: ${C.surface}; --surface2: ${C.surface2};
    --border: ${C.border}; --border-light: ${C.borderLight};
    --accent: ${C.accent}; --accent-dim: ${C.accentDim}; --accent-glow: ${C.accentGlow};
    --green: ${C.green}; --red: ${C.red}; --blue: ${C.blue};
    --text: ${C.text}; --text-dim: ${C.textDim}; --text-muted: ${C.textMuted};
    --font: "DM Sans", sans-serif;
    --mono: "JetBrains Mono", monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); overflow-x: hidden; font-family: var(--font); color: var(--text); }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse   { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
  @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes toastIn { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(60px); } }
`;

export const inputStyle = {
  background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "10px 14px", color: C.text,
  fontFamily: "DM Sans", fontSize: 14, width: "100%", outline: "none",
};
