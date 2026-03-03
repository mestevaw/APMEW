// ═══════════════════════════════════════════
// Archivo: src/components/BulkPhotoUpload.jsx
// Versión: V7 Final
// Fecha: 2026-03-03
// ═══════════════════════════════════════════
// CAMBIOS EN V7 Final:
// - Calendario blanco (color: #FFFFFF + colorScheme: dark)
// - Busca folderId en Supabase usando findFolderByAddress
// - Si no está en constants.js, lo busca dinámicamente
// - Error claro si la carpeta no existe en Drive
// - SOLUCIONA: "Cannot read properties of undefined"
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { extractPhotoMetadata } from "../lib/photoOCR";
import { Card, Spinner } from "./UI";
import { PROPERTIES } from "../pages/dashboard/constants";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { supaFetch, supaInsert } from "../lib/supabase";
import { findFolderByAddress } from "../pages/dashboard/helpers"; // ✅ IMPORTAR

// ✅ Componente Autocomplete
const PropertyAutocomplete = ({ value, onChange, activeProps }) => {
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);

  const filtered = search.trim()
    ? activeProps.filter(p =>
        p.address.toLowerCase().includes(search.toLowerCase()) ||
        p.owner.toLowerCase().includes(search.toLowerCase())
      )
    : activeProps;

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Escribe para buscar (ej: 116, mid, MNA)..."
        value={value ? value.address : search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShow(true);
          if (!e.target.value) onChange(null);
        }}
        onFocus={() => setShow(true)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: "DM Sans",
          fontSize: 14,
          border: `2px solid ${value ? C.green : C.border}`,
          borderRadius: 8,
          background: C.surface2,
          color: C.text,
        }}
      />

      {show && filtered.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 4,
          maxHeight: 300,
          overflow: "auto",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 1000,
        }}>
          {filtered.slice(0, 10).map(prop => (
            <button
              key={prop.address}
              onClick={() => {
                onChange(prop);
                setSearch(prop.address);
                setShow(false);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                cursor: "pointer",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: C.text,
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{ fontWeight: 600 }}>{prop.address}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{prop.owner}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ✅ Date Picker simple (solo calendario)
const DatePickerEnhanced = ({ value, onChange }) => {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <input
      type="date"
      value={value || today}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "10px 12px",
        fontFamily: "DM Sans",
        fontSize: 14,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: C.surface2,
        color: "#FFFFFF", // ✅ Blanco para visibilidad
        colorScheme: "dark", // ✅ Para que el calendario sea visible
      }}
    />
  );
};

export const BulkPhotoUpload = ({ drive, onClose, onComplete, mob }) => {
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [currentStep, setCurrentStep] = useState("select");
  const [processStatus, setProcessStatus] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadDebug, setUploadDebug] = useState(null); // ✅ Debug info durante upload
  
  const [groupProperty, setGroupProperty] = useState(null);
  const [groupDate, setGroupDate] = useState(new Date().toISOString().slice(0, 10));
  
  const fileInputRef = useRef(null);
  const activeProps = PROPERTIES.filter(p => !p.sold);

  // ✅ Helper: Buscar o crear folder en Google Drive
  const getOrCreateFolder = async (folderName, parentId, updateDebug = true) => {
    try {
      console.log(`[getOrCreateFolder] Buscando: ${folderName} en parent: ${parentId}`);
      
      if (updateDebug) {
        setUploadDebug(prev => ({
          ...prev,
          action: "Buscando carpeta",
          folder: folderName,
          status: "searching",
        }));
      }
      
      // Buscar si ya existe
      const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.result.files && response.result.files.length > 0) {
        console.log(`[getOrCreateFolder] ✅ Encontrado: ${response.result.files[0].id}`);
        
        if (updateDebug) {
          setUploadDebug(prev => ({
            ...prev,
            action: "Carpeta encontrada",
            folder: folderName,
            folderId: response.result.files[0].id,
            status: "found",
          }));
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return response.result.files[0];
      }

      // Crear si no existe
      console.log(`[getOrCreateFolder] ❌ No existe, creando...`);
      
      if (updateDebug) {
        setUploadDebug(prev => ({
          ...prev,
          action: "Creando carpeta",
          folder: folderName,
          status: "creating",
        }));
      }
      
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };
      const createResponse = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name',
      });
      console.log(`[getOrCreateFolder] ✅ Creado: ${createResponse.result.id}`);
      
      if (updateDebug) {
        setUploadDebug(prev => ({
          ...prev,
          action: "Carpeta creada",
          folder: folderName,
          folderId: createResponse.result.id,
          status: "created",
        }));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return createResponse.result;
    } catch (err) {
      console.error("[getOrCreateFolder] error:", err);
      
      if (updateDebug) {
        setUploadDebug(prev => ({
          ...prev,
          action: "Error en carpeta",
          folder: folderName,
          error: err.message,
          status: "error",
        }));
      }
      
      throw err;
    }
  };

  // ✅ Helper: Upload file a Google Drive
  const uploadFileToDrive = async (file, folderId) => {
    try {
      console.log(`[uploadFileToDrive] Subiendo: ${file.name} a folder: ${folderId}`);
      
      setUploadDebug(prev => ({
        ...prev,
        action: "Subiendo archivo",
        fileName: file.name,
        folderId: folderId,
        status: "uploading",
      }));
      
      const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: [folderId],
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${window.gapi.auth.getToken().access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`[uploadFileToDrive] ✅ Subido: ${result.id}`);
      
      setUploadDebug(prev => ({
        ...prev,
        action: "Archivo subido",
        fileName: file.name,
        fileId: result.id,
        status: "uploaded",
      }));
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return result;
    } catch (err) {
      console.error("[uploadFileToDrive] error:", err);
      
      setUploadDebug(prev => ({
        ...prev,
        action: "Error al subir",
        fileName: file.name,
        error: err.message,
        status: "error",
      }));
      
      throw err;
    }
  };

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
      
      const numMatch = metadata.address?.match(/^\d+/);
      const detectedNumber = numMatch ? numMatch[0] : "No detectado";
      
      setDebugInfo({
        fileName: file.name,
        detectedNumber,
        ocrAddress: metadata.address || "No se pudo leer dirección",
        matchedProperty: metadata.matchedProperty?.address || null,
        photoNumber: i + 1,
        totalPhotos: files.length,
      });
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      processed.push({
        file,
        ...metadata,
        selectedProperty: metadata.matchedProperty,
        selectedDate: metadata.date,
        error: null,
      });
    }

    setPhotos(processed);
    setProcessing(false);
    setDebugInfo(null);

    const photosWithoutMatch = processed.filter(p => !p.selectedProperty);
    if (photosWithoutMatch.length > 0) {
      setCurrentStep("group-assign");
    } else {
      setCurrentStep("review");
    }
  };

  // Aplicar propiedad y fecha a todas las fotos sin match
  const handleApplyToAll = () => {
    if (!groupProperty) {
      alert("Selecciona una propiedad primero");
      return;
    }

    const updated = photos.map(p => 
      !p.selectedProperty 
        ? { ...p, selectedProperty: groupProperty, selectedDate: new Date(groupDate) }
        : p
    );
    setPhotos(updated);
    setCurrentStep("review");
  };

  // Registrar folders y archivos en Supabase
  const registerInSupabase = async (dateFolder, yearFolder, inspeccionFolder, results, propertyAddress, propFolderId) => {
    try {
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

      for (const r of results) {
        if (r.skipped) continue;
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

  // ✅ Subir todas las fotos (CORREGIDO con búsqueda de folderId)
  const handleUploadAll = async () => {
    const hasInvalid = photos.some(p => !p.selectedProperty || !p.selectedDate);
    if (hasInvalid) {
      alert("Todas las fotos deben tener propiedad y fecha asignadas");
      return;
    }

    setUploading(true);
    setCurrentStep("upload");
    setUploadDebug({
      property: "",
      path: "",
      action: "Buscando carpetas en Google Drive...",
      status: "starting",
    });

    let successCount = 0;
    let failCount = 0;

    try {
      // Agrupar fotos por propiedad y fecha
      const groupedByProperty = {};
      photos.forEach(photo => {
        const key = photo.selectedProperty.address;
        if (!groupedByProperty[key]) {
          groupedByProperty[key] = { property: photo.selectedProperty, photosByDate: {} };
        }
        const dateKey = photo.selectedDate.toISOString().slice(0, 10);
        if (!groupedByProperty[key].photosByDate[dateKey]) {
          groupedByProperty[key].photosByDate[dateKey] = [];
        }
        groupedByProperty[key].photosByDate[dateKey].push(photo);
      });

      for (const propAddress in groupedByProperty) {
        const { property, photosByDate } = groupedByProperty[propAddress];

        console.log(`[BulkUpload] Procesando propiedad: ${propAddress}`);
        
        setUploadDebug(prev => ({
          ...prev,
          property: propAddress,
          path: propAddress,
          action: "Buscando carpeta de la propiedad...",
          status: "searching",
        }));

        // ✅ Buscar folderId en Supabase
        let propFolderId = property.folderId; // Intentar primero del objeto
        
        if (!propFolderId) {
          console.log(`[BulkUpload] folderId no encontrado en constants.js, buscando en Supabase...`);
          try {
            const folder = await findFolderByAddress(property.address, property.owner);
            if (folder && folder.google_drive_id) {
              propFolderId = folder.google_drive_id;
              console.log(`[BulkUpload] ✅ Carpeta encontrada en Supabase: ${propFolderId}`);
            } else {
              throw new Error(`No se encontró carpeta para ${property.address}`);
            }
          } catch (searchErr) {
            console.error("[BulkUpload] Error buscando carpeta:", searchErr);
            setUploadDebug(prev => ({
              ...prev,
              action: "Error: Carpeta no encontrada",
              error: `No se encontró la carpeta de Google Drive para ${property.address}. Vincúlala manualmente primero.`,
              status: "error",
            }));
            failCount += Object.values(photosByDate).reduce((sum, arr) => sum + arr.length, 0);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue; // Saltar esta propiedad
          }
        }
        
        console.log(`[BulkUpload] Usando folderId: ${propFolderId}`);
        
        setUploadDebug(prev => ({
          ...prev,
          propertyId: propFolderId,
          action: "Carpeta encontrada",
          status: "found",
        }));

        try {
          // ✅ Buscar carpeta "Inspecciones" o "INSPECCION" (ambas versiones)
          let inspeccionFolder = null;
          
          // Intentar con "Inspecciones" primero
          try {
            const queryInspecciones = `name='Inspecciones' and '${propFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const responseInspecciones = await window.gapi.client.drive.files.list({
              q: queryInspecciones,
              fields: 'files(id, name)',
              spaces: 'drive',
            });
            
            if (responseInspecciones.result.files && responseInspecciones.result.files.length > 0) {
              inspeccionFolder = responseInspecciones.result.files[0];
              console.log(`[BulkUpload] ✅ Encontrado: Inspecciones (${inspeccionFolder.id})`);
            }
          } catch (e) {
            console.log("[BulkUpload] No se encontró carpeta 'Inspecciones'");
          }
          
          // Si no existe "Inspecciones", buscar "INSPECCION"
          if (!inspeccionFolder) {
            try {
              const queryInspeccion = `name='INSPECCION' and '${propFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
              const responseInspeccion = await window.gapi.client.drive.files.list({
                q: queryInspeccion,
                fields: 'files(id, name)',
                spaces: 'drive',
              });
              
              if (responseInspeccion.result.files && responseInspeccion.result.files.length > 0) {
                inspeccionFolder = responseInspeccion.result.files[0];
                console.log(`[BulkUpload] ✅ Encontrado: INSPECCION (${inspeccionFolder.id})`);
              }
            } catch (e) {
              console.log("[BulkUpload] No se encontró carpeta 'INSPECCION'");
            }
          }
          
          // Si no existe ninguna, crear "Inspecciones"
          if (!inspeccionFolder) {
            console.log("[BulkUpload] No existe carpeta de inspecciones, creando 'Inspecciones'...");
            inspeccionFolder = await getOrCreateFolder("Inspecciones", propFolderId);
          }
          
          setUploadDebug(prev => ({
            ...prev,
            path: `${propAddress} > ${inspeccionFolder.name}`,
          }));

          for (const dateStr in photosByDate) {
            const photosForDate = photosByDate[dateStr];
            const dateObj = new Date(dateStr + "T00:00:00");
            const day = dateObj.getDate();
            const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
            const month = monthNames[dateObj.getMonth()];
            const year = String(dateObj.getFullYear()).slice(2);
            const dateFolderName = `${day} ${month} ${year}`;
            const yearFolderName = String(dateObj.getFullYear());

            console.log(`[BulkUpload] Estructura: ${inspeccionFolderName} > ${yearFolderName} > ${dateFolderName}`);

            // ✅ Crear carpeta de año si no existe
            let yearFolder = await getOrCreateFolder(yearFolderName, inspeccionFolder.id);
            
            setUploadDebug(prev => ({
              ...prev,
              path: `${propAddress} > ${inspeccionFolderName} > ${yearFolderName}`,
            }));
            
            // ✅ Crear carpeta de fecha si no existe
            let dateFolder = await getOrCreateFolder(dateFolderName, yearFolder.id);
            
            setUploadDebug(prev => ({
              ...prev,
              path: `${propAddress} > ${inspeccionFolderName} > ${yearFolderName} > ${dateFolderName}`,
            }));

            setUploadStatus(`Subiendo ${photosForDate.length} fotos a ${propAddress} (${dateFolderName})...`);

            const results = [];
            for (const photo of photosForDate) {
              try {
                // Verificar si ya existe
                const query = `name='${photo.file.name}' and '${dateFolder.id}' in parents and trashed=false`;
                const existingResponse = await window.gapi.client.drive.files.list({
                  q: query,
                  fields: 'files(id, name)',
                  spaces: 'drive',
                });

                if (existingResponse.result.files && existingResponse.result.files.length > 0) {
                  console.log(`[BulkUpload] ⚠️ Ya existe: ${photo.file.name}`);
                  results.push({ skipped: true, name: photo.file.name });
                  continue;
                }

                // ✅ Subir archivo
                const uploaded = await uploadFileToDrive(photo.file, dateFolder.id);
                if (uploaded && uploaded.id) {
                  results.push({ id: uploaded.id, name: photo.file.name, mimeType: photo.file.type });
                  successCount++;
                } else {
                  failCount++;
                }
              } catch (uploadErr) {
                console.error("[BulkUpload] upload error:", uploadErr);
                setUploadDebug(prev => ({
                  ...prev,
                  action: "Error al subir archivo",
                  fileName: photo.file.name,
                  error: uploadErr.message,
                  status: "error",
                }));
                failCount++;
                // Pausar para que se vea el error
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }

            // Registrar en Supabase
            await registerInSupabase(dateFolder, yearFolder, inspeccionFolder, results, propAddress, propFolderId);
          }
        } catch (propErr) {
          console.error("[BulkUpload] property error:", propErr);
          setUploadDebug(prev => ({
            ...prev,
            action: "Error procesando propiedad",
            error: propErr.message,
            status: "error",
          }));
          failCount += Object.values(photosByDate).reduce((sum, arr) => sum + arr.length, 0);
          // Pausar para que se vea el error
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      setUploading(false);
      
      // ✅ Solo cerrar si todo salió bien
      if (failCount === 0) {
        onComplete({ success: successCount, failed: failCount });
        onClose();
      } else {
        // Mostrar resultado con errores
        setUploadDebug(prev => ({
          ...prev,
          action: "Subida completada con errores",
          error: `${successCount} exitosas, ${failCount} fallidas`,
          status: "partial",
        }));
        alert(`Subida completada:\n✅ ${successCount} fotos exitosas\n❌ ${failCount} fotos fallidas\n\nRevisa la consola para más detalles.`);
        onComplete({ success: successCount, failed: failCount });
      }
    } catch (globalErr) {
      console.error("[BulkUpload] global error:", globalErr);
      setUploading(false);
      setUploadDebug(prev => ({
        ...prev,
        action: "Error crítico",
        error: globalErr.message,
        status: "error",
      }));
      alert(`Error crítico durante la subida:\n${globalErr.message}\n\nRevisa la consola para más detalles.`);
    }
  };

  const updatePhotoProperty = (index, property) => {
    const updated = [...photos];
    updated[index].selectedProperty = property;
    setPhotos(updated);
  };

  const updatePhotoDate = (index, dateString) => {
    const updated = [...photos];
    updated[index].selectedDate = new Date(dateString);
    setPhotos(updated);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const photosWithoutMatch = photos.filter(p => !p.selectedProperty);

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
              {currentStep === "select" && "Selecciona múltiples fotos"}
              {currentStep === "processing" && "Procesando fotos..."}
              {currentStep === "group-assign" && `${photosWithoutMatch.length} fotos necesitan asignación`}
              {currentStep === "review" && `${photos.length} fotos listas - revisa y confirma`}
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
              <div style={{ fontSize: 64, marginBottom: 20 }}>📸</div>
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
                Generalmente las fotos de un batch son de la misma propiedad
              </p>
            </div>
          )}

          {/* Step 2: Processing con DEBUG */}
          {currentStep === "processing" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginTop: 16, marginBottom: 20 }}>
                {processStatus}
              </p>
              
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
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                      <span style={{ color: C.textDim }}>🔢 Número:</span>
                      <span style={{ fontWeight: 600, color: debugInfo.detectedNumber !== "No detectado" ? C.green : C.red }}>
                        {debugInfo.detectedNumber}
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                      <span style={{ color: C.textDim }}>📍 OCR:</span>
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {debugInfo.ocrAddress}
                      </span>
                    </div>
                    
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
                            ✅ Match automático
                          </div>
                          <div style={{ color: C.text }}>
                            🏠 {debugInfo.matchedProperty}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 600, color: C.red }}>
                          ❌ Sin match → Asignación manual
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Group Assign */}
          {currentStep === "group-assign" && (
            <div>
              <div style={{ 
                padding: "12px 16px", 
                background: `${C.orange}15`, 
                border: `1px solid ${C.orange}40`,
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>
                  ⚠️ {photosWithoutMatch.length} fotos sin detectar
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 4 }}>
                  Asigna todas las fotos sin detectar a la misma propiedad
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 8 }}>
                  Propiedad:
                </label>
                <PropertyAutocomplete
                  value={groupProperty}
                  onChange={setGroupProperty}
                  activeProps={activeProps}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 8 }}>
                  Fecha de inspección:
                </label>
                <DatePickerEnhanced
                  value={groupDate}
                  onChange={setGroupDate}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleApplyToAll} disabled={!groupProperty} style={{
                  flex: 1,
                  padding: "12px 20px",
                  background: groupProperty ? C.green : C.surface2,
                  color: groupProperty ? "white" : C.textDim,
                  border: "none",
                  borderRadius: 8,
                  cursor: groupProperty ? "pointer" : "not-allowed",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  ✓ Aplicar a {photosWithoutMatch.length} fotos
                </button>
                <button onClick={onClose} style={{
                  padding: "12px 20px",
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
            </div>
          )}

          {/* Step 4: Review */}
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

                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                          {photo.fileName}
                        </div>

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

                        <div>
                          <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 4 }}>
                            Fecha:
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
                      </div>

                      <button onClick={() => removePhoto(idx)} style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.red,
                        padding: 4,
                      }}>
                        {I.close || "✕"}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Upload con DEBUG */}
          {currentStep === "upload" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, marginTop: 16, marginBottom: 20 }}>
                {uploadStatus}
              </p>
              
              {/* ✅ DEBUG INFO en tiempo real */}
              {uploadDebug && (
                <div style={{ 
                  maxWidth: 600, 
                  margin: "0 auto",
                  padding: 16, 
                  background: C.surface2, 
                  borderRadius: 8,
                  border: `1px solid ${
                    uploadDebug.status === "error" ? C.red : 
                    uploadDebug.status === "uploaded" ? C.green : 
                    uploadDebug.status === "created" ? C.green : 
                    C.border
                  }`,
                  textAlign: "left",
                }}>
                  {/* Propiedad */}
                  {uploadDebug.property && (
                    <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      🏠 {uploadDebug.property}
                    </div>
                  )}
                  
                  {/* Path completo */}
                  {uploadDebug.path && (
                    <div style={{ 
                      fontFamily: "DM Sans", 
                      fontSize: 11, 
                      color: C.textDim, 
                      marginBottom: 12,
                      padding: "8px 10px",
                      background: `${C.accent}10`,
                      borderRadius: 6,
                    }}>
                      📂 {uploadDebug.path}
                    </div>
                  )}
                  
                  {/* Acción actual */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                      <span style={{ color: C.textDim }}>Acción:</span>
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {uploadDebug.action}
                      </span>
                    </div>
                    
                    {/* Carpeta */}
                    {uploadDebug.folder && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                        <span style={{ color: C.textDim }}>Carpeta:</span>
                        <span style={{ fontWeight: 600, color: C.text }}>
                          {uploadDebug.folder}
                        </span>
                      </div>
                    )}
                    
                    {/* Archivo */}
                    {uploadDebug.fileName && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "DM Sans" }}>
                        <span style={{ color: C.textDim }}>Archivo:</span>
                        <span style={{ fontWeight: 600, color: C.text }}>
                          {uploadDebug.fileName}
                        </span>
                      </div>
                    )}
                    
                    {/* Status */}
                    <div style={{ 
                      marginTop: 8, 
                      padding: "8px 10px", 
                      background: uploadDebug.status === "error" ? `${C.red}15` : 
                                  uploadDebug.status === "uploaded" ? `${C.green}15` : 
                                  uploadDebug.status === "created" ? `${C.green}15` : 
                                  uploadDebug.status === "found" ? `${C.green}15` : 
                                  `${C.accent}15`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: "DM Sans",
                    }}>
                      {uploadDebug.status === "searching" && (
                        <div style={{ fontWeight: 600, color: C.accent }}>
                          🔍 Buscando...
                        </div>
                      )}
                      {uploadDebug.status === "found" && (
                        <div style={{ fontWeight: 600, color: C.green }}>
                          ✅ Carpeta encontrada
                        </div>
                      )}
                      {uploadDebug.status === "creating" && (
                        <div style={{ fontWeight: 600, color: C.accent }}>
                          📁 Creando carpeta...
                        </div>
                      )}
                      {uploadDebug.status === "created" && (
                        <div style={{ fontWeight: 600, color: C.green }}>
                          ✅ Carpeta creada
                        </div>
                      )}
                      {uploadDebug.status === "uploading" && (
                        <div style={{ fontWeight: 600, color: C.accent }}>
                          ⬆️ Subiendo archivo...
                        </div>
                      )}
                      {uploadDebug.status === "uploaded" && (
                        <div style={{ fontWeight: 600, color: C.green }}>
                          ✅ Archivo subido
                        </div>
                      )}
                      {uploadDebug.status === "error" && (
                        <>
                          <div style={{ fontWeight: 600, color: C.red, marginBottom: 4 }}>
                            ❌ Error
                          </div>
                          <div style={{ color: C.red, fontSize: 11 }}>
                            {uploadDebug.error}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* IDs (solo para debug técnico) */}
                    {uploadDebug.folderId && (
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                        ID: {uploadDebug.folderId.substring(0, 20)}...
                      </div>
                    )}
                    {uploadDebug.fileId && (
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                        File ID: {uploadDebug.fileId.substring(0, 20)}...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
