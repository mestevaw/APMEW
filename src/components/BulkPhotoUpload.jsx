// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: 1
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { extractPhotoMetadata } from "../lib/photoOCR";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { DRIVE_ROOT_FOLDER } from "../lib/config";

export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [currentStep, setCurrentStep] = useState("select"); // select, review, upload
  const [processStatus, setProcessStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

  const activeProps = PROPERTIES.filter(p => !p.sold);

  // Procesar fotos con OCR
  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setProcessing(true);
    setCurrentStep("processing");
    const processed = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessStatus(`Procesando ${i + 1}/${files.length}: ${file.name}...`);
      
      const metadata = await extractPhotoMetadata(file, activeProps);
      processed.push({
        file,
        ...metadata,
        // Estado editable
        selectedProperty: metadata.matchedProperty,
        selectedDate: metadata.date,
        error: null,
      });
    }

    setPhotos(processed);
    setProcessing(false);
    setCurrentStep("review");
    setProcessStatus("");
  };

  // Subir fotos confirmadas
  const handleUploadAll = async () => {
    if (!drive?.uploadPhotos || !drive?.searchFolderByAddress) return;
    
    setUploading(true);
    setCurrentStep("upload");
    
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
    };

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (!photo.selectedProperty || !photo.selectedDate) {
        results.failed++;
        continue;
      }

      try {
        setUploadStatus(`Subiendo ${i + 1}/${photos.length}: ${photo.fileName}...`);
        
        // Buscar carpeta de la propiedad
        const propFolder = await drive.searchFolderByAddress(
          photo.selectedProperty.address,
          photo.selectedProperty.owner,
          DRIVE_ROOT_FOLDER
        );

        if (!propFolder) {
          results.failed++;
          continue;
        }

        // Subir foto con fecha custom
        await drive.uploadPhotos(
          [photo.file],
          propFolder.id,
          photo.selectedProperty.address,
          null, // onProgress
          photo.selectedDate
        );

        results.success++;
      } catch (err) {
        console.error("[BulkUpload] Error uploading:", err);
        results.failed++;
      }
    }

    setUploading(false);
    setUploadStatus(`✓ Completado: ${results.success} subidas, ${results.failed} fallidas`);
    
    setTimeout(() => {
      if (onComplete) onComplete(results);
      onClose();
    }, 2000);
  };

  // Actualizar propiedad seleccionada
  const updatePhotoProperty = (index, property) => {
    const updated = [...photos];
    updated[index].selectedProperty = property;
    setPhotos(updated);
  };

  // Actualizar fecha seleccionada
  const updatePhotoDate = (index, dateString) => {
    const updated = [...photos];
    const newDate = new Date(dateString);
    updated[index].selectedDate = newDate;
    setPhotos(updated);
  };

  // Quitar foto de la lista
  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: mob ? 12 : 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, maxWidth: 900, width: "100%",
        maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: mob ? "16px 16px 12px" : "20px 24px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 20, fontWeight: 700, color: C.text, margin: 0 }}>
              📸 Subir Fotos Masivamente
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, margin: "4px 0 0" }}>
              {currentStep === "select" && "Selecciona múltiples fotos con sello de agua"}
              {currentStep === "processing" && "Procesando fotos..."}
              {currentStep === "review" && `${photos.length} fotos procesadas - revisa y confirma`}
              {currentStep === "upload" && "Subiendo a Google Drive..."}
            </p>
          </div>
          <button onClick={onClose} disabled={processing || uploading} style={{
            background: "none", border: "none", cursor: "pointer",
            color: C.textMuted, padding: 4,
          }}>
            {I.close || "✕"}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: mob ? 16 : 24 }}>
          
          {/* Step 1: Select files */}
          {currentStep === "select" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                style={{ display: "none" }}
              />
              <div style={{ fontSize: 64, marginBottom: 16 }}>📁</div>
              <button onClick={() => fileInputRef.current?.click()} style={{
                padding: "12px 24px",
                background: C.accent,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "DM Sans",
                fontSize: 14,
                fontWeight: 600,
              }}>
                Seleccionar Fotos
              </button>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 16 }}>
                Selecciona múltiples fotos que tengan sello de agua con fecha y dirección
              </p>
            </div>
          )}

          {/* Step 2: Processing */}
          {currentStep === "processing" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginTop: 16 }}>
                {processStatus}
              </p>
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === "review" && (
            <div>
              <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={handleUploadAll} disabled={photos.length === 0} style={{
                  padding: "10px 20px",
                  background: C.green,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  ✓ Subir Todas ({photos.length})
                </button>
                <button onClick={onClose} style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: C.textDim,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                }}>
                  Cancelar
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {photos.map((photo, idx) => (
                  <Card key={idx} style={{ padding: mob ? 12 : 16 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* Thumbnail */}
                      <img
                        src={URL.createObjectURL(photo.file)}
                        alt={photo.fileName}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                        }}
                      />

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                          {photo.fileName}
                        </div>

                        {/* Property selector */}
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 4 }}>
                            Propiedad:
                          </label>
                          <select
                            value={photo.selectedProperty?.address || ""}
                            onChange={(e) => {
                              const prop = activeProps.find(p => p.address === e.target.value);
                              updatePhotoProperty(idx, prop);
                            }}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              fontFamily: "DM Sans",
                              fontSize: 13,
                              border: `1px solid ${photo.selectedProperty ? C.border : C.red}`,
                              borderRadius: 6,
                              background: C.surface2,
                              color: C.text,
                            }}
                          >
                            <option value="">-- Selecciona propiedad --</option>
                            {activeProps.map(p => (
                              <option key={p.address} value={p.address}>
                                {p.address} ({p.owner})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Date selector */}
                        <div>
                          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 4 }}>
                            Fecha de inspección:
                          </label>
                          <input
                            type="date"
                            value={photo.selectedDate ? photo.selectedDate.toISOString().slice(0, 10) : ""}
                            onChange={(e) => updatePhotoDate(idx, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              fontFamily: "DM Sans",
                              fontSize: 13,
                              border: `1px solid ${photo.selectedDate ? C.border : C.red}`,
                              borderRadius: 6,
                              background: C.surface2,
                              color: C.text,
                            }}
                          />
                        </div>

                        {/* OCR info */}
                        {photo.address && (
                          <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted, fontFamily: "DM Sans" }}>
                            OCR detectó: {photo.address}
                            {photo.matchedProperty && ` ✓ Match automático`}
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
                      <button onClick={() => removePhoto(idx)} style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.red,
                        padding: 4,
                        fontSize: 18,
                      }}>
                        ✕
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Uploading */}
          {currentStep === "upload" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginTop: 16 }}>
                {uploadStatus}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
