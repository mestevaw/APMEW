// ═══════════════════════════════════════════
// Archivo: src/lib/supabase.js
// Versión: V3
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - supaFetch: auto-paginación cuando limit>1000 (max_rows server-side de Supabase)
// - supaUpsert: acepta parámetro on_conflict
// CAMBIOS EN V2:
//   - Se añade cliente @supabase/supabase-js para manejar sesiones
//   - Las llamadas REST usan el JWT de la sesión activa (no la clave anon)
//   - Exporta `supabase` para gestión de auth en App.jsx
// ═══════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";

// ─── Cliente oficial (solo para Auth) ───────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Sesión activa: se actualiza automáticamente via onAuthStateChange ───────
// Se usa para inyectar el JWT en todas las llamadas REST manuales.
let _accessToken = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _accessToken = session?.access_token ?? null;
});

// Al cargar el módulo, recupera la sesión persistida (si existe)
supabase.auth.getSession().then(({ data }) => {
  _accessToken = data.session?.access_token ?? null;
});

// ─── Headers: usa JWT cuando hay sesión, anon key como fallback ──────────────
const getHeaders = () => ({
  apikey:        SUPABASE_KEY,
  Authorization: `Bearer ${_accessToken ?? SUPABASE_KEY}`,
});
const getJsonHeaders = () => ({
  ...getHeaders(),
  "Content-Type": "application/json",
});

// ─── Helper: checa errores HTTP ──────────────────────────────────────────────
const checkResponse = async (res, action) => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg  = `Supabase ${action} failed: ${res.status}`;
    console.error(msg, body);
    throw new Error(msg);
  }
  return res;
};

// ─── CRUD helpers (sin cambios en firma, compatible con el código existente) ──

export const supaFetch = async (table, options = {}) => {
  const { select = "*", order, filters, limit } = options;

  // ── Auto-paginación: Supabase tiene max_rows=1000 server-side ──
  // Si se pide más de 1000, hacemos requests de 1000 hasta completar.
  const PAGE = 1000;
  const maxRows = limit || PAGE;

  const fetchPage = async (from, to) => {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (order)   url += `&order=${order}`;
    if (filters) url += `&${filters}`;
    url += `&limit=${PAGE}&offset=${from}`;
    const res = await fetch(url, { headers: getHeaders() });
    await checkResponse(res, `GET ${table}`);
    return res.json();
  };

  if (maxRows <= PAGE) {
    // Request normal de una sola página
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (order)   url += `&order=${order}`;
    if (filters) url += `&${filters}`;
    url += `&limit=${maxRows}`;
    const res = await fetch(url, { headers: getHeaders() });
    await checkResponse(res, `GET ${table}`);
    return res.json();
  }

  // Paginación automática para tablas grandes
  let all = [];
  let offset = 0;
  while (offset < maxRows) {
    const page = await fetchPage(offset, Math.min(offset + PAGE, maxRows) - 1);
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE) break; // última página
    offset += PAGE;
  }
  return all;
};

export const supaUpdate = async (table, id, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...getJsonHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `PATCH ${table}/${id}`);
};

export const supaBatchUpdate = async (table, filters, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    method: "PATCH",
    headers: { ...getJsonHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `BATCH PATCH ${table}`);
};

export const supaInsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...getJsonHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `POST ${table}`);
  return res.json();
};

export const supaBatchInsert = async (table, rows) => {
  if (!rows || rows.length === 0) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...getJsonHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  await checkResponse(res, `BATCH POST ${table} (${rows.length} rows)`);
  return res.json();
};

export const supaDelete = async (table, id) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: { ...getHeaders(), Prefer: "return=minimal" },
  });
  await checkResponse(res, `DELETE ${table}/${id}`);
};

export const supaUpsert = async (table, data, onConflict) => {
  const conflictParam = onConflict ? `?on_conflict=${onConflict}` : "";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${conflictParam}`, {
    method: "POST",
    headers: { ...getJsonHeaders(), Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `UPSERT ${table}`);
  return res.json();
};
