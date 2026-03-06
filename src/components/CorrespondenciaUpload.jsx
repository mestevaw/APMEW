// ═══════════════════════════════════════════
// Archivo: src/components/CorrespondenciaUpload.jsx
// Versión: V1
// Fecha: 2026-03-06
// ═══════════════════════════════════════════
// DESCRIPCIÓN:
// Modal para archivar correspondencia (PDFs) en Google Drive.
// Flujo: select → analyzing (Claude lee el PDF) → confirm (elige carpeta destino) → uploading → done
// Se abre desde el menú hamburguesa de una propiedad.
// ═══════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";

// ─── Helpers UI ────────────────────────────────────────────────────────────

const Btn = ({ onClick, disabled, color, children, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "10px 18px",
      background: disabled ? C.border : (color || C.accent),
      color: disabled ? C.textDim : "white",
      border: "none", borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </button>
);

const InfoBox = ({ color, children, style = {} }) => (
  <div style={{
    padding: "12px 14px",
    background: `${color || C.accent}12`,
    border: `1px solid ${color || C.accent}40`,
    borderRadius: 10, fontFamily: "DM Sans", fontSize: 13,
    color: C.text, lineHeight: 1.6, marginBottom: 14,
    ...style,
  }}>
    {children}
  </div>
);

// Convierte un File a base64 (sin prefijo data:...)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Error leyendo archivo"));
    r.readAsDataURL(file);
  });

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export const CorrespondenciaUpload = ({ drive, folderId, property, onClose, onComplete, mob }) => {

  // select → analyzing → confirm → uploading → done
  const [step, setStep]           = useState("select");
  const [dragOver, setDragOver]   = useState(false);
  const [pdfFile, setPdfFile]     = useState(null);
  const [error, setError]         = useState("");

  // Datos extraídos por Claude del PDF
  const [docMeta, setDocMeta]     = useState(null);

  // Subcarpetas disponibles en el folder raíz de la propiedad
  const [subfolders, setSubfolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Nombre de archivo final (editable)
  const [fileName, setFileName]   = useState("");

  // Progreso de subida
  const [uploadMsg, setUploadMsg] = useState("");

  const fileInputRef = useRef(null);

  // ════════════════════════════════════════════
  // Cargar subcarpetas al montar
  // ════════════════════════════════════════════
  useEffect(() => {
    if (!folderId || !drive?.token) return;
    setLoadingFolders(true);
    drive.listAllFiles(folderId)
      .then((files) => {
        const folders = (files || []).filter(
          f => f.mimeType === "application/vnd.google-apps.folder"
        );
        setSubfolders(folders);
        if (folders.length > 0) setSelectedFolder(folders[0].id);
      })
      .catch((e) => console.error("[Correspondencia] Error cargando carpetas:", e))
      .finally(() => setLoadingFolders(false));
  }, [folderId, drive?.token]);

  // ════════════════════════════════════════════
  // Procesar archivo (drag, click o paste)
  // ════════════════════════════════════════════
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              {
                type: "text",
                text: `Analiza este documento y extrae la siguiente información:
1. La dirección de la propiedad o destinatario mencionada (dirección completa si aparece)
2. El tipo de documento (carta, factura, aviso, contrato, estado de cuenta, notificación, etc.)
3. El remitente o empresa emisora
4. La fecha del documento (si aparece)

Responde ÚNICAMENTE con un objeto JSON sin markdown ni backticks, con esta estructura exacta:
{"address": "dirección aquí o null", "docType": "tipo de doc", "sender": "remitente", "docDate": "YYYY-MM-DD o null", "suggestedName": "nombre corto descriptivo para el archivo sin extensión"}`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = (data.content || []).map(b => b.text || "").join("").trim();

      let meta = {};
      try {
        meta = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch {
        meta = { docType: "Correspondencia", sender: "", docDate: null, suggestedName: "" };
      }

      setDocMeta(meta);

      // Generar nombre de archivo sugerido
      const today = new Date();
      const dateStr = meta.docDate || today.toISOString().slice(0, 10);
      const safeSender = (meta.sender || "").replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, "").trim().slice(0, 30);
      const safeType   = (meta.docType  || "").replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/g, "").trim().slice(0, 20);
      const suggested  = meta.suggestedName?.trim() || [safeType, safeSender].filter(Boolean).join(" - ");
      setFileName(`${dateStr} ${suggested || "Correspondencia"}.pdf`);

      setStep("confirm");
    } catch (err) {
      console.error("[Correspondencia] Error analizando PDF:", err);
      setError("No se pudo analizar el PDF. Puedes continuar y asignar el destino manualmente.");
      const today = new Date().toISOString().slice(0, 10);
      setFileName(`${today} Correspondencia.pdf`);
      setDocMeta({ docType: "Correspondencia", sender: "", docDate: null });
      setStep("confirm");
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Paste (Ctrl+V)
  useEffect(() => {
    if (step !== "select") return;
    const handler = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const pdfItem = items.find(i => i.type === "application/pdf");
      if (pdfItem) {
        const file = pdfItem.getAsFile();
        if (file) processFile(file);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [step, processFile]);

  // ════════════════════════════════════════════
  // Subir el PDF a la carpeta seleccionada
  // ════════════════════════════════════════════
  const handleUpload = async () => {
    if (!pdfFile || !selectedFolder || !fileName.trim()) return;
    setStep("uploading");
    setUploadMsg("Subiendo archivo...");
    try {
      await drive.uploadFile(pdfFile, fileName.trim(), selectedFolder);
      setUploadMsg("✓ Archivado correctamente");
      setStep("done");
      if (onComplete) onComplete({ fileName: fileName.trim() });
    } catch (err) {
      console.error("[Correspondencia] Error subiendo:", err);
      setError("Error al subir: " + err.message);
      setStep("confirm");
    }
  };

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: mob ? 12 : 32,
    }}>
      <Card style={{
        maxWidth: 620, width: "100%", maxHeight: "92vh",
        overflow: "auto", padding: mob ? 18 : 28,
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 16 : 18, fontWeight: 700, color: C.text, margin: 0 }}>
            📬 Agregar Correspondencia
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
        </div>

        {/* Propiedad activa */}
        {property && (
          <div style={{
            padding: "7px 12px", marginBottom: 16, borderRadius: 8,
            background: `${C.accent}12`, border: `1px solid ${C.accent}30`,
            fontFamily: "DM Sans", fontSize: 12, color: C.accent,
          }}>
            🏠 {property.address}
          </div>
        )}

        {/* ══ SELECT ══ */}
        {step === "select" && (
          <>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, textAlign: "center", marginBottom: 14 }}>
              Sube el PDF de la correspondencia para extraer los datos automáticamente
            </p>

            {/* Drop zone */}
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileSelect} style={{ display: "none" }} />
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              style={{
                width: "100%", padding: "52px 20px",
                background: dragOver ? `${C.accent}18` : C.surface2,
                border: `2px dashed ${dragOver ? C.accent : C.border}`,
                borderRadius: 12, cursor: "default", textAlign: "center",
                transition: "background 0.15s, border-color 0.15s", boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>{dragOver ? "⬇️" : "📁"}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 700, color: C.text }}>
                Arrastra tu PDF aquí
              </div>
            </div>

            {/* Separador */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>o</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {/* Botones secundarios */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
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
              <button
                style={{
                  flex: 1, padding: "12px 10px", background: "transparent",
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  cursor: "default", fontFamily: "DM Sans", fontSize: 13, color: C.textDim,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  flexDirection: "column",
                }}
              >
                <span>📋 Pega aquí</span>
                <span style={{ fontSize: 11, color: C.textDim }}>(Ctrl+V)</span>
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, fontFamily: "DM Sans", fontSize: 12, color: C.red, textAlign: "center" }}>
                {error}
              </div>
            )}
          </>
        )}

        {/* ══ ANALYZING ══ */}
        {step === "analyzing" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner />
            <div style={{ marginTop: 16, fontFamily: "DM Sans", fontSize: 14, color: C.text }}>
              Analizando documento...
            </div>
            <div style={{ marginTop: 6, fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>
              {pdfFile?.name}
            </div>
          </div>
        )}

        {/* ══ CONFIRM ══ */}
        {step === "confirm" && (
          <div>
            {/* Datos detectados */}
            {docMeta && (
              <InfoBox color={C.accent}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: C.accent }}>📄 Documento detectado</div>
                {docMeta.docType && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: C.textDim }}>Tipo: </span>
                    <span style={{ color: C.text }}>{docMeta.docType}</span>
                  </div>
                )}
                {docMeta.sender && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: C.textDim }}>Remitente: </span>
                    <span style={{ color: C.text }}>{docMeta.sender}</span>
                  </div>
                )}
                {docMeta.docDate && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: C.textDim }}>Fecha: </span>
                    <span style={{ color: C.text }}>{docMeta.docDate}</span>
                  </div>
                )}
                {docMeta.address && (
                  <div>
                    <span style={{ color: C.textDim }}>Dirección detectada: </span>
                    <span style={{ color: C.text }}>{docMeta.address}</span>
                  </div>
                )}
              </InfoBox>
            )}

            {error && (
              <InfoBox color={C.orange} style={{ marginBottom: 14 }}>
                ⚠️ {error}
              </InfoBox>
            )}

            {/* Nombre del archivo */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>
                Nombre del archivo
              </label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px",
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, color: C.text,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Carpeta destino */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, display: "block", marginBottom: 6 }}>
                📂 Carpeta destino
              </label>
              {loadingFolders ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10 }}>
                  <Spinner />
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>Cargando carpetas...</span>
                </div>
              ) : subfolders.length === 0 ? (
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.orange, padding: "8px 12px" }}>
                  ⚠️ No se encontraron subcarpetas en esta propiedad. Verifica la conexión con Drive.
                </div>
              ) : (
                <select
                  value={selectedFolder || ""}
                  onChange={e => setSelectedFolder(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px",
                    background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontFamily: "DM Sans", fontSize: 13, color: C.text,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="" disabled>Seleccionar carpeta...</option>
                  {subfolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={onClose} color={C.border} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textDim }}>
                Cancelar
              </Btn>
              <Btn
                onClick={handleUpload}
                disabled={!selectedFolder || !fileName.trim()}
                style={{ flex: 2 }}
              >
                📤 Archivar en Drive
              </Btn>
            </div>
          </div>
        )}

        {/* ══ UPLOADING ══ */}
        {step === "uploading" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spinner />
            <div style={{ marginTop: 16, fontFamily: "DM Sans", fontSize: 14, color: C.text }}>
              {uploadMsg || "Subiendo..."}
            </div>
          </div>
        )}

        {/* ══ DONE ══ */}
        {step === "done" && (
          <div>
            <InfoBox color={C.green}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 8 }}>
                ✅ ¡Correspondencia archivada!
              </div>
              <div style={{ color: C.textDim, fontSize: 12 }}>
                Archivo: <span style={{ color: C.text }}>{fileName}</span>
              </div>
              <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
                Carpeta: <span style={{ color: C.text }}>
                  {subfolders.find(f => f.id === selectedFolder)?.name || "—"}
                </span>
              </div>
            </InfoBox>
            <Btn onClick={onClose} color={C.green} style={{ width: "100%" }}>Cerrar</Btn>
          </div>
        )}

      </Card>
    </div>
  );
};
