// ═══════════════════════════════════════════
// Archivo: src/lib/config.js
// Versión: 1.0
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

// ─── Supabase Config ───
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// ─── Google Drive Config ───
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const DRIVE_ROOT_FOLDER = import.meta.env.VITE_DRIVE_ROOT_FOLDER;
export const DRIVE_RESOURCE_KEY = import.meta.env.VITE_DRIVE_RESOURCE_KEY;
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive";
