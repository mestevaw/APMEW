// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V3
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - Título: "Subir un Batch de Fotos"
// - Info de debug detallada en review
// - Info de debug DURANTE procesamiento
// - Se detiene si no encuentra match
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { extractPhotoMetadata } from "../lib/photoOCR";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaInsert } from "../lib/supabase";

export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [currentStep, setCurrentStep] = useState("select"); // select, review, upload
  const [processStatus, setProcessStatus] = useState("");
  const [debugInfo, setDebugInfo] = useState(null); // ✅ Nuevo: info de debug en tiempo real
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
      setProcessStatus(`Procesando foto ${i + 1} de ${files.length}...`);
      
      const metadata = await extractPhotoMetadata(file, activeProps);
      
      // ✅ Extraer número para mostrar
      const numMatch = metadata.address?.match(/^\d+/);
      const detectedNumber = numMatch ? numMatch[0] : "No detectado";
      
      // ✅ Actualizar debug info en tiempo real
      setDebugInfo({
        fileName: file.name,
        detectedNumber,
        ocrAddress: metadata.address || "No se pudo leer dirección",
        matchedProperty: metadata.matchedProperty?.address || null,
        photoNumber: i + 1,
        totalPhotos: files.length,
      });
      
      // ✅ Pausa de 1 segundo para que se vea el debug
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
    setDebugInfo(null);
  };

  // Registrar folders y archivos en Supabase
  const registerInSupabase = async (dateFolder, yearFolder, inspeccionFolder, results, propertyAddress, propFolderId) => {
    try {
      // Obtener base path
      let basePath = "";
      try {
        const parentRows = await supaFetch("drive_folders", { 
          filters: `google_drive_id=eq.${propFolderId}` 
        });
        if (parentRows && parentRows[0]) basePath = parentRows[0].folder_path;
      } catch (e) { 
        console.error("[BulkUpload] lookup parent path:", e); 
      }
      if (!basePath) basePath = `PROPERTY > ${propertyAddress}`;

      const inspecPath = `${basePath}/${inspeccionFolder.name}`;
      const yearPath = `${inspecPath}/${yearFolder.name}`;
      const datePath = `${yearPath}/${dateFolder.name}`;

      // Registrar folders
      for (const f of [
        { name: inspeccionFolder.name, id: inspeccionFolder.id, parent: propFolderId, path: inspecPath },
        { name: yearFolder.name, id: yearFolder.id, parent: inspeccionFolder.id, path: yearPath },
        { name: dateFolder.name, id: dateFolder.id, parent: yearFolder.id, path: datePath },
      ]) {
        try {
          const exists = await supaFetch("drive_folders", { 
            filters: `google_drive_id=eq.${f.id}` 
          });
          if (!exists || exists.length === 0) {
            await supaInsert("drive_folders", { 
              name: f.name, 
              google_drive_id: f.id, 
              parent_drive_id: f.parent, 
              folder_path: f.path 
            });
          }
        } catch (e) { 
          console.error("[BulkUpload] folder register:", e); 
        }
      }

      // Registrar archivos
      for (const r of results) {
        if (r.skipped) continue; // No registrar duplicados
        try {
          const ext = (r.name || "").split(".").pop().toLowerCase();
          const mimeMap = { 
            jpg: "image/jpeg", 
            jpeg: "image/jpeg", 
            png: "image/png", 
            heic: "image/heic", 
            webp: "image/webp" 
          };
          await supaInsert("documents", {
            title: r.name, 
            google_drive_file_id: r.id,
            parent_folder_drive_id: dateFolder.id,
            folder_path: datePath,
            category: "inspeccion",
            mime_type: mimeMap[ext] || r.mimeType || "image/jpeg",
            file_type: ext || "jpg",
          });
        } catch (e) { 
          console.error("[BulkUpload] doc register:", e); 
        }
      }
    } catch (err) {
      console.error("[BulkUpload] registerInSupabase error:", err);
    }
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
        const uploadResult = await drive.uploadPhotos(
          [photo.file],
          propFolder.id,
          photo.selectedProperty.address,
          null, // onProgress
          photo.selectedDate
        );

        // Registrar en Supabase
        if (uploadResult?.dateFolder && uploadResult?.yearFolder && uploadResult?.inspeccionFolder && uploadResult?.results) {
          setUploadStatus(`Indexando ${i + 1}/${photos.length}...`);
          await registerInSupabase(
            uploadResult.dateFolder,
            uploadResult.yearFolder,
            uploadResult.inspeccionFolder,
            uploadResult.results,
            photo.selectedProperty.address,
            propFolder.id
          );
        }

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
              📸 Subir un Batch de Fotos
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

          {/* Step 2: Processing con DEBUG INFO */}
          {currentStep === "processing" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginTop: 16, marginBottom: 20 }}>
                {processStatus}
              </p>
              
              {/* ✅ DEBUG INFO en tiempo real */}
              {debugInfo && (
                <div style={{ 
                  maxWidth: 500, 
                  margin: "0 auto",
                  padding: 16, 
                  background: C.surface2, 
                  borderRadius: 8,
                  border: `1px solid ${debugInfo.matchedProperty ? C.green : C.red}`,
                  textAlign: "left",
                }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                    📸 {debugInfo.fileName}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Número detectado */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                      <span style={{ color: C.textDim }}>🔢 Número detectado:</span>
                      <span style={{ fontWeight: 600, color: debugInfo.detectedNumber !== "No detectado" ? C.green : C.red }}>
                        {debugInfo.detectedNumber}
                      </span>
                    </div>
                    
                    {/* Dirección OCR */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                      <span style={{ color: C.textDim }}>📍 OCR leyó:</span>
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {debugInfo.ocrAddress}
                      </span>
                    </div>
                    
                    {/* Match encontrado */}
                    <div style={{ 
                      marginTop: 8, 
                      padding: "8px 10px", 
                      background: debugInfo.matchedProperty ? `${C.green}15` : `${C.red}15`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "DM Sans",
                    }}>
                      {debugInfo.matchedProperty ? (
                        <>
                          <div style={{ fontWeight: 600, color: C.green, marginBottom: 4 }}>
                            ✅ Match encontrado
                          </div>
                          <div style={{ color: C.text }}>
                            🏠 {debugInfo.matchedProperty}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 600, color: C.red }}>
                          ❌ No se encontró match con ninguna propiedad
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

                        {/* ✅ DEBUG: Info detallada del OCR */}
                        <div style={{ 
                          marginTop: 8, 
                          padding: "8px 10px", 
                          background: photo.matchedProperty ? `${C.green}10` : `${C.red}10`,
                          border: `1px solid ${photo.matchedProperty ? C.green : C.red}40`,
                          borderRadius: 6 
                        }}>
                          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: photo.matchedProperty ? C.green : C.red, marginBottom: 4 }}>
                            {photo.matchedProperty ? "✅ Match automático encontrado" : "❌ Sin match automático"}
                          </div>
                          
                          {/* Número detectado */}
                          {(() => {
                            const numMatch = photo.address?.match(/^\d+/);
                            return numMatch ? (
                              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 2 }}>
                                🔢 Número detectado: <span style={{ fontWeight: 600, color: C.text }}>{numMatch[0]}</span>
                              </div>
                            ) : null;
                          })()}
                          
                          {/* Dirección completa OCR */}
                          {photo.address && (
                            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 2 }}>
                              📍 OCR leyó: <span style={{ fontWeight: 600, color: C.text }}>{photo.address}</span>
                            </div>
                          )}
                          
                          {/* Propiedad auto-seleccionada */}
                          {photo.matchedProperty && (
                            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>
                              🏠 Auto-seleccionado: <span style={{ fontWeight: 600, color: C.green }}>{photo.matchedProperty.address}</span>
                            </div>
                          )}
                          
                          {/* Mensaje si no hay match */}
                          {!photo.matchedProperty && photo.address && (
                            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.red, marginTop: 4 }}>
                              ⚠️ Selecciona manualmente la propiedad correcta
                            </div>
                          )}
                          
                          {/* Si no detectó nada */}
                          {!photo.address && (
                            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.red }}>
                              ⚠️ OCR no pudo detectar dirección en la foto
                            </div>
                          )}
                        </div>
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
