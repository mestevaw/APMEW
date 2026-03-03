// ═══════════════════════════════════════════
// Archivo: src/lib/helpers.js
// Versión: V2
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - Bug fix en detectCountry: ahora respeta cualquier país asignado,
//   no solo US/MX. Antes convertía CA, JP, etc. incorrectamente a "US".
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";

// ─── Constantes compartidas ───
export const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// ─── Formato moneda MXN (sin centavos) ───
export const fmt = (n, d = 0) => {
  if (n == null || isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(n);
};

// ─── Formato moneda USD/general (con centavos): $1,234.56 ───
export const fmtMoney = (n) => {
  if (n == null) return "—";
  return "$" + Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Porcentaje ───
export const pct = (n) => `${(n * 100).toFixed(1)}%`;

// ─── Fecha corta: "22 feb 26" ───
export const fmtDateShort = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_ES[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
};

// ─── Fecha larga: "22 feb 2026" ───
export const fmtDateLong = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

// ─── Nombre de hoy: "25 feb 26" (para carpetas Drive) ───
export const todayFolderName = () => {
  const d = new Date();
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

// ─── Mobile hook ───
export const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};

// ─── MIME helpers (compartidos: DocumentsPage + Dashboard) ───
export const isFolder = (f) => f.mimeType === "application/vnd.google-apps.folder";

export const isPersonalProperty = (addr) =>
  addr.includes("Progreso") || addr.includes("Argo");

export const isImage = (mime) => mime && mime.includes("image");

export const getFileIcon = (mime) => {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("document") || mime.includes("word")) return "📝";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("video")) return "🎥";
  if (mime.includes("audio")) return "🎵";
  return "📄";
};

export const getFileExt = (mime) => {
  if (!mime) return "";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("sheet")) return "sheets";
  if (mime.includes("excel")) return "xlsx";
  if (mime.includes("document")) return "doc";
  if (mime.includes("word")) return "docx";
  if (mime.includes("presentation")) return "slides";
  if (mime.includes("image")) return "img";
  return "";
};

// ─── Google Drive URLs ───
export const getPreviewUrl   = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
export const getThumbnailUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
export const getDriveMediaUrl = (fileId) => `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

// ─── Detección de país (centralizado — antes estaba solo en DailyExpensesPage) ───
const MX_TAGS     = ["Progreso - Luz", "Progreso - Agua", "Progreso - Mant."];
const MX_CONCEPTS = ["predial", "telmex", "cfe ", "izzi", "oxxo", "walmart mx", "soriana", "coppel", "liverpool"];

export const detectCountry = (row) => {
  // ✅ FIX V2: Si ya tiene país asignado, respetarlo (sin importar cuál sea)
  // Antes tenía un bug que convertía países como CA, JP, etc. a "US"
  if (row.country) return row.country;
  
  // Solo si NO tiene país, hacer detección automática basada en tags/conceptos
  if (row.tag && MX_TAGS.includes(row.tag)) return "MX";
  const c = (row.concept || "").toLowerCase();
  if (MX_CONCEPTS.some(w => c.includes(w))) return "MX";
  if (row.source === "Efectivo" && row.tag && row.tag.includes("Progreso")) return "MX";
  return "US"; // Default para gastos sin clasificación específica
};
