// ═══════════════════════════════════════════
// Archivo: src/lib/config.js
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

// ─── Supabase Config ───
export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_KEY;

// ─── Google Drive Config ───
export const GOOGLE_CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const DRIVE_ROOT_FOLDER  = import.meta.env.VITE_DRIVE_ROOT_FOLDER;
export const DRIVE_RESOURCE_KEY = import.meta.env.VITE_DRIVE_RESOURCE_KEY;
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive";

// ─── Validación al arrancar ───
const required = {
  VITE_SUPABASE_URL:      SUPABASE_URL,
  VITE_SUPABASE_KEY:      SUPABASE_KEY,
  VITE_GOOGLE_CLIENT_ID:  GOOGLE_CLIENT_ID,
  VITE_DRIVE_ROOT_FOLDER: DRIVE_ROOT_FOLDER,
  VITE_DRIVE_RESOURCE_KEY: DRIVE_RESOURCE_KEY,
};

const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.error(
    `[config] ⛔ Faltan variables de entorno: ${missing.join(", ")}.\n` +
    `Copia env.example a .env y llena los valores.`
  );
}
