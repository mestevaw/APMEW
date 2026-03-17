// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/helpers.js
// Versión: V2
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - findFolderByAddress: consulta PROPERTY_FOLDER_IDS primero (O(1), sin red)
//   antes de ir a Supabase — arregla propiedades fuera de PROPERTY MANAGEMENT
//   como "Ave Progreso 15, Depto C101" que nunca estaban en drive_folders
// ═══════════════════════════════════════════

import { supaFetch } from "../../lib/supabase";
import { DEADLINE_TYPES, DEADLINE_CATEGORIES, PROPERTY_FOLDER_IDS } from "./constants";

// ─── Re-export shared helpers (fuente canónica: lib/helpers.js) ───
export {
  fmtMoney, getFileIcon, getFileExt, isImage, isFolder,
  isPersonalProperty, getPreviewUrl, getThumbnailUrl, getDriveMediaUrl,
  fmtDateLong as fmtDate,
} from "../../lib/helpers";

// ─── Deadline status ───
export const getDeadlineStatus = (dateStr) => {
  if (!dateStr) return { color: "#6B7280", label: "Sin fecha", urgency: 0 };
  const now  = new Date();
  const due  = new Date(dateStr + "T00:00:00");
  const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (days < 0)   return { color: "#EF4444", label: `Venció hace ${Math.abs(days)}d`, urgency: 3 };
  if (days <= 30)  return { color: "#F59E0B", label: `${days}d restantes`, urgency: 2 };
  if (days <= 90)  return { color: "#22C55E", label: `${days}d restantes`, urgency: 1 };
  return { color: "#22C55E", label: `${days}d restantes`, urgency: 0 };
};

export const getTypeInfo = (key) => DEADLINE_TYPES.find(t => t.key === key) || DEADLINE_TYPES[DEADLINE_TYPES.length - 1];
export const getCatInfo  = (key) => DEADLINE_CATEGORIES.find(c => c.key === key) || DEADLINE_CATEGORIES[0];

// ─── Sorting helpers ───
export const getNumber = (addr) => { const m = addr.match(/^(\d+)/); return m ? parseInt(m[1]) : 99999; };
export const getStreet = (addr) => addr.replace(/^\d+\s*/, "").trim().toLowerCase();

// ─── Folder lookup principal ──────────────────────────────────────────────────
// Orden de búsqueda:
//   1. PROPERTY_FOLDER_IDS (constante en código) — O(1), sin red
//      Cubre propiedades fuera de PROPERTY MANAGEMENT (ej. Progreso 15)
//   2. Supabase drive_folders — para todas las propiedades en PROPERTY MANAGEMENT
export const findFolderByAddress = async (address, owner) => {
  console.log("[findFolder] Searching for:", address, "owner:", owner);

  // ── Step 1: lookup directo en PROPERTY_FOLDER_IDS ──
  if (PROPERTY_FOLDER_IDS[address]) {
    console.log("[findFolder] Hit en PROPERTY_FOLDER_IDS:", address);
    return PROPERTY_FOLDER_IDS[address];
  }

  // ── Step 2: Supabase drive_folders ──
  const numMatch = address.match(/^\d+/);
  const words    = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);

  if (owner && numMatch) {
    const ownerClean = owner.trim().replace(/\s+/g, "*");
    const results = await supaFetch("drive_folders", {
      filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*${ownerClean}*`,
    });
    console.log("[findFolder] Owner query:", results?.length, "results");
    if (results?.length > 0) {
      const best = scoreAndSort(results, words);
      if (best.nameScore >= 1) return best;
    }
  }

  if (numMatch) {
    const results = await supaFetch("drive_folders", {
      filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*PROPERTY*`,
    });
    console.log("[findFolder] Fallback query:", results?.length, "results");
    if (results?.length > 0) {
      const best = scoreAndSort(results, words);
      if (best.nameScore >= 1) return best;
    }
  }

  console.log("[findFolder] NOT FOUND for:", address);
  return null;
};

function scoreAndSort(results, words) {
  const scored = results.map(r => {
    const nameScore   = words.filter(w => r.name.toLowerCase().includes(w)).length;
    const isSubfolder = /\b(irs|expense|1099|tax|w-9)\b/.test((r.folder_path || "").toLowerCase());
    const depth       = (r.folder_path || "").split(">").length;
    return { ...r, nameScore, isSubfolder, depth };
  });
  scored.sort((a, b) => {
    if (a.isSubfolder !== b.isSubfolder) return a.isSubfolder ? 1 : -1;
    if (a.nameScore   !== b.nameScore)   return b.nameScore - a.nameScore;
    return a.depth - b.depth;
  });
  return scored[0];
}
