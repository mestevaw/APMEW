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
const findFolderByAddress = async (address, owner) => {
  console.log("[findFolder] Searching for:", address, "owner:", owner);
  const numMatch = address.match(/^\d+/);
  const words = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);

  // ─── Strategy 1: Use owner name to narrow down directly ───
  if (owner && numMatch) {
    const ownerClean = owner.trim().replace(/\s+/g, "*");
    const results = await supaFetch("drive_folders", {
      filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*${ownerClean}*`
    });
    console.log("[findFolder] Owner query:", results?.length, "results", results?.map(r => ({ name: r.name, path: r.folder_path })));
    if (results && results.length > 0) {
      // Score by name match, penalize IRS/Expenses/Tax paths, prefer shortest path
      const scored = results.map(r => {
        const path = (r.folder_path || "").toLowerCase();
        const nameScore = words.filter(w => r.name.toLowerCase().includes(w)).length;
        const isSubfolder = /\b(irs|expense|1099|tax|w-9)\b/.test(path);
        const depth = (r.folder_path || "").split(">").length;
        return { ...r, nameScore, isSubfolder, depth };
      });
      // Non-subfolder first, then higher name score, then shorter path
      scored.sort((a, b) => {
        if (a.isSubfolder !== b.isSubfolder) return a.isSubfolder ? 1 : -1;
        if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
        return a.depth - b.depth;
      });
      console.log("[findFolder] Best match:", { name: scored[0].name, id: scored[0].google_drive_id, path: scored[0].folder_path, isSubfolder: scored[0].isSubfolder });
      if (scored[0].nameScore >= 1) return scored[0];
    }
  }

  // ─── Strategy 2: Fallback without owner (old behavior with penalty system) ───
  if (numMatch) {
    const results = await supaFetch("drive_folders", { filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*PROPERTY*` });
    console.log("[findFolder] Fallback query:", results?.length, "results");
    if (results && results.length > 0) {
      const scored = results.map(r => {
        const path = (r.folder_path || "").toLowerCase();
        const nameScore = words.filter(w => r.name.toLowerCase().includes(w)).length;
        const isSubfolder = /\b(irs|expense|1099|tax|w-9)\b/.test(path);
        const depth = (r.folder_path || "").split(">").length;
        return { ...r, nameScore, isSubfolder, depth };
      });
      scored.sort((a, b) => {
        if (a.isSubfolder !== b.isSubfolder) return a.isSubfolder ? 1 : -1;
        if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
        return a.depth - b.depth;
      });
      if (scored[0].nameScore >= 1) return scored[0];
    }
  }

  console.log("[findFolder] NOT FOUND for:", address);
  return null;
};

export { getDeadlineStatus, fmtDate, getTypeInfo, getCatInfo, getNumber, getStreet, findFolderByAddress };
