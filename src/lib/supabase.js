// ═══════════════════════════════════════════
// Archivo: src/lib/supabase.js
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { SUPABASE_URL, SUPABASE_KEY } from "./config";

const headers     = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const jsonHeaders = { ...headers, "Content-Type": "application/json" };

// ─── Helper: checa errores HTTP ───
const checkResponse = async (res, action) => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg  = `Supabase ${action} failed: ${res.status}`;
    console.error(msg, body);
    throw new Error(msg);
  }
  return res;
};

export const supaFetch = async (table, options = {}) => {
  const { select = "*", order, filters, limit } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (order)   url += `&order=${order}`;
  if (filters) url += `&${filters}`;
  if (limit)   url += `&limit=${limit}`;
  const res = await fetch(url, { headers });
  await checkResponse(res, `GET ${table}`);
  return res.json();
};

export const supaUpdate = async (table, id, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `PATCH ${table}/${id}`);
};

// ─── Batch update: usa filtros PostgREST ya formateados ───
// NOTA: el llamador debe asegurarse de que `filters` sea seguro.
export const supaBatchUpdate = async (table, filters, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `BATCH PATCH ${table}`);
};

export const supaInsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `POST ${table}`);
  return res.json();
};

// ─── Batch insert: inserta un array de rows de un solo golpe ───
export const supaBatchInsert = async (table, rows) => {
  if (!rows || rows.length === 0) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  await checkResponse(res, `BATCH POST ${table} (${rows.length} rows)`);
  return res.json();
};

export const supaDelete = async (table, id) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  await checkResponse(res, `DELETE ${table}/${id}`);
};

export const supaUpsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(data),
  });
  await checkResponse(res, `UPSERT ${table}`);
  return res.json();
};
