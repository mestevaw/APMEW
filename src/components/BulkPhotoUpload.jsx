// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V13 — Totalmente Automático
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// CAMBIOS EN V13:
// - Eliminadas todas las pausas de confirmación
// - Directorios faltantes se crean automáticamente sin preguntar
// - El flujo es: select → scanning → review → progress → done
// - Se mantiene el log de lo que se creó en la pantalla de progreso
// ═══════════════════════════════════════════

import { useState, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { MONTHS_ES } from "../lib/helpers";
import { extractPhotoMetadata } from "../lib/photoOCR";

// ─── Helpers ──────────────────────────────────────────────────────────────

const buildDrivePath = (property, date) => {
  if (!property || !date) return null;
  const dateName = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
  return `${property.address} › INSPECCION › ${date.getFullYear()} › ${dateName}`;
};

// ─── UI ───────────────────────────────────────────────────────────────────

const Btn = ({ onClick, disabled, color, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: "10px 18px",
    background: disabled ? C.border : (color || C.accent),
    color: disabled ? C.textDim : "white",
    border: "none", borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
    ...style,
  }}>
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
    whiteSpace: "pre-wrap", wordBreak: "break-word",
    ...style,
  }}>
    {children}
  </div>
);

const StatusDot = ({ color }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 5 }} />
);

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {

  // select → ocr_scanning → review → running → done
  const [step, setStep]               = useState("select");
  const [photos, setPhotos]           = useState([]);
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver]       = useState(false);

  // Log de progreso (running step)
  const [log, setLog]           = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);

  const fileInputRef = useRef(null);
  const activeProps  = PROPERTIES.filter(p => !p.sold);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  // ════════════════════════════════════════════
  // Procesar archivos (click o drag&drop)
  // ════════════════════════════════════════════
  const processFiles = useCallback(async (files) => {
    if (!files.length) return;
    const initial = files.map((file, i) => ({
      id: `p_${Date.now()}_${i}`,
      file,
      name: file.name,
      ocrStatus: "pending",
      detectedAddress: null,
      dateSource: null,
      addressSource: null,
      matchedProperty: null,
      selectedProperty: null,
      selectedDate: null,
      override: false,
    }));
    setPhotos(initial);
    setStep("ocr_scanning");
    setOcrProgress({ current: 0, total: files.length });

    const updated = [...initial];
    for (let i = 0; i < files.length; i++) {
      setOcrProgress({ current: i + 1, total: files.length });
      updated[i] = { ...updated[i], ocrStatus: "scanning" };
      setPhotos([...updated]);
      try {
        const meta = await extractPhotoMetadata(files[i], activeProps);
        updated[i] = {
          ...updated[i],
          ocrStatus:        meta.matchedProperty ? "ok" : meta.address ? "no_match" : "no_address",
          detectedAddress:  meta.address,
          dateSource:       meta.dateSource,
          addressSource:    meta.addressSource,
          matchedProperty:  meta.matchedProperty || null,
          selectedProperty: meta.matchedProperty || null,
          selectedDate:     meta.date || new Date(),
        };
      } catch {
        updated[i] = { ...updated[i], ocrStatus: "error" };
      }
      setPhotos([...updated]);
    }
    setStep("review");
  }, [activeProps]);

  const handleFileSelect = (e) => processFiles(Array.from(e.target.files || []));

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length) processFiles(files);
  };

  // ════════════════════════════════════════════
  // Revisión
  // ════════════════════════════════════════════
  const updatePhoto = (id, patch) =>
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch, override: true } : p));

  const readyToUpload = photos.length > 0 && photos.every(p => p.selectedProperty && p.selectedDate);
  const problemCount  = photos.filter(p => !p.selectedProperty || !p.selectedDate).length;

  // ════════════════════════════════════════════
  // Ejecución automática — navegar + crear + subir
  // ════════════════════════════════════════════

  /** Navega o crea la estructura de carpetas. Devuelve el folderId de la carpeta de fecha. */
  const ensureFolderPath = async (property, date) => {
    const dateName = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
    const year     = date.getFullYear().toString();

    // Raíz de propiedad (desde Supabase)
    const sf = await findFolderByAddress(property.address, property.owner);
    if (!sf?.google_drive_id) throw new Error(`Sin carpeta en Supabase para: ${property.address}`);
    const propId = sf.google_drive_id;

    // INSPECCION
    let inspec = await drive.findSubfolder(propId, "INSPEC");
    if (!inspec) {
      addLog(`  📁 Creando INSPECCION en ${property.address}...`);
      inspec = await drive.createFolder("INSPECCION", propId);
    }

    // Año
    let yearFolder = await drive.findSubfolder(inspec.id, year);
    if (!yearFolder) {
      addLog(`  📁 Creando ${year}...`);
      yearFolder = await drive.createFolder(year, inspec.id);
    }

    // Fecha
    let dateFolder = await drive.findSubfolder(yearFolder.id, dateName);
    if (!dateFolder) {
      addLog(`  📁 Creando ${dateName}...`);
      dateFolder = await drive.createFolder(dateName, yearFolder.id);
    }

    return dateFolder.id;
  };

  const runAll = async (pts) => {
    setLog([]);
    setStep("running");

    // Agrupar por propiedad + fecha
    const groupMap = {};
    pts.forEach(p => {
      if (!p.selectedProperty || !p.selectedDate) return;
      const key = `${p.selectedProperty.address}||${p.selectedDate.toDateString()}`;
      if (!groupMap[key]) groupMap[key] = { property: p.selectedProperty, date: p.selectedDate, photos: [] };
      groupMap[key].photos.push(p);
    });

    let ok = 0, skip = 0, fail = 0;

    for (const { property, date, photos: gPhotos } of Object.values(groupMap)) {
      const dateName  = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
      const shortName = property.address.replace(/^\d+\s*/, "").split(/\s+/).slice(0, 2).join(" ");

      addLog(`📍 ${property.address} — ${dateName}`);

      let folderId;
      try {
        folderId = await ensureFolderPath(property, date);
      } catch (err) {
        addLog(`  ❌ ${err.message}`);
        fail += gPhotos.length;
        continue;
      }

      // Verificar duplicados
      const existing     = await drive.listAllFiles(folderId);
      const existingNames = new Set((existing || []).map(f => f.name));

      for (let i = 0; i < gPhotos.length; i++) {
        const ext      = gPhotos[i].file.name.split(".").pop() || "jpg";
        const fileName = `${shortName} ${i + 1} Foto ${dateName}.${ext}`;

        if (existingNames.has(fileName)) {
          addLog(`  ⏭️ ${fileName} (ya existe)`);
          skip++; continue;
        }

        addLog(`  📤 ${fileName}`);
        try {
          await drive.uploadFile(gPhotos[i].file, fileName, folderId);
          ok++;
        } catch (err) {
          addLog(`  ❌ ${fileName}: ${err.message}`);
          fail++;
        }
      }
    }

    addLog(`\n✅ Completado — ${ok} subidas, ${skip} ya existían${fail ? `, ${fail} fallidas` : ""}`);
    setUploadSummary({ success: ok, skipped: skip, failed: fail });
    onComplete({ success: ok, failed: fail });
    setStep("done");
  };

  // ════════════════════════════════════════════
  // Helpers display
  // ════════════════════════════════════════════
  const statusInfo = (s) => ({
    pending:    { color: C.textDim, label: "Pendiente" },
    scanning:   { color: C.accent,  label: "Leyendo..." },
    ok:         { color: C.green,   label: "✓ Detectado" },
    no_match:   { color: C.orange,  label: "Sin match" },
    no_address: { color: C.red,     label: "Sin dirección" },
    manual:     { color: C.blue,    label: "Manual" },
    error:      { color: C.red,     label: "Error" },
  }[s] || { color: C.textDim, label: s });

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
        maxWidth: 860, width: "100%", maxHeight: "90vh",
        overflow: "auto", padding: mob ? 18 : 28,
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 17 : 19, fontWeight: 700, color: C.text }}>
            📤 Subir Batch de Fotos
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
        </div>

        {/* ══ SELECT ══ */}
        {step === "select" && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "52px 20px",
                background: dragOver ? `${C.accent}18` : C.surface2,
                border: `2px dashed ${dragOver ? C.accent : C.border}`,
                borderRadius: 12, cursor: "pointer", textAlign: "center",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>{dragOver ? "⬇️" : "📁"}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.accent, marginBottom: 6 }}>
                {dragOver ? "Suelta las fotos aquí" : "Seleccionar Fotos"}
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>
                Arrastra y suelta, o haz click para explorar
              </div>
            </div>
            <div style={{ marginTop: 10, fontFamily: "DM Sans", fontSize: 12, color: C.textDim, textAlign: "center" }}>
              La dirección y fecha se leen automáticamente de los metadatos de cada foto
            </div>
          </>
        )}

        {/* ══ SCANNING ══ */}
        {step === "ocr_scanning" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 14 }}><Spinner /></div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginBottom: 4 }}>Leyendo metadatos...</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 14 }}>
              {ocrProgress.current} / {ocrProgress.total}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", textAlign: "left" }}>
              {photos.map(p => {
                const s = statusInfo(p.ocrStatus);
                return (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "DM Sans", fontSize: 12 }}>
                    <StatusDot color={s.color} />
                    <span style={{ flex: 1, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ color: s.color, minWidth: 90, textAlign: "right" }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ REVIEW ══ */}
        {step === "review" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <InfoBox color={C.green} style={{ flex: 1, marginBottom: 0, padding: "9px 12px" }}>
                <strong style={{ color: C.green }}>✓ {photos.filter(p => p.selectedProperty).length}</strong>
                <span style={{ color: C.textDim }}> detectadas</span>
              </InfoBox>
              {problemCount > 0 && (
                <InfoBox color={C.orange} style={{ flex: 1, marginBottom: 0, padding: "9px 12px" }}>
                  <strong style={{ color: C.orange }}>⚠ {problemCount}</strong>
                  <span style={{ color: C.textDim }}> requieren corrección</span>
                </InfoBox>
              )}
            </div>

            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600 }}>Foto</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600 }}>Propiedad</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600 }}>Destino en Drive</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", color: C.textDim, fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {photos.map((p) => {
                    const s         = statusInfo(p.override ? "manual" : p.ocrStatus);
                    const drivePath = buildDrivePath(p.selectedProperty, p.selectedDate);
                    const parts     = drivePath ? drivePath.split(" › ") : [];
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>

                        {/* Foto */}
                        <td style={{ padding: "7px 10px", color: C.textDim, maxWidth: 110 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</div>
                          {p.detectedAddress && (
                            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                              {p.addressSource === "exif" ? "📋" : p.addressSource === "gps" ? "📍" : "🔍"} {p.detectedAddress}
                            </div>
                          )}
                        </td>

                        {/* Propiedad */}
                        <td style={{ padding: "6px 10px", minWidth: 190 }}>
                          <select
                            value={p.selectedProperty?.address || ""}
                            onChange={(e) => {
                              const prop = activeProps.find(x => x.address === e.target.value) || null;
                              updatePhoto(p.id, { selectedProperty: prop });
                            }}
                            style={{
                              width: "100%", padding: "5px 7px", fontFamily: "DM Sans", fontSize: 12,
                              border: `1px solid ${p.selectedProperty ? C.border : C.red}`,
                              borderRadius: 6, background: C.surface2, color: C.text,
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {activeProps.map(x => <option key={x.address} value={x.address}>{x.address}</option>)}
                          </select>
                        </td>

                        {/* Fecha */}
                        <td style={{ padding: "6px 10px", minWidth: 130 }}>
                          <input
                            type="date"
                            value={p.selectedDate ? p.selectedDate.toISOString().slice(0, 10) : ""}
                            onChange={(e) => {
                              const d = e.target.value ? new Date(e.target.value + "T12:00:00") : null;
                              updatePhoto(p.id, { selectedDate: d });
                            }}
                            style={{
                              width: "100%", padding: "5px 7px", fontFamily: "DM Sans", fontSize: 12,
                              border: `1px solid ${p.selectedDate ? C.border : C.red}`,
                              borderRadius: 6, background: C.surface2, color: "#fff", colorScheme: "dark",
                            }}
                          />
                          {p.dateSource && !p.override && (
                            <div style={{ fontSize: 10, marginTop: 2, color: p.dateSource === "exif" ? C.green : C.accent }}>
                              {p.dateSource === "exif" ? "📷 EXIF" : "🔍 OCR"}
                            </div>
                          )}
                        </td>

                        {/* Destino */}
                        <td style={{ padding: "7px 10px", minWidth: 200 }}>
                          {parts.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {parts.map((part, i) => (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  paddingLeft: i * 10, fontFamily: "DM Sans", fontSize: 11,
                                  color: i === parts.length - 1 ? C.green : C.textDim,
                                  fontWeight: i === parts.length - 1 ? 600 : 400,
                                }}>
                                  {i > 0 && <span style={{ color: C.border, fontSize: 9 }}>└</span>}
                                  <span>📁 {part}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: C.red, fontSize: 11 }}>— sin asignar —</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td style={{ padding: "7px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <StatusDot color={s.color} />
                          <span style={{ color: s.color, fontSize: 11 }}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Btn onClick={() => runAll(photos)} disabled={!readyToUpload} style={{ width: "100%" }}>
              {readyToUpload
                ? `🚀 Archivar ${photos.length} foto${photos.length !== 1 ? "s" : ""} automáticamente`
                : `Corrige ${problemCount} foto${problemCount !== 1 ? "s" : ""} antes de continuar`}
            </Btn>
          </div>
        )}

        {/* ══ RUNNING ══ */}
        {step === "running" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Spinner />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text }}>Archivando...</span>
            </div>
            <div style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 14px",
              fontFamily: "monospace", fontSize: 12, color: C.textDim,
              maxHeight: 320, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 3,
            }}>
              {log.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith("📍") ? C.text
                       : line.startsWith("  ✅") || line.startsWith("✅") ? C.green
                       : line.startsWith("  ❌") ? C.red
                       : line.startsWith("  ⏭️") ? C.textDim
                       : line.startsWith("  📁") ? C.orange
                       : C.textDim,
                }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ DONE ══ */}
        {step === "done" && uploadSummary && (
          <div>
            <InfoBox color={C.green}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 10 }}>✅ ¡Archivado completado!</div>
              <div>📤 Nuevas: <strong>{uploadSummary.success}</strong></div>
              {uploadSummary.skipped > 0 && <div>⏭️ Ya existían: <strong>{uploadSummary.skipped}</strong></div>}
              {uploadSummary.failed  > 0 && <div style={{ color: C.red }}>❌ Fallidas: <strong>{uploadSummary.failed}</strong></div>}
            </InfoBox>
            {/* Log colapsado para referencia */}
            <details style={{ marginBottom: 14 }}>
              <summary style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, cursor: "pointer", marginBottom: 6 }}>
                Ver detalle del proceso
              </summary>
              <div style={{
                background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "10px 12px", fontFamily: "monospace", fontSize: 11,
                color: C.textDim, maxHeight: 200, overflowY: "auto",
              }}>
                {log.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </details>
            <Btn onClick={onClose} color={C.green} style={{ width: "100%" }}>Cerrar</Btn>
          </div>
        )}

      </Card>
    </div>
  );
};
