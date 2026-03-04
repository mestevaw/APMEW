// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V10 — Navegación Paso a Paso con Confirmaciones
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// CAMBIOS EN V10:
// - Flujo de navegación de directorios con pausas y confirmaciones
// - Se detiene antes de crear cualquier directorio y pide autorización
// - Muestra la ruta exacta del directorio creado y espera verificación
// - Upload manual usando drive.uploadFile (sin auto-create de uploadPhotos)
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { MONTHS_ES } from "../lib/helpers";

// ─── Botón reutilizable ───
const Btn = ({ onClick, disabled, color, children, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "11px 20px",
      background: disabled ? C.border : (color || C.accent),
      color: disabled ? C.textDim : "white",
      border: "none",
      borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "DM Sans",
      fontSize: 14,
      fontWeight: 600,
      transition: "opacity 0.15s",
      ...style,
    }}
  >
    {children}
  </button>
);

// ─── Caja de estado / info ───
const InfoBox = ({ color, children }) => (
  <div style={{
    padding: "14px 16px",
    background: `${color || C.accent}12`,
    border: `1px solid ${color || C.accent}40`,
    borderRadius: 10,
    fontFamily: "DM Sans",
    fontSize: 13,
    color: C.text,
    lineHeight: 1.6,
    marginBottom: 16,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  }}>
    {children}
  </div>
);

export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {
  // ─── Pasos: select → assign → nav_finding → confirm_create → created_notice → upload_ready → uploading ───
  const [currentStep, setCurrentStep] = useState("select");
  const [photos, setPhotos]           = useState([]);
  const [groupProperty, setGroupProperty] = useState(null);
  const [groupDate, setGroupDate]         = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus]               = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadDone, setUploadDone]         = useState(null); // { success, skipped }

  // ─── Estado de navegación de directorios ───
  const [pendingCreate, setPendingCreate] = useState(null);
  // { name: string, parentId: string, parentPath: string, phase: 0|1|2 }

  const [lastCreated, setLastCreated] = useState(null);
  // { name: string, id: string, fullPath: string }

  // ─── Refs para IDs de carpetas ya encontradas/creadas ───
  const propFolderRef    = useRef(null); // { id, name }
  const inspecFolderRef  = useRef(null); // { id, name }
  const yearFolderRef    = useRef(null); // { id, name }
  const dateFolderRef    = useRef(null); // { id, name }

  // Función a llamar cuando el usuario hace click en "Verificado, Continuar"
  const continueNavRef = useRef(null);

  const fileInputRef = useRef(null);
  const activeProps = PROPERTIES.filter(p => !p.sold);

  // ─── Helpers de fecha ───
  const getUploadDate = () => new Date(groupDate + "T12:00:00");
  const getYear       = () => getUploadDate().getFullYear().toString();
  const getDateName   = () => {
    const d = getUploadDate();
    return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  };

  // ══════════════════════════════════════════
  // Paso 1: Seleccionar archivos
  // ══════════════════════════════════════════
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const photoList = files.map((file, idx) => ({
      id: `photo_${Date.now()}_${idx}`,
      file,
      name: file.name,
    }));
    setPhotos(photoList);
    setCurrentStep("assign");
  };

  // ══════════════════════════════════════════
  // Paso 2: Asignar propiedad y fecha → iniciar navegación
  // ══════════════════════════════════════════
  const handleGroupAssign = async () => {
    if (!groupProperty || !groupDate) {
      alert("Selecciona propiedad y fecha");
      return;
    }
    setCurrentStep("nav_finding");
    setStatus("Buscando carpeta de la propiedad en Supabase...");

    try {
      // 1. Buscar carpeta raíz de la propiedad en Supabase
      const supaFolder = await findFolderByAddress(groupProperty.address, groupProperty.owner);
      if (!supaFolder?.google_drive_id) {
        setStatus(`❌ No se encontró carpeta en Supabase para:\n${groupProperty.address}\n\nVincúlala manualmente primero.`);
        setCurrentStep("nav_error");
        return;
      }

      propFolderRef.current = { id: supaFolder.google_drive_id, name: groupProperty.address };
      console.log("[BulkUpload] Carpeta propiedad:", propFolderRef.current);

      // 2. Continuar buscando INSPECCION
      await navigateInspeccion();

    } catch (err) {
      console.error("[BulkUpload] Error en navegación:", err);
      setStatus(`❌ Error: ${err.message}`);
      setCurrentStep("nav_error");
    }
  };

  // ══════════════════════════════════════════
  // Navegación: Fase 0 — Buscar INSPECCION
  // ══════════════════════════════════════════
  const navigateInspeccion = async () => {
    setCurrentStep("nav_finding");
    setStatus("Buscando carpeta de inspecciones...");

    const found = await drive.findSubfolder(propFolderRef.current.id, "INSPEC");
    if (found) {
      inspecFolderRef.current = { id: found.id, name: found.name };
      console.log("[BulkUpload] Carpeta inspección encontrada:", found.name);
      await navigateYear();
    } else {
      // Pausar y pedir confirmación
      setPendingCreate({
        name: "INSPECCION",
        parentId: propFolderRef.current.id,
        parentPath: groupProperty.address,
        phase: 0,
      });
      continueNavRef.current = navigateYear;
      setCurrentStep("confirm_create");
    }
  };

  // ══════════════════════════════════════════
  // Navegación: Fase 1 — Buscar año
  // ══════════════════════════════════════════
  const navigateYear = async () => {
    setCurrentStep("nav_finding");
    const year = getYear();
    setStatus(`Buscando carpeta del año ${year}...`);

    const found = await drive.findSubfolder(inspecFolderRef.current.id, year);
    if (found) {
      yearFolderRef.current = { id: found.id, name: found.name };
      console.log("[BulkUpload] Carpeta año encontrada:", found.name);
      await navigateDate();
    } else {
      setPendingCreate({
        name: year,
        parentId: inspecFolderRef.current.id,
        parentPath: `${groupProperty.address} > ${inspecFolderRef.current.name}`,
        phase: 1,
      });
      continueNavRef.current = navigateDate;
      setCurrentStep("confirm_create");
    }
  };

  // ══════════════════════════════════════════
  // Navegación: Fase 2 — Buscar fecha
  // ══════════════════════════════════════════
  const navigateDate = async () => {
    setCurrentStep("nav_finding");
    const dateName = getDateName();
    setStatus(`Buscando carpeta de fecha "${dateName}"...`);

    const found = await drive.findSubfolder(yearFolderRef.current.id, dateName);
    if (found) {
      dateFolderRef.current = { id: found.id, name: found.name };
      console.log("[BulkUpload] Carpeta fecha encontrada:", found.name);
      setCurrentStep("upload_ready");
    } else {
      setPendingCreate({
        name: dateName,
        parentId: yearFolderRef.current.id,
        parentPath: `${groupProperty.address} > ${inspecFolderRef.current.name} > ${getYear()}`,
        phase: 2,
      });
      continueNavRef.current = null; // No hay fase siguiente tras la fecha
      setCurrentStep("confirm_create");
    }
  };

  // ══════════════════════════════════════════
  // Confirmar creación de directorio
  // ══════════════════════════════════════════
  const handleConfirmCreate = async () => {
    const { name, parentId, parentPath, phase } = pendingCreate;
    setCurrentStep("nav_finding");
    setStatus(`Creando directorio "${name}"...`);

    try {
      const created = await drive.createFolder(name, parentId);
      const fullPath = `${parentPath} > ${name}`;
      console.log("[BulkUpload] Directorio creado:", name, "id:", created.id, "ruta:", fullPath);

      // Guardar en el ref correspondiente
      if (phase === 0) inspecFolderRef.current = { id: created.id, name };
      else if (phase === 1) yearFolderRef.current  = { id: created.id, name };
      else if (phase === 2) dateFolderRef.current  = { id: created.id, name };

      setLastCreated({ name, id: created.id, fullPath });
      setCurrentStep("created_notice");
    } catch (err) {
      console.error("[BulkUpload] Error creando carpeta:", err);
      setStatus(`❌ Error al crear "${name}": ${err.message}`);
      setCurrentStep("nav_error");
    }
  };

  // ══════════════════════════════════════════
  // Después de verificar el directorio creado
  // ══════════════════════════════════════════
  const handleContinueAfterVerify = async () => {
    const phase = pendingCreate?.phase;
    setLastCreated(null);
    setPendingCreate(null);

    if (phase === 2) {
      // La carpeta de fecha ya está creada, listo para subir
      setCurrentStep("upload_ready");
    } else if (continueNavRef.current) {
      // Continuar con la siguiente fase de navegación
      await continueNavRef.current();
    } else {
      setCurrentStep("upload_ready");
    }
  };

  // ══════════════════════════════════════════
  // Subir fotos
  // ══════════════════════════════════════════
  const handleUploadAll = async () => {
    if (!dateFolderRef.current?.id) return;
    setCurrentStep("uploading");

    try {
      const dateFolder = dateFolderRef.current;
      const dateName   = getDateName();
      const shortName  = groupProperty.address.replace(/^\d+\s*/, "").split(/\s+/).slice(0, 2).join(" ");

      // Verificar duplicados
      setUploadProgress("Verificando archivos existentes...");
      const existingFiles = await drive.listAllFiles(dateFolder.id);
      const existingNames = new Set((existingFiles || []).map(f => f.name));
      console.log("[BulkUpload] Archivos existentes en destino:", existingNames.size);

      let success = 0;
      let skippedCount = 0;

      for (let i = 0; i < photos.length; i++) {
        const { file } = photos[i];
        const ext      = file.name.split(".").pop() || "jpg";
        const fileName = `${shortName} ${i + 1} Foto ${dateName}.${ext}`;

        if (existingNames.has(fileName)) {
          skippedCount++;
          setUploadProgress(`⏭️ ${i + 1}/${photos.length}: ${fileName} (ya existe)`);
          continue;
        }

        setUploadProgress(`📤 ${i + 1}/${photos.length}: ${fileName}`);
        await drive.uploadFile(file, fileName, dateFolder.id);
        console.log("[BulkUpload] Subido:", fileName);
        success++;
      }

      console.log("[BulkUpload] ✅ Completado:", { success, skipped: skippedCount });
      setUploadDone({ success, skipped: skippedCount });
      onComplete({ success, failed: 0 });
    } catch (err) {
      console.error("[BulkUpload] Error subiendo:", err);
      setUploadProgress(`❌ Error: ${err.message}`);
    }
  };

  // ─── Ruta completa del destino (para mostrar en "upload_ready") ───
  const destinationPath = [
    groupProperty?.address,
    inspecFolderRef.current?.name,
    yearFolderRef.current?.name,
    dateFolderRef.current?.name,
  ].filter(Boolean).join(" > ");

  // ══════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: mob ? 16 : 40,
    }}>
      <Card style={{
        maxWidth: 580, width: "100%", maxHeight: mob ? "92vh" : "82vh",
        overflow: "auto", padding: mob ? 20 : 32, position: "relative",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 20, fontWeight: 700, color: C.text }}>
            📤 Subir Batch de Fotos
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 24, padding: 0 }}>
            ✕
          </button>
        </div>

        {/* ─────────────────────────────────── */}
        {/* PASO 1: Seleccionar fotos           */}
        {/* ─────────────────────────────────── */}
        {currentStep === "select" && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "60px 20px",
                background: C.surface2,
                border: `2px dashed ${C.border}`,
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "DM Sans",
                fontSize: 16,
                color: C.accent,
                fontWeight: 600,
              }}
            >
              📁 Seleccionar Fotos
            </button>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* PASO 2: Asignar propiedad y fecha   */}
        {/* ─────────────────────────────────── */}
        {currentStep === "assign" && (
          <div>
            <InfoBox color={C.accent}>
              {`📷 ${photos.length} foto${photos.length !== 1 ? "s" : ""} seleccionada${photos.length !== 1 ? "s" : ""}`}
            </InfoBox>

            <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, display: "block", marginBottom: 6 }}>
              Propiedad:
            </label>
            <select
              value={groupProperty?.address || ""}
              onChange={(e) => setGroupProperty(activeProps.find(p => p.address === e.target.value) || null)}
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 16,
                fontFamily: "DM Sans", fontSize: 14, border: `1px solid ${C.border}`,
                borderRadius: 8, background: C.surface2, color: C.text,
              }}
            >
              <option value="">Selecciona una propiedad</option>
              {activeProps.map(p => (
                <option key={p.address} value={p.address}>{p.address}</option>
              ))}
            </select>

            <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.textDim, display: "block", marginBottom: 6 }}>
              Fecha de inspección:
            </label>
            <input
              type="date"
              value={groupDate}
              onChange={(e) => setGroupDate(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 20,
                fontFamily: "DM Sans", fontSize: 14, border: `1px solid ${C.border}`,
                borderRadius: 8, background: C.surface2, color: "#FFFFFF", colorScheme: "dark",
              }}
            />

            <Btn
              onClick={handleGroupAssign}
              disabled={!groupProperty || !groupDate}
              style={{ width: "100%" }}
            >
              Continuar →
            </Btn>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* NAVEGANDO: buscando/creando         */}
        {/* ─────────────────────────────────── */}
        {currentStep === "nav_finding" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 20 }}>
              <Spinner />
            </div>
            <InfoBox color={C.accent}>
              {status || "Navegando estructura de directorios..."}
            </InfoBox>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* CONFIRMAR CREACIÓN de directorio    */}
        {/* ─────────────────────────────────── */}
        {currentStep === "confirm_create" && pendingCreate && (
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 16 }}>
              ⚠️ El siguiente directorio no existe:
            </div>

            <InfoBox color={C.orange}>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: C.orange }}>Directorio a crear:</strong>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 13, color: C.text }}>
                📁 {pendingCreate.name}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: C.textDim }}>
                <strong>Dentro de:</strong><br />
                {pendingCreate.parentPath}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: C.textDim }}>
                <strong>Ruta completa que quedaría:</strong><br />
                <span style={{ fontFamily: "monospace" }}>
                  {pendingCreate.parentPath} &gt; {pendingCreate.name}
                </span>
              </div>
            </InfoBox>

            <div style={{ display: "flex", gap: 12 }}>
              <Btn
                onClick={handleConfirmCreate}
                color={C.green}
                style={{ flex: 1 }}
              >
                ✅ Sí, crear directorio
              </Btn>
              <Btn
                onClick={onClose}
                color={C.red}
                style={{ flex: 1 }}
              >
                ✕ Cancelar
              </Btn>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* AVISO: directorio creado            */}
        {/* ─────────────────────────────────── */}
        {currentStep === "created_notice" && lastCreated && (
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 16 }}>
              ✅ Directorio creado exitosamente. Por favor verifica en Google Drive:
            </div>

            <InfoBox color={C.green}>
              <div style={{ marginBottom: 6 }}>
                <strong style={{ color: C.green }}>📁 Creado:</strong> {lastCreated.name}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                <strong>ID de Drive:</strong>{" "}
                <span style={{ fontFamily: "monospace" }}>{lastCreated.id}</span>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.green}30` }}>
                <strong>Ruta completa:</strong><br />
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                  {lastCreated.fullPath}
                </span>
              </div>
            </InfoBox>

            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              Verifica en Google Drive que el directorio se haya creado correctamente, luego haz click en Continuar.
            </div>

            <Btn
              onClick={handleContinueAfterVerify}
              color={C.accent}
              style={{ width: "100%" }}
            >
              Verificado — Continuar →
            </Btn>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* ERROR de navegación                 */}
        {/* ─────────────────────────────────── */}
        {currentStep === "nav_error" && (
          <div>
            <InfoBox color={C.red}>
              {status}
            </InfoBox>
            <Btn onClick={onClose} color={C.red} style={{ width: "100%" }}>
              Cerrar
            </Btn>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* LISTO PARA SUBIR                    */}
        {/* ─────────────────────────────────── */}
        {currentStep === "upload_ready" && (
          <div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 16 }}>
              ✅ Estructura de directorios verificada. Listo para subir:
            </div>

            <InfoBox color={C.green}>
              <div style={{ marginBottom: 8 }}>
                <strong>📷 Fotos:</strong> {photos.length}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>📁 Destino:</strong>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: C.text, paddingLeft: 8 }}>
                {destinationPath}
              </div>
            </InfoBox>

            <Btn
              onClick={handleUploadAll}
              color={C.accent}
              style={{ width: "100%" }}
            >
              📤 Subir {photos.length} Foto{photos.length !== 1 ? "s" : ""} Ahora
            </Btn>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* SUBIENDO                            */}
        {/* ─────────────────────────────────── */}
        {currentStep === "uploading" && !uploadDone && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <Spinner />
            </div>
            <InfoBox color={C.accent}>
              {uploadProgress || "Preparando subida..."}
            </InfoBox>
          </div>
        )}

        {/* ─────────────────────────────────── */}
        {/* COMPLETADO                          */}
        {/* ─────────────────────────────────── */}
        {currentStep === "uploading" && uploadDone && (
          <div>
            <InfoBox color={C.green}>
              <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 700, color: C.green }}>
                ✅ ¡Subida completada!
              </div>
              <div>📤 Subidas nuevas: <strong>{uploadDone.success}</strong></div>
              {uploadDone.skipped > 0 && (
                <div>⏭️ Ya existían: <strong>{uploadDone.skipped}</strong></div>
              )}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.green}30`, fontSize: 12, color: C.textDim }}>
                <strong>Destino:</strong><br />
                <span style={{ fontFamily: "monospace" }}>{destinationPath}</span>
              </div>
            </InfoBox>
            <Btn onClick={onClose} color={C.green} style={{ width: "100%" }}>
              Cerrar
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
};
