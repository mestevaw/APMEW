// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V12 — Drag & Drop + Columna Destino Drive
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// CAMBIOS EN V12:
// - Drag & Drop en la zona de selección de fotos
// - Columna "Destino" en tabla de revisión: muestra la ruta exacta
//   en Google Drive donde se archivará cada foto
//   (address > INSPECCION > año > DD Mon AA)
// ═══════════════════════════════════════════

import { useState, useRef, useCallback } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { MONTHS_ES } from "../lib/helpers";
import { extractPhotoMetadata } from "../lib/photoOCR";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Construye la ruta Drive de destino a partir de propiedad + fecha */
const buildDrivePath = (property, date) => {
  if (!property || !date) return null;
  const dateName = `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
  const year     = date.getFullYear();
  return `${property.address} › INSPECCION › ${year} › ${dateName}`;
};

// ─── Sub-componentes ──────────────────────────────────────────────────────

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

  const [step, setStep]                     = useState("select");
  const [photos, setPhotos]                 = useState([]);
  const [ocrProgress, setOcrProgress]       = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver]             = useState(false);

  const queueRef        = useRef([]);
  const currentGroupRef = useRef(null);
  const propFolderRef   = useRef(null);
  const inspecFolderRef = useRef(null);
  const yearFolderRef   = useRef(null);

  const [pendingCreate, setPendingCreate] = useState(null);
  const [lastCreated, setLastCreated]     = useState(null);
  const continueNavRef = useRef(null);

  const [navStatus, setNavStatus]           = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadSummary, setUploadSummary]   = useState(null);

  const fileInputRef = useRef(null);
  const activeProps  = PROPERTIES.filter(p => !p.sold);

  // ════════════════════════════════════════════
  // Procesamiento de archivos (compartido por click y drag&drop)
  // ════════════════════════════════════════════
  const processFiles = useCallback(async (files) => {
    if (!files.length) return;

    const initial = files.map((file, i) => ({
      id: `p_${Date.now()}_${i}`,
      file,
      name: file.name,
      ocrStatus: "pending",
      detectedAddress: null,
      detectedDate: null,
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
          detectedDate:     meta.date,
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

  // ── Click normal ───────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    processFiles(Array.from(e.target.files || []));
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length) processFiles(files);
  };

  // ════════════════════════════════════════════
  // Revisión
  // ════════════════════════════════════════════
  const updatePhoto = (id, patch) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...patch, override: true } : p));
  };

  const readyToUpload = photos.length > 0 && photos.every(p => p.selectedProperty && p.selectedDate);
  const problemCount  = photos.filter(p => !p.selectedProperty || !p.selectedDate).length;

  // ════════════════════════════════════════════
  // Navegación de directorios
  // ════════════════════════════════════════════
  const buildQueue = (pts) => {
    const map = {};
    pts.forEach(p => {
      if (!p.selectedProperty || !p.selectedDate) return;
      const key = `${p.selectedProperty.address}||${p.selectedDate.toDateString()}`;
      if (!map[key]) map[key] = { property: p.selectedProperty, date: p.selectedDate, photoIds: [] };
      map[key].photoIds.push(p.id);
    });
    return Object.values(map);
  };

  const startNavigation = (pts) => {
    queueRef.current = buildQueue(pts);
    if (!queueRef.current.length) return;
    setStep("navigating");
    processNextGroup(pts);
  };

  const processNextGroup = async (pts) => {
    if (!queueRef.current.length) {
      setStep("uploading");
      await uploadAll(pts || photos);
      return;
    }
    const group = queueRef.current.shift();
    currentGroupRef.current = group;
    propFolderRef.current = inspecFolderRef.current = yearFolderRef.current = null;
    setNavStatus(`📍 Navegando: ${group.property.address}`);
    await navigatePropFolder(group, pts);
  };

  const navigatePropFolder = async (group, pts) => {
    setNavStatus(`Buscando carpeta de "${group.property.address}" en Supabase...`);
    try {
      const sf = await findFolderByAddress(group.property.address, group.property.owner);
      if (!sf?.google_drive_id) {
        setNavStatus(`❌ No se encontró carpeta en Supabase para:\n${group.property.address}`);
        setStep("nav_error"); return;
      }
      propFolderRef.current = { id: sf.google_drive_id, name: group.property.address };
      await navigateInspeccion(group, pts);
    } catch (err) {
      setNavStatus(`❌ Error: ${err.message}`); setStep("nav_error");
    }
  };

  const navigateInspeccion = async (group, pts) => {
    setNavStatus("Buscando carpeta de inspecciones...");
    const found = await drive.findSubfolder(propFolderRef.current.id, "INSPEC");
    if (found) {
      inspecFolderRef.current = { id: found.id, name: found.name };
      await navigateYear(group, pts);
    } else {
      continueNavRef.current = () => navigateYear(group, pts);
      setPendingCreate({ name: "INSPECCION", parentId: propFolderRef.current.id, parentPath: group.property.address, phase: 0, group, pts });
      setStep("confirm_create");
    }
  };

  const navigateYear = async (group, pts) => {
    const year = group.date.getFullYear().toString();
    setNavStatus(`Buscando carpeta del año ${year}...`);
    const found = await drive.findSubfolder(inspecFolderRef.current.id, year);
    if (found) {
      yearFolderRef.current = { id: found.id, name: found.name };
      await navigateDate(group, pts);
    } else {
      continueNavRef.current = () => navigateDate(group, pts);
      setPendingCreate({ name: year, parentId: inspecFolderRef.current.id, parentPath: `${group.property.address} > ${inspecFolderRef.current.name}`, phase: 1, group, pts });
      setStep("confirm_create");
    }
  };

  const navigateDate = async (group, pts) => {
    const d        = group.date;
    const dateName = `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    setNavStatus(`Buscando carpeta de fecha "${dateName}"...`);
    const found = await drive.findSubfolder(yearFolderRef.current.id, dateName);
    if (found) {
      currentGroupRef.current.dateFolderId = found.id;
      currentGroupRef.current.dateName     = dateName;
      await processNextGroup(pts);
    } else {
      continueNavRef.current = null;
      setPendingCreate({ name: dateName, parentId: yearFolderRef.current.id, parentPath: `${group.property.address} > ${inspecFolderRef.current.name} > ${yearFolderRef.current.name}`, phase: 2, group, pts });
      setStep("confirm_create");
    }
  };

  const handleConfirmCreate = async () => {
    const { name, parentId, parentPath, phase, group, pts } = pendingCreate;
    setStep("navigating");
    setNavStatus(`Creando directorio "${name}"...`);
    try {
      const created  = await drive.createFolder(name, parentId);
      const fullPath = `${parentPath} > ${name}`;
      if (phase === 0) inspecFolderRef.current = { id: created.id, name };
      else if (phase === 1) yearFolderRef.current = { id: created.id, name };
      else if (phase === 2) {
        currentGroupRef.current.dateFolderId = created.id;
        currentGroupRef.current.dateName     = name;
      }
      setLastCreated({ name, id: created.id, fullPath, phase, group, pts });
      setStep("created_notice");
    } catch (err) {
      setNavStatus(`❌ Error al crear "${name}": ${err.message}`);
      setStep("nav_error");
    }
  };

  const handleContinueAfterVerify = async () => {
    const { phase, pts } = lastCreated;
    setLastCreated(null); setPendingCreate(null);
    setStep("navigating");
    if (phase === 2) await processNextGroup(pts);
    else if (continueNavRef.current) await continueNavRef.current();
    else await processNextGroup(pts);
  };

  // ════════════════════════════════════════════
  // Upload
  // ════════════════════════════════════════════
  const uploadAll = async (pts) => {
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
      setUploadProgress(`📍 ${property.address} — "${dateName}"`);

      let folderId = null;
      try {
        const sf     = await findFolderByAddress(property.address, property.owner);
        if (!sf?.google_drive_id) throw new Error("Sin carpeta en Supabase");
        const inspec = await drive.findSubfolder(sf.google_drive_id, "INSPEC");
        if (!inspec) throw new Error("Sin carpeta INSPECCION");
        const year   = await drive.findSubfolder(inspec.id, date.getFullYear().toString());
        if (!year)   throw new Error("Sin carpeta de año");
        const df     = await drive.findSubfolder(year.id, dateName);
        if (!df)     throw new Error(`Sin carpeta "${dateName}"`);
        folderId = df.id;
      } catch (err) {
        setUploadProgress(`❌ ${property.address}: ${err.message}`);
        fail += gPhotos.length; continue;
      }

      const existing     = await drive.listAllFiles(folderId);
      const existingNames = new Set((existing || []).map(f => f.name));

      for (let i = 0; i < gPhotos.length; i++) {
        const ext      = gPhotos[i].file.name.split(".").pop() || "jpg";
        const fileName = `${shortName} ${i + 1} Foto ${dateName}.${ext}`;
        if (existingNames.has(fileName)) { skip++; setUploadProgress(`⏭️ ${fileName}`); continue; }
        setUploadProgress(`📤 ${i + 1}/${gPhotos.length}: ${fileName}`);
        try { await drive.uploadFile(gPhotos[i].file, fileName, folderId); ok++; }
        catch { fail++; }
      }
    }

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
        overflow: "auto", padding: mob ? 18 : 28, position: "relative",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 17 : 19, fontWeight: 700, color: C.text }}>
            📤 Subir Batch de Fotos
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
        </div>

        {/* ══ SELECT — con Drag & Drop ══ */}
        {step === "select" && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "52px 20px",
                background: dragOver ? `${C.accent}18` : C.surface2,
                border: `2px dashed ${dragOver ? C.accent : C.border}`,
                borderRadius: 12, cursor: "pointer",
                textAlign: "center",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>
                {dragOver ? "⬇️" : "📁"}
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: dragOver ? C.accent : C.accent, marginBottom: 6 }}>
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
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginBottom: 4 }}>
              Leyendo metadatos...
            </div>
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
            {/* Resumen */}
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

            {/* Tabla */}
            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>Foto</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>Propiedad</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>Fecha</th>
                    <th style={{ padding: "8px 10px", textAlign: "left",   color: C.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>Destino en Drive</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", color: C.textDim, fontWeight: 600, whiteSpace: "nowrap" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {photos.map((p) => {
                    const s        = statusInfo(p.override ? "manual" : p.ocrStatus);
                    const drivePath = buildDrivePath(p.selectedProperty, p.selectedDate);
                    const pathParts = drivePath ? drivePath.split(" › ") : [];

                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>

                        {/* Foto */}
                        <td style={{ padding: "7px 10px", color: C.textDim, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>
                            {p.name}
                          </div>
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
                              width: "100%", padding: "5px 7px",
                              fontFamily: "DM Sans", fontSize: 12,
                              border: `1px solid ${p.selectedProperty ? C.border : C.red}`,
                              borderRadius: 6, background: C.surface2, color: C.text,
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {activeProps.map(x => (
                              <option key={x.address} value={x.address}>{x.address}</option>
                            ))}
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
                              width: "100%", padding: "5px 7px",
                              fontFamily: "DM Sans", fontSize: 12,
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

                        {/* Destino en Drive */}
                        <td style={{ padding: "7px 10px", minWidth: 200 }}>
                          {drivePath ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {pathParts.map((part, i) => (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  fontFamily: "DM Sans", fontSize: 11,
                                  paddingLeft: i * 10,
                                  color: i === pathParts.length - 1 ? C.green : C.textDim,
                                  fontWeight: i === pathParts.length - 1 ? 600 : 400,
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

            <Btn
              onClick={() => startNavigation(photos)}
              disabled={!readyToUpload}
              style={{ width: "100%" }}
            >
              {readyToUpload
                ? `Archivar ${photos.length} foto${photos.length !== 1 ? "s" : ""} →`
                : `Corrige ${problemCount} foto${problemCount !== 1 ? "s" : ""} antes de continuar`}
            </Btn>
          </div>
        )}

        {/* ══ NAVIGATING ══ */}
        {step === "navigating" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 14 }}><Spinner /></div>
            <InfoBox color={C.accent}>{navStatus || "Navegando estructura de directorios..."}</InfoBox>
          </div>
        )}

        {/* ══ CONFIRM CREATE ══ */}
        {step === "confirm_create" && pendingCreate && (
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 10 }}>
              ⚠️ El siguiente directorio no existe y necesita crearse:
            </div>
            <InfoBox color={C.orange}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: C.orange }}>Directorio a crear:</strong></div>
              <div style={{ fontFamily: "monospace", fontSize: 14, color: C.text, marginBottom: 10 }}>📁 {pendingCreate.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
                <strong>Dentro de:</strong><br />{pendingCreate.parentPath}
              </div>
              <div style={{ paddingTop: 8, borderTop: `1px solid ${C.orange}30`, fontSize: 12, color: C.textDim }}>
                <strong>Ruta completa resultante:</strong><br />
                <span style={{ fontFamily: "monospace" }}>{pendingCreate.parentPath} &gt; {pendingCreate.name}</span>
              </div>
            </InfoBox>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={handleConfirmCreate} color={C.green} style={{ flex: 1 }}>✅ Sí, crear directorio</Btn>
              <Btn onClick={onClose} color={C.red} style={{ flex: 1 }}>✕ Cancelar</Btn>
            </div>
          </div>
        )}

        {/* ══ CREATED NOTICE ══ */}
        {step === "created_notice" && lastCreated && (
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 10 }}>
              ✅ Directorio creado. Verifica en Google Drive antes de continuar:
            </div>
            <InfoBox color={C.green}>
              <div style={{ marginBottom: 6 }}><strong style={{ color: C.green }}>📁 Creado:</strong> {lastCreated.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                <strong>ID Drive:</strong> <span style={{ fontFamily: "monospace" }}>{lastCreated.id}</span>
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.green}30`, fontSize: 12 }}>
                <strong>Ruta completa:</strong><br />
                <span style={{ fontFamily: "monospace" }}>{lastCreated.fullPath}</span>
              </div>
            </InfoBox>
            <Btn onClick={handleContinueAfterVerify} color={C.accent} style={{ width: "100%" }}>
              Verificado — Continuar →
            </Btn>
          </div>
        )}

        {/* ══ NAV ERROR ══ */}
        {step === "nav_error" && (
          <div>
            <InfoBox color={C.red}>{navStatus}</InfoBox>
            <Btn onClick={onClose} color={C.red} style={{ width: "100%" }}>Cerrar</Btn>
          </div>
        )}

        {/* ══ UPLOADING ══ */}
        {step === "uploading" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 14 }}><Spinner /></div>
            <InfoBox color={C.accent}>{uploadProgress || "Subiendo fotos..."}</InfoBox>
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
            <Btn onClick={onClose} color={C.green} style={{ width: "100%" }}>Cerrar</Btn>
          </div>
        )}

      </Card>
    </div>
  );
};
