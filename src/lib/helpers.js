// ═══════════════════════════════════════════
// Archivo: src/lib/helpers.js
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";

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
  const dt = new Date(d + "T12:00:00"); // mediodía para evitar problemas de timezone
  const M = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${dt.getDate()} ${M[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}`;
};

// ─── Fecha larga: "22 feb 2026" ───
export const fmtDateLong = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00"); // mediodía para evitar problemas de timezone
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
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

export const isImage = (mime) => mime && mime.includes("image");

// ─── Google Drive URLs ───
export const getPreviewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
export const getThumbnailUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
export const getDriveMediaUrl = (fileId) => `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
