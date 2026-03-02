// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx
// Versión: 1.0
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch } from "../../lib/supabase";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

const InspectionPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [inspectionFolders, setInspectionFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart] = useState(0);

  // Cargar folders de inspección desde Supabase (indexado)
  useEffect(() => {
    const loadInspections = async () => {
      setLoading(true);
      try {
        // Buscar todos los folders que tengan el path de INSPECCIONES para esta propiedad
        // Usar búsqueda flexible para encontrar tanto INSPECCION como INSPECCIONES
        const folders = await supaFetch("drive_folders", {
          filters: `folder_path.ilike.%${encodeURIComponent(property.address)}%INSPECC%`,
          order: "folder_path.desc",
        });

        if (folders && folders.length > 0) {
          // Filtrar solo folders de fecha (que contengan números de día)
          const dateFolders = folders.filter(f => {
            const pathParts = f.folder_path.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            // Formato esperado: "2 mar 26" o "25 feb 26"
            return /^\d{1,2}\s+[a-z]{3}\s+\d{2}$/i.test(lastPart);
          }).map(f => {
            const pathParts = f.folder_path.split('/');
            const dateName = pathParts[pathParts.length - 1];
            const yearPart = pathParts[pathParts.length - 2];
            
            return {
              id: f.google_drive_id,
              name: dateName,
              year: yearPart,
              path: f.folder_path,
            };
          });

          // Agrupar por año
          const byYear = {};
          dateFolders.forEach(folder => {
            if (!byYear[folder.year]) byYear[folder.year] = [];
            byYear[folder.year].push(folder);
          });

          // Ordenar años descendente y folders dentro de cada año
          const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
          const sorted = [];
          sortedYears.forEach(year => {
            byYear[year].sort((a, b) => b.name.localeCompare(a.name));
            sorted.push(...byYear[year]);
          });

          setInspectionFolders(sorted);

          // Auto-seleccionar el más reciente
          if (sorted.length > 0) {
            setSelectedFolder(sorted[0].id);
          }
        }
      } catch (err) {
        console.error("[InspectionPanel] Error loading folders:", err);
      }
      setLoading(false);
    };

    loadInspections();
  }, [property.address]);

  // Cargar fotos cuando se selecciona un folder
  useEffect(() => {
    if (!selectedFolder || !drive?.listAllFiles) return;

    const loadPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const files = await drive.listAllFiles(selectedFolder);
        const images = (files || [])
          .filter(f => f.mimeType && f.mimeType.startsWith('image/'))
          .map(f => ({
            id: f.id,
            title: f.name,
            google_drive_file_id: f.id,
            mime_type: f.mimeType,
            file_type: (f.name || "").split(".").pop().toLowerCase(),
          }));
        setPhotos(images);
      } catch (err) {
        console.error("[InspectionPanel] Error loading photos:", err);
        setPhotos([]);
      }
      setLoadingPhotos(false);
    };

    loadPhotos();
  }, [selectedFolder, drive?.listAllFiles]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spinner />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
            Cargando inspecciones...
          </p>
        </div>
      </Card>
    );
  }

  if (inspectionFolders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
            No hay inspecciones registradas
          </div>
        </div>
      </Card>
    );
  }

  // Agrupar folders por año para el dropdown
  const byYear = {};
  inspectionFolders.forEach(folder => {
    if (!byYear[folder.year]) byYear[folder.year] = [];
    byYear[folder.year].push(folder);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {galleryImages && (
        <PhotoGallery
          images={galleryImages}
          startIndex={galleryStart}
          onClose={() => setGalleryImages(null)}
          mob={mob}
          token={drive?.token}
          propertyAddress={property.address}
        />
      )}

      {/* Dropdown de fechas */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          fontFamily: "DM Sans",
          fontSize: 11,
          color: C.textDim,
          display: "block",
          marginBottom: 6,
        }}>
          Ver inspección:
        </label>
        <select
          value={selectedFolder || ""}
          onChange={(e) => setSelectedFolder(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontFamily: "DM Sans",
            fontSize: 13,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: C.surface2,
            color: C.text,
            cursor: "pointer",
          }}
        >
          {years.map(year => (
            <optgroup key={year} label={year}>
              {byYear[year].map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Fotos */}
      {loadingPhotos ? (
        <Card>
          <div style={{ textAlign: "center", padding: 20 }}>
            <Spinner />
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginTop: 8 }}>
              Cargando fotos...
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          {photos.length > 0 ? (
            <div>
              <div style={{
                fontFamily: "DM Sans",
                fontSize: 12,
                color: C.textDim,
                marginBottom: 8,
              }}>
                🖼️ {photos.length} fotos
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: mob ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
                gap: 6,
              }}>
                {photos.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setGalleryImages(photos);
                      setGalleryStart(idx);
                    }}
                    style={{
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      overflow: "hidden",
                      aspectRatio: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                  >
                    <AuthImage
                      fileId={img.google_drive_file_id}
                      token={drive?.token}
                      alt={img.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
                No hay fotos en esta inspección
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InspectionPanel;
