// ═══════════════════════════════════════════
// Archivo: src/components/CorrespondenciaUpload.jsx
// Versión: V5
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V5:
// - DUPLICADO FIX: eliminada definición local de MONTHS_ES;
//   ahora se importa desde lib/helpers (fuente canónica)
// CAMBIOS EN V4 (desde V3):
// - Nomenclatura corregida: [remitente] [tipo] Cta [fecha carta] [domicilio] [fecha guardado]
//   Ejemplo: HOA NEC Aviso Cortesía Cta 25 feb 26 6515 Hazy Glen 6 mar 26.pdf
// - Eliminada dirección duplicada (ya no se usa suggestedName que la incluía)
// ═══════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { MONTHS_ES } from "../lib/helpers";   // ← FIX V5: importado, no redefinido

// ─── Helpers ───────────────────────────────────────────────────────────────

// Formatea fecha como "6 mar 26"
const fmtShortDate = (date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

// Limpia string para usarlo en nombre de archivo
const safeStr = (s, maxLen = 40) =>
  (s || "").replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-]/g, "").trim().slice(0, maxLen);

// Detecta si un nombre de carpeta es un año (4 dígitos 2000-2099)
const isYearFolder = (name) => /^20\d{2}$/.test(name?.trim());

const Btn = ({ onClick, disabled, color, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "10px 18px",
    background: disabled ? C.border : (color || C.accent),
    color: disabled ? C.textDim : "white",
    border: "none", borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
    ...style,
  }}>{children}</button>
);

const InfoBox = ({ color, children, style = {} }) => (
  <div style={{
    padding: "12px 14px",
    background: `${color || C.accent}12`,
    border: `1px solid ${color || C.accent}40`,
    borderRadius: 10, fontFamily: "DM Sans", fontSize: 13,
    color: C.text, lineHeight: 1.6, marginBottom: 14,
    ...style,
  }}>{children}</div>
);

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Error leyendo archivo"));
    r.readAsDataURL(file);
  });

const matchAddress = (detectedAddress) => {
  if (!detectedAddress) return null;
  const normalized = detectedAddress.toLowerCase();
  const numMatch = detectedAddress.match(/\d+/);
  if (!numMatch) return null;
  const num = numMatch[0];
  const activeProps = PROPERTIES.filter(p => !p.sold);
  return activeProps.find(p => {
    const pNorm = p.address.toLowerCase();
    if (!pNorm.includes(num)) return false;
    const words = normalized.split(/[\s,]+/).filter(w => w.length >= 4);
    return words.some(w => pNorm.includes(w));
  }) || null;
};

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export const CorrespondenciaUpload = ({ drive, folderId: propFolderId, property: propProperty, onClose, onComplete, mob }) => {

  const [step, setStep]                         = useState("select");
  const [dragOver, setDragOver]                 = useState(false);
  const [pdfFile, setPdfFile]                   = useState(null);
  const [error, setError]                       = useState("");
  const [docMeta, setDocMeta]                   = useState(null);
  const [resolvedFolderId, setResolvedFolderId] = useState(propFolderId || null);
  const [resolvedProperty, setResolvedProperty] = useState(propProperty || null);

  const [subfolders, setSubfolders]             = useState([]);
  const [loadingFolders, setLoadingFolders]     = useState(false);
  const [selectedFolder, setSelectedFolder]     = useState(null);

  const [yearFolders, setYearFolders]           = useState([]);
  const [loadingYears, setLoadingYears]         = useState(false);
  const [selectedYear, setSelectedYear]         = useState(null);
  const [newYearName, setNewYearName]           = useState("");
  const [hasYearSubfolders, setHasYearSubfolders] = useState(false);

  const [fileName, setFileName]                 = useState("");

  const fileInputRef = useRef(null);
  const activeProps  = PROPERTIES.filter(p => !p.sold);

  // ── Genera nombre de archivo ─────────────────────────────────────────────
  const buildFileName = useCallback((meta, property) => {
    const today    = new Date();
    const docDate  = meta?.docDate ? fmtShortDate(meta.docDate) : "";
    const saveDate = fmtShortDate(today);
    const sender   = safeStr(meta?.sender  || "", 30);
    const docType  = safeStr(meta?.docType || "", 30);
    const address  = safeStr(property?.address || "", 30);
    const parts = [sender, docType, "Cta", docDate, address, saveDate].filter(Boolean);
    return `${parts.join(" ")}.pdf`;
  }, []);

  // ── Cargar subcarpetas nivel 1 ───────────────────────────────────────────
  const loadSubfolders = useCallback(async (fId) => {
    if (!fId || !drive?.token) return;
    setLoadingFolders(true);
    try {
      const files = await drive.listAllFiles(fId);
      const folders = (files || []).filter(f => f.mimeType === "application/vnd.google-apps.folder");
      setSubfolders(folders);
      if (folders.length > 0) setSelectedFolder(folders[0].id);
    } catch (e) {
      console.error("[Correspondencia] Error cargando carpetas:", e);
    } finally {
      setLoadingFolders(false);
    }
  }, [drive]);

  // ── Cuando cambia la carpeta seleccionada, revisar si tiene años ─────────
  const handleFolderChange = useCallback(async (folderId) => {
    setSelectedFolder(folderId);
    setYearFolders([]);
    setSelectedYear(null);
    setHasYearSubfolders(false);
    if (!folderId || !drive?.token) return;

    setLoadingYears(true);
    try {
      const files = await drive.listAllFiles(folderId);
      const years = (files || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder" && isYearFolder(f.name))
        .sort((a, b) => b.name.localeCompare(a.name));

      if (years.length > 0) {
        setHasYearSubfolders(true);
        setYearFolders(years);
        const currentYear = String(new Date().getFullYear());
        const match = years.find(y => y.name === currentYear);
        if (match) {
          setSelectedYear(match.id);
        } else {
          setSelectedYear("__new__");
          setNewYearName(currentYear);
        }
      }
    } catch (e) {
      console.error("[Correspondencia] Error revisando años:", e);
    } finally {
      setLoadingYears(false);
    }
  }, [drive]);

  useEffect(() => {
    if (selectedFolder) handleFolderChange(selectedFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar si ya hay selectedFolder

  useEffect(() => {
    if (propFolderId) loadSubfolders(propFolderId);
  }, [propFolderId, loadSubfolders]);

  // ── Procesar PDF ─────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    setError("");
    setPdfFile(file);
    setStep("analyzing");

    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "anthropic-beta": "pdfs-2024-09-25",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: `Analiza este documento y extrae la siguiente información:
1. La dirección de la propiedad destinataria mencionada (dirección completa si aparece)
2. El tipo de documento (carta, factura, aviso, contrato, estado de cuenta, notificación, etc.)
3. El remitente o empresa emisora
4. La fecha del documento (si aparece)

Responde ÚNICAMENTE con un objeto JSON sin markdown ni backticks, con esta estructura exacta:
{"address": "dirección aquí o null", "docType": "tipo de doc", "sender": "remitente", "docDate": "YYYY-MM-DD o null", "suggestedName": "nombre corto descriptivo para el archivo sin extensión, máximo 50 caracteres"}` },
            ],
          }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).map(b => b.text || "").join("").trim();

      let meta = {};
      try { meta = JSON.parse(text.replace(/```json|```/g, "").trim()); }
      catch { meta = { docType: "Correspondencia", sender: "", docDate: null, suggestedName: "" }; }

      setDocMeta(meta);

      let fId = propFolderId || null;
      let prop = propProperty || null;
      if (!fId) {
        const matched = matchAddress(meta.address);
        if (matched) {
          prop = matched;
          setResolvedProperty(matched);
          const folder = await findFolderByAddress(matched.address, matched.owner);
          if (folder?.google_drive_id) {
            fId = folder.google_drive_id;
            setResolvedFolderId(fId);
          }
        }
      }

      setFileName(buildFileName(meta, prop || propProperty));
      if (fId) await loadSubfolders(fId);
      setStep("confirm");
    } catch (err) {
      console.error("[Correspondencia] Error analizando PDF:", err);
      setError("No se pudo analizar el PDF. Puedes continuar y asignar el destino manualmente.");
      setFileName(buildFileName(null, propProperty));
      setDocMeta({ docType: "Correspondencia", sender: "", docDate: null });
      if (propFolderId) await loadSubfolders(propFolderId);
      setStep("confirm");
    }
  }, [propFolderId, propProperty, loadSubfolders, buildFileName]);

  const handleFileSelect = (e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; };
  const handleDragOver   = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave  = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop       = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); };

  useEffect(() => {
    if (step !== "select") return;
    const h = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type === "application/pdf");
      if (item) { const f = item.getAsFile(); if (f) processFile(f); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [step, processFile]);

  const handlePropertyChange = async (address) => {
    const prop = activeProps.find(p => p.address === address) || null;
    setResolvedProperty(prop);
    setSubfolders([]); setSelectedFolder(null);
    setYearFolders([]); setSelectedYear(null); setHasYearSubfolders(false);
    if (!prop) return;
    setLoadingFolders(true);
    try {
      const folder = await findFolderByAddress(prop.address, prop.owner);
      if (folder?.google_drive_id) {
        setResolvedFolderId(folder.google_drive_id);
        await loadSubfolders(folder.google_drive_id);
      } else {
        setError("No se encontró la carpeta de Drive para esta propiedad.");
      }
    } catch (e) { setError("Error buscando carpeta: " + e.message); }
    finally { setLoadingFolders(false); }
  };

  const getFinalFolderId = async () => {
    if (!hasYearSubfolders) return selectedFolder;
    if (selectedYear && selectedYear !== "__new__") return selectedYear;
    const yearName = newYearName || String(new Date().getFullYear());
    const created = await drive.createFolder(yearName, selectedFolder);
    return created.id;
  };

  const handleUpload = async () => {
    if (!pdfFile || !selectedFolder || !fileName.trim()) return;
    if (hasYearSubfolders && !selectedYear && !newYearName) return;
    setStep("uploading");
    try {
      const targetFolderId = await getFinalFolderId();
      await drive.uploadFile(pdfFile, fileName.trim(), targetFolderId);
      setStep("done");
      if (onComplete) onComplete({ fileName: fileName.trim() });
    } catch (err) {
      console.error("[Correspondencia] Error subiendo:", err);
      setError("Error al subir: " + err.message);
      setStep("confirm");
    }
  };

  const canUpload = !!selectedFolder && !!fileName.trim() &&
    (!hasYearSubfolders || !!selectedYear);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: mob ? 12 : 32,
    }}>
      <Card style={{ maxWidth: 620, width: "100%", maxHeight: "92vh", overflow: "auto", padding: mob ? 18 : 28 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 16 : 18, fontWeight: 700, color: C.text, margin: 0 }}>
            📬 Agregar Correspondencia
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
        </div>

        {resolvedProperty && (
          <div style={{ padding: "7px 12px", marginBottom: 16, borderRadius: 8, background: `${C.accent}12`, border: `1px solid ${C.accent}30`, fontFamily: "DM Sans", fontSize: 12, color: C.accent }}>
            🏠 {resolvedProperty.address}
          </div>
        )}

        {step === "select" && (
          <>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, textAlign: "center", marginBottom: 14 }}>
              Sube el PDF de la correspondencia para extraer los datos automáticamente
            </p>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileSelect} style={{ display: "none" }} />
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{
              width: "100%", padding: "52px 20px",
              background: dragOver ? `${C.accent}18` : C.surface2,
              border: `2px dashed ${dragOver ? C.accent : C.border}`,
              borderRadius: 12, cursor: "default", textAlign: "center",
              transition: "background 0.15s, border-color 0.15s", boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{dragOver ? "⬇️" : "📁"}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, color: C.text }}>Arrastra tu PDF aquí</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>o</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{
                flex: 1, padding: "12px 10px", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 10,
                cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, color: C.textDim,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textDim; }}
              >
                🔗 Seleccionar archivo
              </button>
              <button style={{
                flex: 1, padding: "12px 10px", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 10,
                cursor: "default", fontFamily: "DM Sans", fontSize: 13, color: C.textDim,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 4,
              }}>
                <span>📋 Pega aquí</span>
                <span style={{ fontSize: 11 }}>(Ctrl+V)</span>
              </button>
            </div>
            {error && <div style={{ marginTop: 12, fontFamily: "DM Sans", fontSize: 12, color: C.red, textAlign: "center" }}>{error}</div>}
          </>
        )}

        {step === "analyzing" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner />
            <div style={{ marginTop: 16, fontFamily: "DM Sans", fontSize: 14, color: C.text }}>Analizando documento...</div>
            <div style={{ marginTop: 6, fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>{pdfFile?.name}</div>
          </div>
        )}

        {step === "confirm" && (
          <div>
            {docMeta && (
              <InfoBox color={C.accent}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: C.accent }}>📄 Documento detectado</div>
                {docMeta.docType  && <div style={{ marginBottom: 3 }}><span style={{ color: C.textDim }}>Tipo: </span><span style={{ color: C.text }}>{docMeta.docType}</span></div>}
                {docMeta.sender   && <div style={{ marginBottom: 3 }}><span style={{ color: C.textDim }}>Remitente: </span><span style={{ color: C.text }}>{docMeta.sender}</span></div>}
                {docMeta.docDate  && <div style={{ marginBottom: 3 }}><span style={{ color: C.textDim }}>Fecha carta: </span><span style={{ color: C.text }}>{fmtShortDate(docMeta.docDate)}</span></div>}
                {docMeta.address  && <div><span style={{ color: C.textDim }}>Dirección detectada: </span><span style={{ color: C.text }}>{docMeta.address}</span></div>}
              </InfoBox>
            )}

            {error && <InfoBox color={C.orange}>⚠️ {error}</InfoBox>}

            {!propFolderId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>🏠 Propiedad</label>
                <select value={resolvedProperty?.address || ""} onChange={e => handlePropertyChange(e.target.value)} style={{
                  width: "100%", padding: "9px 12px", background: C.surface2,
                  border: `1px solid ${resolvedProperty ? C.border : C.red}`,
                  borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, color: C.text, boxSizing: "border-box",
                }}>
                  <option value="">Seleccionar propiedad...</option>
                  {activeProps.map(p => <option key={p.address} value={p.address}>{p.address}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>Nombre del archivo</label>
              <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} style={{
                width: "100%", padding: "9px 12px", background: C.surface2,
                border: `1px solid ${C.border}`, borderRadius: 8,
                fontFamily: "DM Sans", fontSize: 13, color: C.text, boxSizing: "border-box",
              }} />
            </div>

            <div style={{ marginBottom: hasYearSubfolders ? 12 : 20 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>📂 Carpeta destino</label>
              {loadingFolders ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10 }}>
                  <Spinner /><span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>Cargando carpetas...</span>
                </div>
              ) : !resolvedFolderId && !propFolderId ? (
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, padding: "8px 0" }}>
                  Selecciona una propiedad primero.
                </div>
              ) : subfolders.length === 0 ? (
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.orange }}>⚠️ No se encontraron subcarpetas.</div>
              ) : (
                <select value={selectedFolder || ""} onChange={e => handleFolderChange(e.target.value)} style={{
                  width: "100%", padding: "9px 12px", background: C.surface2,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontFamily: "DM Sans", fontSize: 13, color: C.text, boxSizing: "border-box",
                }}>
                  <option value="" disabled>Seleccionar carpeta...</option>
                  {subfolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </div>

            {hasYearSubfolders && selectedFolder && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>📅 Año</label>
                {loadingYears ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10 }}>
                    <Spinner /><span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>Cargando años...</span>
                  </div>
                ) : (
                  <select value={selectedYear || ""} onChange={e => setSelectedYear(e.target.value)} style={{
                    width: "100%", padding: "9px 12px", background: C.surface2,
                    border: `1px solid ${selectedYear ? C.border : C.red}`,
                    borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, color: C.text, boxSizing: "border-box",
                  }}>
                    <option value="" disabled>Seleccionar año...</option>
                    {yearFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    <option value="__new__">+ Crear {newYearName || String(new Date().getFullYear())}</option>
                  </select>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textDim }}>Cancelar</Btn>
              <Btn onClick={handleUpload} disabled={!canUpload} style={{ flex: 2 }}>📤 Archivar en Drive</Btn>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner />
            <div style={{ marginTop: 16, fontFamily: "DM Sans", fontSize: 14, color: C.text }}>Subiendo archivo...</div>
          </div>
        )}

        {step === "done" && (
          <div>
            <InfoBox color={C.green}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 8 }}>✅ ¡Correspondencia archivada!</div>
              <div style={{ color: C.textDim, fontSize: 12 }}>Archivo: <span style={{ color: C.text }}>{fileName}</span></div>
              {resolvedProperty && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Propiedad: <span style={{ color: C.accent }}>{resolvedProperty.address}</span></div>}
            </InfoBox>
            <Btn onClick={onClose} color={C.green} style={{ width: "100%" }}>Cerrar</Btn>
          </div>
        )}

      </Card>
    </div>
  );
};
