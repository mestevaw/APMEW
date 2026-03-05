// ═══════════════════════════════════════════
// Archivo: src/components/BulkAnaPIndexer.jsx
// Versión: V1 — Proceso único / one-shot
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// Recorre TODAS las propiedades, encuentra el PDF suelto
// en su carpeta GASTOS, lo manda a Claude API para extracción
// y guarda los gastos en property_expenses automáticamente.
//
// Uso: una sola vez. El doc AnaP ya no cambia.
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { supaFetch, supaInsert } from "../lib/supabase";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { DRIVE_ROOT_FOLDER } from "../lib/config";

// ─── Claude API ───────────────────────────────────────────────────────────
const extractExpenses = async (base64Data, address) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } },
          { type: "text", text: `Analiza este documento de gastos de la propiedad "${address}".
Extrae TODOS los gastos y devuelve ÚNICAMENTE JSON válido, sin texto ni backticks.

{
  "expenses": [
    {
      "expense_type": "hoa|insurance|maintenance|utilities|management|mortgage|property_tax|other",
      "amount": 1234.56,
      "period_month": 3,
      "period_year": 2025,
      "notes": "descripción o proveedor",
      "vendor": "nombre del proveedor"
    }
  ]
}

Reglas: amount siempre positivo. period_month 1-12. Si no hay mes/año claro usa null.` },
        ],
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
};

// ─── Download PDF as base64 ───────────────────────────────────────────────
const pdfToBase64 = async (fileId, token) => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
};

// ─── Find loose PDF in GASTOS folder ─────────────────────────────────────
const findAnaPDoc = async (property, drive) => {
  // 1. Supabase first
  const sf = await findFolderByAddress(property.address, property.owner);
  let rootId = sf?.google_drive_id;

  // 2. Drive API fallback
  if (!rootId && drive.searchFolderByAddress) {
    const df = await drive.searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
    rootId = df?.id;
  }
  if (!rootId) return null;

  const gastos = await drive.findSubfolder(rootId, "GASTO");
  if (!gastos) return null;

  const contents = await drive.listAllFiles(gastos.id);
  const pdf = (contents || []).find(f =>
    f.mimeType === "application/pdf" || (f.name || "").toLowerCase().endsWith(".pdf")
  );
  return pdf ? { id: pdf.id, name: pdf.name } : null;
};

// ─── Check if already indexed ─────────────────────────────────────────────
const alreadyIndexed = async (address) => {
  const rows = await supaFetch("property_expenses", {
    filters: `property_address=eq.${encodeURIComponent(address)}&notes=ilike.*AnaP*`,
    limit: 1,
  });
  return (rows || []).length > 0;
};

// ═══════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════
export const BulkAnaPIndexer = ({ drive, onClose }) => {
  const [phase, setPhase]     = useState("confirm"); // confirm → running → done
  const [log, setLog]         = useState([]);
  const [summary, setSummary] = useState(null);
  const logRef = useRef(null);

  const addLog = (msg, color) => {
    setLog(prev => [...prev, { msg, color }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 40);
  };

  const runAll = async () => {
    setPhase("running");
    const active = PROPERTIES.filter(p => !p.sold);
    let found = 0, indexed = 0, skipped = 0, failed = 0;

    for (const prop of active) {
      addLog(`\n🏠 ${prop.address}`);

      // Check if already done
      try {
        if (await alreadyIndexed(prop.address)) {
          addLog(`  ⏭️ Ya indexado — saltando`, C.textDim);
          skipped++;
          continue;
        }
      } catch (e) { /* continue anyway */ }

      // Find PDF
      let pdf = null;
      try {
        pdf = await findAnaPDoc(prop, drive);
      } catch (e) {
        addLog(`  ⚠️ Error buscando carpeta: ${e.message}`, C.orange);
        failed++;
        continue;
      }

      if (!pdf) {
        addLog(`  — Sin Doc AnaP en GASTOS`, C.textDim);
        continue;
      }

      addLog(`  📕 ${pdf.name}`);
      found++;

      // Download & extract
      let expenses = [];
      try {
        addLog(`  📥 Descargando...`);
        const b64 = await pdfToBase64(pdf.id, drive.token);
        addLog(`  🤖 Extrayendo con Claude...`);
        const result = await extractExpenses(b64, prop.address);
        expenses = result.expenses || [];
        addLog(`  ✅ ${expenses.length} gastos extraídos`, C.green);
      } catch (e) {
        addLog(`  ❌ Error extrayendo: ${e.message}`, C.red);
        failed++;
        continue;
      }

      // Save to Supabase
      let saved = 0;
      for (const exp of expenses) {
        if (!exp.amount || Number(exp.amount) <= 0) continue;
        try {
          await supaInsert("property_expenses", {
            property_address: prop.address,
            expense_type:     exp.expense_type || "other",
            amount:           parseFloat(exp.amount) || 0,
            period_month:     exp.period_month || null,
            period_year:      exp.period_year  || null,
            notes:            [exp.vendor, exp.notes, "AnaP"].filter(Boolean).join(" — "),
            paid:             true,
          });
          saved++;
        } catch (e) {
          console.error("Insert failed:", e);
        }
      }

      indexed += saved;
      addLog(`  💾 ${saved} guardados en Supabase`, C.green);

      // Pause to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    }

    addLog(`\n🎉 Proceso completado`, C.green);
    setSummary({ found, indexed, skipped, failed, total: active.length });
    setPhase("done");
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.93)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 20,
    }}>
      <Card style={{ maxWidth: 580, width: "100%", padding: 26 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>
              🤖 Indexar todos los Doc AnaP
            </h2>
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 3 }}>
              Proceso único — extrae proveedores de todas las propiedades
            </div>
          </div>
          {phase !== "running" && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 20 }}>✕</button>
          )}
        </div>

        {/* ── CONFIRM ── */}
        {phase === "confirm" && (
          <div>
            <div style={{
              padding: "14px 16px", marginBottom: 18,
              background: `${C.accent}10`, border: `1px solid ${C.accent}40`,
              borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.text, lineHeight: 1.8,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Qué va a pasar:</div>
              <div style={{ color: C.textDim, fontSize: 12 }}>
                📂 Recorre las <strong style={{ color: C.text }}>{PROPERTIES.filter(p => !p.sold).length} propiedades activas</strong><br/>
                🔍 Busca el PDF suelto en cada carpeta GASTOS<br/>
                🤖 Manda cada PDF a Claude para extraer gastos estructurados<br/>
                💾 Guarda en <strong style={{ color: C.text }}>property_expenses</strong> de Supabase<br/>
                ⏭️ Las propiedades ya indexadas se saltan automáticamente<br/>
                ⏱️ Tarda ~2-3 min dependiendo de cuántos PDFs haya
              </div>
            </div>
            <button
              onClick={runAll}
              style={{
                width: "100%", padding: "13px 0",
                background: C.accent, color: "white",
                border: "none", borderRadius: 8,
                fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              🚀 Iniciar indexación de todos los documentos
            </button>
          </div>
        )}

        {/* ── RUNNING ── */}
        {phase === "running" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Spinner />
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
                Procesando... no cierres esta ventana
              </span>
            </div>
            <div
              ref={logRef}
              style={{
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "12px 14px",
                fontFamily: "monospace", fontSize: 12,
                maxHeight: 380, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              {log.map((entry, i) => (
                <div key={i} style={{ color: entry.color || C.textDim, whiteSpace: "pre-wrap" }}>
                  {entry.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && summary && (
          <div>
            <div style={{
              padding: "14px 16px", marginBottom: 14,
              background: `${C.green}12`, border: `1px solid ${C.green}40`,
              borderRadius: 10, fontFamily: "DM Sans", fontSize: 13,
            }}>
              <div style={{ fontWeight: 700, color: C.green, marginBottom: 8 }}>✅ Completado</div>
              <div>🏠 Propiedades revisadas: <strong>{summary.total}</strong></div>
              <div>📕 PDFs encontrados: <strong>{summary.found}</strong></div>
              <div style={{ color: C.green }}>💾 Gastos guardados: <strong>{summary.indexed}</strong></div>
              {summary.skipped > 0 && <div style={{ color: C.textDim }}>⏭️ Ya indexadas: <strong>{summary.skipped}</strong></div>}
              {summary.failed  > 0 && <div style={{ color: C.red }}>❌ Con error: <strong>{summary.failed}</strong></div>}
            </div>

            {/* Collapsible log */}
            <details style={{ marginBottom: 14 }}>
              <summary style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, cursor: "pointer", marginBottom: 6 }}>
                Ver log completo
              </summary>
              <div
                style={{
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "10px 12px",
                  fontFamily: "monospace", fontSize: 11,
                  maxHeight: 240, overflowY: "auto",
                }}
              >
                {log.map((entry, i) => (
                  <div key={i} style={{ color: entry.color || C.textDim, whiteSpace: "pre-wrap" }}>
                    {entry.msg}
                  </div>
                ))}
              </div>
            </details>

            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "12px 0",
                background: C.green, color: "white",
                border: "none", borderRadius: 8,
                fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        )}

      </Card>
    </div>
  );
};
