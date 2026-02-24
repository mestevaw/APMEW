// dashboard/helpers.js
import { supaFetch } from "../../lib/supabase";
import { DEADLINE_TYPES, DEADLINE_CATEGORIES } from "./constants";

const getDeadlineStatus = (dateStr) => {
  if (!dateStr) return { color: "#6B7280", label: "Sin fecha", urgency: 0 };
  const now = new Date();
  const due = new Date(dateStr + "T00:00:00");
  const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return { color: "#EF4444", label: `Venció hace ${Math.abs(days)}d`, urgency: 3 };
  if (days <= 30) return { color: "#F59E0B", label: `${days}d restantes`, urgency: 2 };
  if (days <= 90) return { color: "#22C55E", label: `${days}d restantes`, urgency: 1 };
  return { color: "#22C55E", label: `${days}d restantes`, urgency: 0 };
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};


const getTypeInfo = (key) => DEADLINE_TYPES.find(t => t.key === key) || DEADLINE_TYPES[DEADLINE_TYPES.length - 1];
const getCatInfo = (key) => DEADLINE_CATEGORIES.find(c => c.key === key) || DEADLINE_CATEGORIES[0];


const fmtMoney = (n) => {
  if (n == null) return "—";
  return "$" + Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Sorting helpers ───
const getNumber = (addr) => { const m = addr.match(/^(\d+)/); return m ? parseInt(m[1]) : 99999; };
const getStreet = (addr) => addr.replace(/^\d+\s*/, "").trim().toLowerCase();


// ─── File helpers ───
const getFileIcon = (mime) => {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("document") || mime.includes("word")) return "📝";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("video")) return "🎥";
  return "📄";
};
const getFileExt = (mime) => {
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
const isImage = (mime) => mime && mime.includes("image");
const getPreviewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/preview`;
const getThumbnailUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
const getDriveMediaUrl = (fileId) => `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;


// ─── Supabase folder lookup ───
const findFolderByAddress = async (address) => {
  // Strategy 1: Search by street number
  const numMatch = address.match(/^\d+/);
  if (numMatch) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*PROPERTY*` });
    if (results && results.length > 0) {
      const words = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: words.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 1) return scored[0];
    }
  }
  // Strategy 2: Search by street name (for addresses like "Ave Progreso 15")
  const words = address.split(/[\s,]+/).filter(w => w.length > 3 && !/^\d+$/.test(w));
  for (const word of words) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${word}*&folder_path=ilike.*PROPERTY*` });
    if (results && results.length > 0) {
      const allWords = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: allWords.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 1) return scored[0];
    }
  }
  // Strategy 3: Search without PROPERTY filter (maybe in a different path)
  if (numMatch) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${numMatch[0]}*` });
    if (results && results.length > 0) {
      const words2 = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: words2.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 1) return scored[0];
    }
  }
  return null;
};

// ─── Arrow icons ───

export { getDeadlineStatus, fmtDate, getTypeInfo, getCatInfo, fmtMoney, getNumber, getStreet, getFileIcon, getFileExt, isImage, getPreviewUrl, getThumbnailUrl, getDriveMediaUrl, findFolderByAddress };
