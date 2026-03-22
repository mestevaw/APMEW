// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/helpers.js
// Versión: V3
// Fecha: 2026-03-17
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - findFolderByAddress acepta drive como 3er parámetro opcional
//   Orden de búsqueda:
//     1. PROPERTY_FOLDER_IDS — hardcodeado, O(1), sin red (cubre Progreso 15)
//     2. Supabase drive_folders — si hay registros indexados
//     3. Drive en vivo — si drive está conectado, busca dentro de la carpeta
//        del owner (OWNER_DRIVE_FOLDERS) listando sus hijos y matcheando
//        por número de calle. No requiere IDs individuales hardcodeados.
// ═══════════════════════════════════════════

import { supaFetch } from "../../lib/supabase";
import { DEADLINE_TYPES, DEADLINE_CATEGORIES, PROPERTY_FOLDER_IDS, OWNER_DRIVE_FOLDERS } from "./constants";

// ─── Re-export shared helpers ────────────────────────────────────────────────
export {
  fmtMoney, getFileIcon, getFileExt, isImage, isFolder,
  isPersonalProperty, getPreviewUrl, getThumbnailUrl, getDriveMediaUrl,
  fmtDateLong as fmtDate,
} from "../../lib/helpers";

// ─── Deadline status ─────────────────────────────────────────────────────────
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

// ─── Sorting helpers ─────────────────────────────────────────────────────────
export const getNumber = (addr) => { const m = addr.match(/^(\d+)/); return m ? parseInt(m[1]) : 99999; };
export const getStreet = (addr) => addr.replace(/^\d+\s*/, "").trim().toLowerCase();

// ─── Drive live search helper ─────────────────────────────────────────────────
// Busca la carpeta de una propiedad dentro de la carpeta del owner en Drive.
// Usa el número de calle como clave de búsqueda — match parcial y tolerante.
const findInDrive = async (address, owner, drive) => {
  if (!drive?.token) return null;
  const ownerFolderId = OWNER_DRIVE_FOLDERS[owner]?.drive_folder_id;
  if (!ownerFolderId) return null;

  const numMatch = address.match(/^\d+/);
  if (!numMatch) return null;
  const num = numMatch[0];

  try {
    console.log("[findFolder] Drive live search in owner folder:", ownerFolderId);
    const items = await drive.listAllFiles(ownerFolderId);
    const candidates = (items || []).filter(f =>
      f.mimeType === "application/vnd.google-apps.folder" &&
      f.name.includes(num)
    );
    if (candidates.length === 0) return null;

    // Si hay uno solo, ese es
    if (candidates.length === 1) {
      console.log("[findFolder] Drive found:", candidates[0].name);
      return { google_drive_id: candidates[0].id, name: candidates[0].name };
    }

    // Desempate: más tokens de la dirección coinciden
    const words = address.toLowerCase().replace(/^\d+\s*/, "").split(/\s+/);
    let best = candidates[0], bestScore = 0;
    for (const c of candidates) {
      const score = words.filter(w => c.name.toLowerCase().includes(w)).length;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    console.log("[findFolder] Drive best match:", best.name);
    return { google_drive_id: best.id, name: best.name };
  } catch (e) {
    console.error("[findFolder] Drive live search error:", e.message);
    return null;
  }
};

// ─── findFolderByAddress — punto de entrada principal ────────────────────────
// Parámetros:
//   address — dirección completa de la propiedad
//   owner   — nombre del owner ("Mango Nest", "Tortuga Home", etc.)
//   drive   — objeto drive de useGoogleDrive (opcional)
export const findFolderByAddress = async (address, owner, drive = null) => {
  console.log("[findFolder]", address, "| owner:", owner);

  // ── 1. Lookup directo hardcodeado (Progreso 15, etc.) ──────────────────
  if (PROPERTY_FOLDER_IDS[address]) {
    console.log("[findFolder] Hit en PROPERTY_FOLDER_IDS");
    return PROPERTY_FOLDER_IDS[address];
  }

  // ── 2. Supabase drive_folders ───────────────────────────────────────────
  const numMatch = address.match(/^\d+/);
  const words    = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);

  if (owner && numMatch) {
    try {
      const ownerClean = owner.trim().replace(/\s+/g, "*");
      const results = await supaFetch("drive_folders", {
        filters: `name=ilike.*${numMatch[0]}*&folder_path=ilike.*${ownerClean}*`,
      });
      if (results?.length > 0) {
        const best = scoreAndSort(results, words);
        if (best.nameScore >= 1) {
          console.log("[findFolder] Supabase hit:", best.name);
          return best;
        }
      }
    } catch (e) { /* Supabase no disponible — continúa */ }
  }

  // ── 3. Drive en vivo (si conectado) ────────────────────────────────────
  const driveResult = await findInDrive(address, owner, drive);
  if (driveResult) return driveResult;

  console.log("[findFolder] NOT FOUND:", address);
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
