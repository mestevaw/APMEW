// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/helpers.js
// ═══════════════════════════════════════════

import { supaFetch } from "../../lib/supabase";
import { DEADLINE_TYPES, DEADLINE_CATEGORIES } from "./constants";

// ─── Re-export shared helpers para que los imports existentes sigan funcionando ───
export { fmtMoney, getFileIcon, getFileExt, isImage, getPreviewUrl, getThumbnailUrl, getDriveMediaUrl } from "../../lib/helpers";

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

// ─── Sorting helpers ───
const getNumber = (addr) => { const m = addr.match(/^(\d+)/); return m ? parseInt(m[1]) : 99999; };
const getStreet = (addr) => addr.replace(/^\d+\s*/, "").trim().toLowerCase();

// ─── Supabase folder lookup ───
const findFolderByAddress = async (address) => {
  console.log("[findFolder] Searching for:", address);
  const numMatch = address.match(/^\d+/);
  if (numMatch) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*PROPERTY*` });
    console.log("[findFolder] Query 1 (num+PROPERTY):", results?.length, "results", results?.map(r => ({ name: r.name, id: r.google_drive_id, path: r.folder_path })));
    if (results && results.length > 0) {
      const words = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: words.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      console.log("[findFolder] Best match:", { name: scored[0].name, id: scored[0].google_drive_id, score: scored[0].score, path: scored[0].folder_path });
      if (scored[0].score >= 1) return scored[0];
    }
  }
  const words = address.split(/[\s,]+/).filter(w => w.length > 3 && !/^\d+$/.test(w));
  for (const word of words) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${word}*&folder_path=ilike.*PROPERTY*` });
    console.log("[findFolder] Query 2 (word:", word, "):", results?.length, "results");
    if (results && results.length > 0) {
      const allWords = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: allWords.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 1) return scored[0];
    }
  }
  if (numMatch) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${numMatch[0]}*` });
    console.log("[findFolder] Query 3 (num only):", results?.length, "results");
    if (results && results.length > 0) {
      const words2 = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
      const scored = results.map(r => ({ ...r, score: words2.filter(w => r.name.toLowerCase().includes(w)).length }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score >= 1) return scored[0];
    }
  }
  console.log("[findFolder] NOT FOUND for:", address);
  return null;
};

export { getDeadlineStatus, fmtDate, getTypeInfo, getCatInfo, getNumber, getStreet, findFolderByAddress };
