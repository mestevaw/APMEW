import { SUPABASE_URL, SUPABASE_KEY } from "./config";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const jsonHeaders = { ...headers, "Content-Type": "application/json" };

export const supaFetch = async (table, options = {}) => {
  const { select = "*", order, filters } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (order) url += `&order=${order}`;
  if (filters) url += `&${filters}`;
  const res = await fetch(url, { headers });
  return res.json();
};

export const supaUpdate = async (table, id, data) => {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH", headers: { ...jsonHeaders, Prefer: "return=minimal" }, body: JSON.stringify(data),
  });
};

export const supaInsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...jsonHeaders, Prefer: "return=representation" }, body: JSON.stringify(data),
  });
  return res.json();
};

export const supaDelete = async (table, id) => {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE", headers: { ...headers, Prefer: "return=minimal" },
  });
};

export const supaUpsert = async (table, data) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...jsonHeaders, Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(data),
  });
  return res.json();
};
