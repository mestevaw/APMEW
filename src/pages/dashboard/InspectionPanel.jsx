// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx
// Versión: 2.0 - Flexible con todos los formatos
// Fecha: 2026-03-03
// ═══════════════════════════════════════════
// CAMBIOS:
// - Muestra carpetas con Y sin estructura de año
// - Acepta CUALQUIER formato de nombre
// - Agrupa por año automáticamente
// - Grupo "Sin año" para carpetas sueltas
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { todayFolderName } from "../../lib/helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const InspectionPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [allFolders, setAllFolders] = useState([]); // Todas las carpetas encontradas
  const [selectedYear, setSelectedYear] = useState(null);
  const [dateFolders, setDateFolders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const uploadRef = useRef(null);

  // ─── Cargar TODAS las carpetas (con y sin año) ───
  useEffect(() => {
    const loadAllFolders = async () => {
      setLoading(true);
      try {
        if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
          setAllFolders([]);
          setLoading(false);
          return;
        }

        // 1. Buscar carpeta de la propiedad
        const propFolder = await drive.searchFolderByAddress(
          property.address,
          property.owner,
          DRIVE_ROOT_FOLDER
        );

        if (!propFolder) {
          setStatus("No se encontró la carpeta de la propiedad");
          setAllFolders([]);
          setLoading(false);
          return;
        }

        // 2. Buscar carpeta INSPECCIONES
        const inspecFolder = await drive.findSubfolder(propFolder.id, "INSPEC");

        if (!inspecFolder) {
          setStatus("No existe carpeta INSPECCIONES para esta propiedad");
          setAllFolders([]);
          setLoading(false);
          return;
        }

        // 3. Listar TODO dentro de INSPECCIONES
        const allFiles = await drive.listAllFiles(inspecFolder.id);
        const folders = (allFiles || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder");

        // 4. Separar carpetas de AÑO vs carpetas de FECHAS
        const yearFolders = folders.filter(f => /^\d{4}$/.test(f.name));
        const looseDateFolders = folders.filter(f => !/^\d{4}$/.test(f.name));

        // 5. Para cada año, obtener sus subcarpetas
        const foldersWithYear = [];
        for (const yearFolder of yearFolders) {
          const subFolders = await drive.listAllFiles(yearFolder.id);
          const dateFolders = (subFolders || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder")
            .map(f => ({ ...f, year: yearFolder.name }));
          foldersWithYear.push(...dateFolders);
        }

        // 6. Combinar: carpetas con año + carpetas sueltas
        const combined = [
          ...foldersWithYear,
          ...looseDateFolders.map(f => ({ ...f, year: null }))
        ];

        // 7. Agrupar por año para el selector
        const yearGroups = {};
        combined.forEach(folder => {
          const year = folder.year || "Sin año";
          if (!yearGroups[year]) {
            yearGroups[year] = [];
          }
          yearGroups[year].push(folder);
        });

        // Ordenar cada grupo
        Object.keys(yearGroups).forEach(year => {
          yearGroups[year].sort((a, b) => b.name.localeCompare(a.name));
        });

        setAllFolders(yearGroups);

        // ✅ Por defecto: Mostrar TODAS las inspecciones (sin filtro de año)
        const allDates = Object.values(yearGroups).flat().sort((a, b) => b.name.localeCompare(a.name));
        setDateFolders(allDates);
        setSelectedYear("all"); // Indicador de "todas"

        setStatus("");
      } catch (err) {
        console.error("[InspectionPanel] Error loading folders:", err);
        setStatus(`Error: ${err.message}`);
        setAllFolders([]);
      }
      setLoading(false);
    };

    loadAllFolders();
  }, [property.address, property.owner, drive]);

  // ─── Cambiar año seleccionado ───
  const handleYearChange = (year) => {
    setSelectedYear(year);
    if (year === "all") {
      // Mostrar todas las inspecciones sin filtro
      const allDates = Object.values(allFolders).flat().sort((a, b) => b.name.localeCompare(a.name));
      setDateFolders(allDates);
    } else {
      setDateFolders(allFolders[year] || []);
    }
    setSelectedDate(null);
    setPhotos([]);
  };

  // ─── Cargar fotos cuando se selecciona una fecha ───
  useEffect(() => {
    if (!selectedDate || !drive?.listAllFiles) return;

    const loadPhotos = async () => {
      setLoading(true);
      try {
        const files = await drive.listAllFiles(selectedDate);
        const images = (files || [])
          .filter(f => f.mimeType && f.mimeType.startsWith("image/"))
          .sort((a, b) => a.name.localeCompare(b.name));

        setPhotos(images);
        setNotes([]);
      } catch (err) {
        console.error("[InspectionPanel] Error loading photos:", err);
        setPhotos([]);
      }
      setLoading(false);
    };

    loadPhotos();
  }, [selectedDate, drive]);

  const openGallery = (startIndex) => {
    setGalleryImages(photos);
    setGalleryStart(startIndex);
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedDate || !drive?.uploadFile) return;

    setUploading(true);
    setStatus("Subiendo fotos...");

    try {
      let uploaded = 0;
      for (const file of files) {
        try {
          await drive.uploadFile(file, selectedDate);
          uploaded++;
          setStatus(`Subiendo ${uploaded}/${files.length}...`);
        } catch (err) {
          console.error("[InspectionPanel] Upload error:", err);
        }
      }

      setStatus(`✓ ${uploaded} fotos subidas`);
      setTimeout(() => setStatus(""), 3000);

      // Recargar fotos
      const updatedFiles = await drive.listAllFiles(selectedDate);
      const images = (updatedFiles || [])
        .filter(f => f.mimeType && f.mimeType.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name));
      setPhotos(images);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }

    setUploading(false);
    e.target.value = "";
  };

  const years = ["all", ...Object.keys(allFolders).sort((a, b) => {
    if (a === "Sin año") return 1;
    if (b === "Sin año") return -1;
    return b.localeCompare(a);
  })];

  const getTotalCount = () => {
    return Object.values(allFolders).flat().length;
  };

  return (
    <div>
      {galleryImages && (
        <PhotoGallery
          images={galleryImages}
          startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          drive={drive}
        />
      )}

      {/* Status */}
      {status && (
        <div style={{
          padding: "8px 14px",
          marginBottom: 12,
          borderRadius: 8,
          background: status.startsWith("✓") ? `${C.green}15` : status.startsWith("Error") ? `${C.red}15` : `${C.accent}15`,
          border: `1px solid ${status.startsWith("✓") ? C.green : status.startsWith("Error") ? C.red : C.accent}40`,
        }}>
          <span style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            color: status.startsWith("✓") ? C.green : status.startsWith("Error") ? C.red : C.accent,
          }}>
            {status}
          </span>
        </div>
      )}

      {/* Selector de año */}
      {years.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 600,
            color: C.textDim,
            display: "block",
            marginBottom: 8,
          }}>
            Año:
          </label>
          <select
            value={selectedYear || ""}
            onChange={(e) => handleYearChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontFamily: "DM Sans",
              fontSize: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: C.surface2,
              color: C.text,
              cursor: "pointer",
            }}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year === "all" 
                  ? `Todas (${getTotalCount()} inspecciones)` 
                  : `${year} (${allFolders[year]?.length || 0} inspecciones)`
                }
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lista de fechas */}
      {dateFolders.length > 0 ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 600,
            color: C.textDim,
            marginBottom: 12,
          }}>
            Inspecciones ({dateFolders.length}):
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dateFolders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedDate(folder.id)}
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  background: selectedDate === folder.id ? C.accentGlow : "transparent",
                  border: `1px solid ${selectedDate === folder.id ? C.accent : C.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  color: selectedDate === folder.id ? C.accent : C.text,
                  fontWeight: selectedDate === folder.id ? 600 : 400,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  if (selectedDate !== folder.id) {
                    e.currentTarget.style.background = C.surface2;
                  }
                }}
                onMouseLeave={e => {
                  if (selectedDate !== folder.id) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {folder.name}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        !loading && (
          <Card>
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              color: C.textDim,
              fontFamily: "DM Sans",
              fontSize: 14,
            }}>
              📸 No hay inspecciones registradas
            </div>
          </Card>
        )
      )}

      {/* Fotos */}
      {selectedDate && (
        <Card>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
            }}>
              {photos.length} fotos
            </div>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={uploading}
              style={{
                padding: "6px 14px",
                background: C.accent,
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: uploading ? "not-allowed" : "pointer",
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: 600,
                opacity: uploading ? 0.5 : 1,
              }}
            >
              {uploading ? "Subiendo..." : "+ Agregar Fotos"}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Spinner />
            </div>
          ) : photos.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: 12,
            }}>
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  onClick={() => openGallery(idx)}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: `1px solid ${C.border}`,
                    position: "relative",
                  }}
                >
                  <AuthImage
                    fileId={photo.id}
                    drive={drive}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              color: C.textDim,
              fontFamily: "DM Sans",
              fontSize: 14,
            }}>
              📸 No hay fotos en esta inspección
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InspectionPanel;
