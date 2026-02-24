// ─── Supabase Config ───
// Usar variables de entorno: crea un archivo .env en la raíz con:
//   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
//   VITE_SUPABASE_KEY=eyJ...
//   VITE_GOOGLE_CLIENT_ID=190984074535-...
//   VITE_DRIVE_ROOT_FOLDER=xxxxx
//   VITE_DRIVE_RESOURCE_KEY=xxxxx

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ziwkberfwctlvlwejznc.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inppd2tiZXJmd2N0bHZsd2Vqem5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjI1NTEsImV4cCI6MjA4NzA5ODU1MX0.MCALDM7gFOyIVuRQjis2rTP_FIsx-7deRJs-799Hm-8";

// ─── Google Drive Config ───
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "190984074535-01jfm3brrtn17qqeb258klt1mv0qqi0k.apps.googleusercontent.com";
export const DRIVE_ROOT_FOLDER = import.meta.env.VITE_DRIVE_ROOT_FOLDER || "0B9ZOcVkjNKRIYndnQmlFaFJoWjQ";
export const DRIVE_RESOURCE_KEY = import.meta.env.VITE_DRIVE_RESOURCE_KEY || "0-vYqYv5R5_d6msUcjKmoSOw";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive";
