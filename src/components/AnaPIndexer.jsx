// ═══════════════════════════════════════════
// Archivo: src/components/AnaPIndexer.jsx
// Versión: V1
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// Lee el PDF "Doc AnaP" de cada propiedad desde Drive,
// lo manda a Claude API para extracción estructurada de gastos,
// y guarda los resultados en la tabla property_expenses de Supabase.
//
// Uso: llamar desde GastosPanel cuando hay un anaPDoc disponible.
// ═══════════════════════════════════════════

import { useState } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { supaFetch, supaInsert, supaUpsert } from "../lib/supabase";
import { PROPERTIES } from "../pages/dashboard/constants";

// ─── Claude API call ──────────────────────────────────────────────────────
const extractExpensesFromPDF = async (base64Data) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Data },
          },
          {
            type: "text",
            text: `Analiza este documento de gastos de una propiedad inmobiliaria.
Extrae TODOS los gastos que encuentres y devuelve ÚNICAMENTE un JSON válido, sin texto adicional, sin backticks.

Formato exacto:
{
  "property_address": "dirección detectada o null",
  "document_title": "título o nombre del documento",
  "expenses": [
    {
      "expense_type": "tipo (hoa|insurance|maintenance|utilities|management|mortgage|property_tax|other)",
      "amount": 1234.56,
      "period_month": 3,
      "period_year": 2025,
      "notes": "descripción o proveedor",
      "vendor": "nombre del proveedor si existe"
    }
  ]
}

Reglas:
- expense_type debe ser uno de los valores listados
- amount siempre número positivo
- period_month 1-12, period_year 4 dígitos
- Si no hay mes/año claro, usa null
- notes: descripción breve del gasto`,
          },
        ],
      }],
    }),
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  // Strip markdown fences if present
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};

// ─── Download PDF from Drive as base64 ───────────────────────────────────
const downloadPDFAsBase64 = async (fileId, token) => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// ═══════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════
export const AnaPIndexer = ({ fileId, property, drive, onClose, onDone }) => {
  const [step, setStep]       = useState("preview"); // preview → reading → reviewing → saving → done
  const [log, setLog]         = useState([]);
  const [extracted, setExtracted] = useState(null);
  const [editedExp, setEditedExp] = useState([]);
  const [saving, setSaving]   = useState(false);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  // ── Step 1: Leer PDF y extraer con Claude ─────────────────────────────
  const handleExtract = async () => {
    setStep("reading");
    setLog([]);
    try {
      addLog("📥 Descargando PDF de Drive...");
      const base64 = await downloadPDFAsBase64(fileId, drive.token);

      addLog("🤖 Enviando a Claude para extracción...");
      const result = await extractExpensesFromPDF(base64);

      addLog(`✅ Extraídos ${result.expenses?.length || 0} gastos`);
      setExtracted(result);
      setEditedExp(result.expenses || []);
      setStep("reviewing");
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
      setStep("error");
    }
  };

  // ── Step 2: Guardar en Supabase ───────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setStep("saving");
    let saved = 0, failed = 0;

    for (const exp of editedExp) {
      if (!exp.amount || exp.amount <= 0) continue;
      try {
        await supaInsert("property_expenses", {
          property_address: property.address,
          expense_type:     exp.expense_type || "other",
          amount:           parseFloat(exp.amount) || 0,
          period_month:     exp.period_month || null,
          period_year:      exp.period_year  || null,
          notes:            [exp.vendor, exp.notes].filter(Boolean).join(" — ") || null,
          paid:             true,
          source_doc:       "AnaP",
        });
        saved++;
      } catch (err) {
        console.error("Insert failed:", err);
        failed++;
      }
    }

    addLog(`\n✅ Guardados: ${saved}${failed ? ` | ❌ Fallidos: ${failed}` : ""}`);
    setSaving(false);
    setStep("done");
    if (onDone) onDone(saved);
  };

  const updateExp = (idx, patch) =>
    setEditedExp(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));

  const removeExp = (idx) =>
    setEditedExp(prev => prev.filter((_, i) => i !== idx));

  const TYPES = ["hoa","insurance","maintenance","utilities","management","mortgage","property_tax","other"];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }}>
      <Card style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>
              📕 Indexar Doc AnaP
            </h2>
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 2 }}>
              {property.address}
            </div>
          </div>
          {step !== "reading" && step !== "saving" && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 20 }}>✕</button>
          )}
        </div>

        {/* ── PREVIEW ── */}
        {step === "preview" && (
          <div>
            <div style={{
              padding: "14px 16px", marginBottom: 18,
              background: `${C.accent}10`, border: `1px solid ${C.accent}40`,
              borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.text, lineHeight: 1.7,
            }}>
              <p style={{ margin: "0 0 8px" }}>
                Claude va a leer el PDF y extraer los gastos automáticamente.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.textDim }}>
                • Podrás revisar y editar cada fila antes de guardar<br/>
                • Los gastos se guardan en <strong style={{ color: C.text }}>property_expenses</strong><br/>
                • Si ya existen registros del mismo período, se agregarán como nuevas entradas
              </p>
            </div>
            <button
              onClick={handleExtract}
              style={{
                width: "100%", padding: "12px 0",
                background: C.accent, color: "white",
                border: "none", borderRadius: 8,
                fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              🤖 Leer y Extraer con Claude
            </button>
          </div>
        )}

        {/* ── READING ── */}
        {step === "reading" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Spinner />
            <div style={{ marginTop: 16, fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {step === "reviewing" && extracted && (
          <div>
            <div style={{
              padding: "8px 12px", marginBottom: 14,
              background: `${C.green}12`, border: `1px solid ${C.green}40`,
              borderRadius: 8, fontFamily: "DM Sans", fontSize: 12, color: C.green,
            }}>
              ✅ {editedExp.length} gastos extraídos — revisa y edita antes de guardar
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 380, overflowY: "auto" }}>
              {editedExp.map((exp, idx) => (
                <div key={idx} style={{
                  padding: "10px 12px",
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start",
                }}>
                  {/* Type */}
                  <select
                    value={exp.expense_type || "other"}
                    onChange={e => updateExp(idx, { expense_type: e.target.value })}
                    style={{ padding: "4px 6px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "DM Sans", fontSize: 11 }}
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* Amount */}
                  <input
                    type="number"
                    value={exp.amount || ""}
                    onChange={e => updateExp(idx, { amount: e.target.value })}
                    placeholder="$"
                    style={{ width: 80, padding: "4px 6px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.green, fontFamily: "JetBrains Mono", fontSize: 12 }}
                  />

                  {/* Month/Year */}
                  <input
                    type="number"
                    value={exp.period_month || ""}
                    onChange={e => updateExp(idx, { period_month: parseInt(e.target.value) })}
                    placeholder="Mes"
                    min={1} max={12}
                    style={{ width: 46, padding: "4px 6px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "DM Sans", fontSize: 11 }}
                  />
                  <input
                    type="number"
                    value={exp.period_year || ""}
                    onChange={e => updateExp(idx, { period_year: parseInt(e.target.value) })}
                    placeholder="Año"
                    style={{ width: 58, padding: "4px 6px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "DM Sans", fontSize: 11 }}
                  />

                  {/* Notes */}
                  <input
                    type="text"
                    value={exp.notes || exp.vendor || ""}
                    onChange={e => updateExp(idx, { notes: e.target.value })}
                    placeholder="Proveedor / nota"
                    style={{ flex: 1, padding: "4px 6px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textDim, fontFamily: "DM Sans", fontSize: 11 }}
                  />

                  {/* Delete */}
                  <button
                    onClick={() => removeExp(idx)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 14, padding: "2px 4px" }}
                  >✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.textDim, fontFamily: "DM Sans", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={editedExp.length === 0}
                style={{ flex: 2, padding: "10px 0", background: C.green, color: "white", border: "none", borderRadius: 8, fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                💾 Guardar {editedExp.length} gastos en Supabase
              </button>
            </div>
          </div>
        )}

        {/* ── SAVING ── */}
        {step === "saving" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <Spinner />
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
              Guardando en Supabase...
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div>
            <div style={{ padding: "14px 16px", background: `${C.green}12`, border: `1px solid ${C.green}40`, borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.green, marginBottom: 16 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button
              onClick={onClose}
              style={{ width: "100%", padding: "12px 0", background: C.green, color: "white", border: "none", borderRadius: 8, fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Cerrar
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div>
            <div style={{ padding: "14px 16px", background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.red, marginBottom: 16 }}>
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "10px 0", background: C.red, color: "white", border: "none", borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
        )}

      </Card>
    </div>
  );
};
