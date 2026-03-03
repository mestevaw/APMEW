// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V9 SIMPLIFICADA
// Fecha: 2026-03-03
// ═══════════════════════════════════════════
// CAMBIOS: USA drive.uploadPhotos() - NO reimplementa nada
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { findFolderByAddress } from "../pages/dashboard/helpers";
import { MONTHS_ES } from "../lib/helpers";

export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [currentStep, setCurrentStep] = useState("select");
  const [uploadStatus, setUploadStatus] = useState("");
  
  const [groupProperty, setGroupProperty] = useState(null);
  const [groupDate, setGroupDate] = useState(new Date().toISOString().slice(0, 10));
  
  const fileInputRef = useRef(null);
  const activeProps = PROPERTIES.filter(p => !p.sold);

  // Paso 1: Seleccionar archivos
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setProcessing(true);
    const photoList = files.map((file, idx) => ({
      id: `photo_${Date.now()}_${idx}`,
      file,
      name: file.name,
      selectedProperty: null,
      selectedDate: new Date(),
    }));

    setPhotos(photoList);
    setProcessing(false);
    setCurrentStep("assign");
  };

  // Paso 2: Asignar propiedad y fecha a todas
  const handleGroupAssign = () => {
    if (!groupProperty || !groupDate) {
      alert("Selecciona propiedad y fecha");
      return;
    }

    const updated = photos.map(p => ({
      ...p,
      selectedProperty: groupProperty,
      selectedDate: new Date(groupDate + "T12:00:00"),
    }));

    setPhotos(updated);
    setCurrentStep("upload");
  };

  // Paso 3: Subir usando drive.uploadPhotos
  const handleUploadAll = async () => {
    if (!groupProperty || !groupDate) return;

    setUploading(true);
    setUploadStatus("Buscando carpeta de la propiedad...");

    try {
      // 1. Buscar folderId
      let propFolderId = groupProperty.folderId;
      
      if (!propFolderId) {
        console.log("[BulkUpload] Buscando folderId en Supabase...");
        const folder = await findFolderByAddress(groupProperty.address, groupProperty.owner);
        if (!folder || !folder.google_drive_id) {
          throw new Error(`No se encontró la carpeta de Google Drive para ${groupProperty.address}`);
        }
        propFolderId = folder.google_drive_id;
      }

      console.log("[BulkUpload] Usando folderId:", propFolderId);

      // 2. Construir ruta esperada
      const uploadDate = new Date(groupDate + "T12:00:00");
      const year = uploadDate.getFullYear();
      const dateName = `${uploadDate.getDate()} ${MONTHS_ES[uploadDate.getMonth()]} ${String(year).slice(2)}`;
      const expectedPath = `${groupProperty.address} > Inspecciones > ${year} > ${dateName}`;

      console.log("[BulkUpload] 📂 Ruta esperada:", expectedPath);
      setUploadStatus(`📂 ${expectedPath}`);

      // 3. PEDIR CONFIRMACIÓN
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para que vea la ruta
      
      const userConfirm = window.confirm(
        `¿Subir ${photos.length} fotos a esta ruta?\n\n${expectedPath}\n\n` +
        `Se creará automáticamente si no existe.`
      );

      if (!userConfirm) {
        setUploadStatus("Cancelado por el usuario");
        setUploading(false);
        return;
      }

      // 4. SUBIR usando drive.uploadPhotos (hace TODO automáticamente)
      setUploadStatus("Subiendo fotos...");
      
      const { results, skipped = 0 } = await drive.uploadPhotos(
        photos.map(p => p.file),
        propFolderId,
        groupProperty.address,
        (i, total, name) => setUploadStatus(`Subiendo ${i}/${total}: ${name}`),
        uploadDate
      );

      const successCount = results.filter(r => !r.skipped).length;
      
      console.log("[BulkUpload] ✅ Subida completada:", { success: successCount, skipped });
      
      onComplete({ success: successCount, failed: 0 });
      onClose();
      
    } catch (err) {
      console.error("[BulkUpload] Error:", err);
      setUploadStatus(`❌ Error: ${err.message}`);
      alert(`Error: ${err.message}`);
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: mob ? 16 : 40,
    }}>
      <Card style={{
        maxWidth: 600, width: "100%", maxHeight: mob ? "90vh" : "80vh",
        overflow: "auto", padding: mob ? 20 : 32, position: "relative",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 20, fontWeight: 700, color: C.text }}>
            📤 Subir Batch de Fotos
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: C.textDim, fontSize: 24, padding: 0,
          }}>
            ✕
          </button>
        </div>

        {/* Step 1: Select */}
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
              disabled={processing}
              style={{
                width: "100%",
                padding: "60px 20px",
                background: C.surface2,
                border: `2px dashed ${C.border}`,
                borderRadius: 12,
                cursor: processing ? "not-allowed" : "pointer",
                fontFamily: "DM Sans",
                fontSize: 16,
                color: C.accent,
                fontWeight: 600,
              }}
            >
              {processing ? "Procesando..." : "📁 Seleccionar Fotos"}
            </button>
          </div>
        )}

        {/* Step 2: Assign */}
        {currentStep === "assign" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: "DM Sans",
                fontSize: 14,
                color: C.text,
                marginBottom: 16,
              }}>
                {photos.length} fotos seleccionadas
              </div>

              {/* Propiedad */}
              <label style={{
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: 600,
                color: C.textDim,
                display: "block",
                marginBottom: 8,
              }}>
                Propiedad:
              </label>
              <select
                value={groupProperty?.address || ""}
                onChange={(e) => {
                  const prop = activeProps.find(p => p.address === e.target.value);
                  setGroupProperty(prop);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: 16,
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.surface2,
                  color: C.text,
                }}
              >
                <option value="">Selecciona una propiedad</option>
                {activeProps.map(p => (
                  <option key={p.address} value={p.address}>
                    {p.address}
                  </option>
                ))}
              </select>

              {/* Fecha */}
              <label style={{
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: 600,
                color: C.textDim,
                display: "block",
                marginBottom: 8,
              }}>
                Fecha de inspección:
              </label>
              <input
                type="date"
                value={groupDate}
                onChange={(e) => setGroupDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.surface2,
                  color: "#FFFFFF",
                  colorScheme: "dark",
                }}
              />
            </div>

            <button
              onClick={handleGroupAssign}
              disabled={!groupProperty || !groupDate}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: groupProperty && groupDate ? C.accent : C.border,
                color: groupProperty && groupDate ? "white" : C.textDim,
                border: "none",
                borderRadius: 8,
                cursor: groupProperty && groupDate ? "pointer" : "not-allowed",
                fontFamily: "DM Sans",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 3: Upload */}
        {currentStep === "upload" && (
          <div>
            {uploading ? (
              <div>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <Spinner />
                </div>
                <div style={{
                  padding: 16,
                  background: C.surface2,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: C.text,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {uploadStatus}
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  color: C.text,
                  marginBottom: 16,
                }}>
                  Listo para subir {photos.length} fotos a:<br/>
                  <strong>{groupProperty?.address}</strong><br/>
                  Fecha: {new Date(groupDate).toLocaleDateString("es-MX")}
                </div>

                <button
                  onClick={handleUploadAll}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    background: C.accent,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  📤 Subir Ahora
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
