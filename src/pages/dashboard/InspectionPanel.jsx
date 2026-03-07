// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/InspectionPanel.jsx
// Versión: V4
// Fecha: 2026-03-06
// ═══════════════════════════════════════════
// CAMBIOS EN V4 (desde V3):
// - "+ Agregar Fotos" ahora nombra los archivos con la nomenclatura correcta:
//   "[Calle] [N] Foto [fecha carpeta].[ext]"
//   Ej: "Hazy Glen 28 Foto 3 mar 26.jpg"
// - Continúa la numeración desde las fotos ya existentes en esa carpeta
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { findFolderByAddress } from "./helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import AuthImage from "./AuthImage";
import PhotoGallery from "./PhotoGallery";

// ─── UI helpers ────────────────────────────────────────────────────────────

const YearBtn = ({ year, active, count, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 14px",
      background: active ? C.accent : "transparent",
      color: active ? "#fff" : C.textDim,
      border: `1px solid ${active ? C.accent : C.border}`,
      borderRadius: 20, cursor: "pointer",
      fontFamily: "DM Sans", fontSize: 13, fontWeight: active ? 600 : 400,
      transition: "all 0.15s", whiteSpace: "nowrap",
    }}
  >
    {year} {count != null ? <span style={{ opacity: 0.7, fontSize: 11 }}>({count})</span> : null}
  </button>
);

// ═══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════
const InspectionPanel = ({ property, mob, drive, folderId: propFolderId }) => {

  // Años disponibles (claves) y sus carpetas de fecha (valor = array | null = no cargado)
  const [yearMap, setYearMap]         = useState({}); // { "2026": [folders] | null, ... }
  const [selectedYear, setSelectedYear] = useState(null);
  const [loadingYears, setLoadingYears] = useState(true);
  const [inspecFolderId, setInspecFolderId] = useState(null);

  // Fotos por carpeta de fecha: { folderId: photos[] | "loading" | "empty" }
  const [photoMap, setPhotoMap] = useState({});
  // Carpeta de fecha expandida actualmente
  const [expandedDate, setExpandedDate] = useState(null);

  const [galleryImages, setGalleryImages] = useState(null);
  const [galleryStart, setGalleryStart]   = useState(0);
  const [status, setStatus]               = useState("");
  const uploadRef  = useRef(null);
  const [uploading, setUploading] = useState(false);

  // ── 1. Encontrar carpeta de inspecciones ─────────────────────────────────
  useEffect(() => {
    setLoadingYears(true);
    setYearMap({});
    setSelectedYear(null);
    setInspecFolderId(null);
    setPhotoMap({});
    setExpandedDate(null);

    const init = async () => {
      if (!drive?.token) return;

      try {
        // Usar folderId ya resuelto por PropertyDetail si está disponible
        let rootId = propFolderId;

        if (!rootId) {
          const sf = await findFolderByAddress(property.address, property.owner);
          rootId   = sf?.google_drive_id || null;
        }

        if (!rootId) {
          setStatus("No se encontró la carpeta de la propiedad en Supabase");
          setLoadingYears(false);
          return;
        }

        // Buscar INSPECCIONES
        const inspec = await drive.findSubfolder(rootId, "INSPEC");
        if (!inspec) {
          setStatus("No existe carpeta INSPECCIONES aún");
          setLoadingYears(false);
          return;
        }
        setInspecFolderId(inspec.id);

        // Listar contenido directo de INSPECCIONES
        const contents = await drive.listAllFiles(inspec.id);
        const folders  = (contents || []).filter(f => f.mimeType === "application/vnd.google-apps.folder");

        // Separar carpetas de AÑO (4 dígitos) de carpetas sueltas
        const yearFolders  = folders.filter(f => /^\d{4}$/.test(f.name))
                                    .sort((a, b) => b.name.localeCompare(a.name));
        const looseFolders = folders.filter(f => !/^\d{4}$/.test(f.name))
                                    .sort((a, b) => b.name.localeCompare(a.name));

        // Construir mapa inicial: años conocidos pero sin fechas cargadas aún
        const initialMap = {};
        yearFolders.forEach(yf => { initialMap[yf.name] = { folderId: yf.id, dates: null }; });
        if (looseFolders.length) initialMap["Sin año"] = { folderId: null, dates: looseFolders };

        setYearMap(initialMap);

        // Cargar el año más reciente automáticamente
        const mostRecent = yearFolders[0]?.name || (looseFolders.length ? "Sin año" : null);
        if (mostRecent) {
          await loadYear(mostRecent, initialMap, inspec.id);
        }
      } catch (err) {
        console.error("[InspectionPanel]", err);
        setStatus(`Error: ${err.message}`);
      }
      setLoadingYears(false);
    };

    init();
  }, [property.address, propFolderId, drive?.token]);

  // ── 2. Cargar fechas de un año ────────────────────────────────────────────
  const loadYear = useCallback(async (year, map, inspecId) => {
    const currentMap = map || yearMap;
    const entry      = currentMap[year];
    if (!entry || entry.dates !== null) return; // Ya cargado o "Sin año"

    try {
      const contents = await drive.listAllFiles(entry.folderId);
      const dates    = (contents || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder")
        .sort((a, b) => b.name.localeCompare(a.name));

      setYearMap(prev => ({
        ...prev,
        [year]: { ...prev[year], dates },
      }));
    } catch (err) {
      console.error("[InspectionPanel] loadYear error:", err);
    }
  }, [yearMap, drive]);

  const handleYearClick = async (year) => {
    setSelectedYear(year);
    setExpandedDate(null);
    if (yearMap[year]?.dates === null) {
      await loadYear(year, null, inspecFolderId);
    }
  };

  // ── 3. Cargar fotos de una carpeta de fecha ───────────────────────────────
  const loadPhotos = useCallback(async (folderId) => {
    if (photoMap[folderId] && photoMap[folderId] !== "loading") return;
    setPhotoMap(prev => ({ ...prev, [folderId]: "loading" }));

    try {
      const files  = await drive.listAllFiles(folderId);
      const images = (files || [])
        .filter(f => f.mimeType?.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name));
      setPhotoMap(prev => ({ ...prev, [folderId]: images.length ? images : "empty" }));
    } catch (err) {
      setPhotoMap(prev => ({ ...prev, [folderId]: "empty" }));
    }
  }, [photoMap, drive]);

  const handleDateClick = (folderId) => {
    if (expandedDate === folderId) {
      setExpandedDate(null); // Colapsar si ya está abierto
    } else {
      setExpandedDate(folderId);
      loadPhotos(folderId);
    }
  };

  // ── 4. Upload ─────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    if (!expandedDate) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      // Nombre corto de la propiedad (igual que BulkPhotoUpload)
      const shortName = property.address.replace(/^\d+\s*/, "").split(/\s+/).slice(0, 2).join(" ");

      // Nombre de la carpeta de fecha activa (ej: "3 mar 26")
      const dateFolder = currentDates.find(f => f.id === expandedDate);
      const dateName   = dateFolder?.name || "";

      // Contar fotos existentes para continuar la numeración
      const existing = Array.isArray(photoMap[expandedDate]) ? photoMap[expandedDate] : [];
      let   nextIdx  = existing.length + 1;

      for (let i = 0; i < files.length; i++) {
        setStatus(`Subiendo ${i + 1}/${files.length}...`);
        const ext      = files[i].name.split(".").pop() || "jpg";
        const fileName = `${shortName} ${nextIdx} Foto ${dateName}.${ext}`;
        nextIdx++;
        await drive.uploadFile(files[i], fileName, expandedDate);
      }
      setStatus(`✓ ${files.length} foto${files.length !== 1 ? "s" : ""} subida${files.length !== 1 ? "s" : ""}`);
      setTimeout(() => setStatus(""), 4000);
      // Recargar fotos del folder
      setPhotoMap(prev => ({ ...prev, [expandedDate]: "loading" }));
      await loadPhotos(expandedDate);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const years = Object.keys(yearMap).sort((a, b) => {
    if (a === "Sin año") return 1;
    if (b === "Sin año") return -1;
    return b.localeCompare(a);
  });

  const currentDates = selectedYear
    ? (yearMap[selectedYear]?.dates || [])
    : (years[0] ? (yearMap[years[0]]?.dates || []) : []);

  const activeYear = selectedYear || years[0];

  if (loadingYears) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Spinner />
        <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
          Cargando inspecciones...
        </div>
      </div>
    );
  }

  if (status && !years.length) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
        {status}
      </div>
    );
  }

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

      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />

      {status && (
        <div style={{
          padding: "8px 14px", marginBottom: 12, borderRadius: 8,
          background: status.startsWith("✓") ? `${C.green}15` : `${C.accent}15`,
          border: `1px solid ${status.startsWith("✓") ? C.green : C.accent}40`,
        }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: status.startsWith("✓") ? C.green : C.accent }}>
            {status}
          </span>
        </div>
      )}

      {/* ── Tabs de año ─────────────────────────────────────────────────── */}
      {years.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {years.map(year => {
            const entry   = yearMap[year];
            const count   = entry?.dates ? entry.dates.length : null;
            return (
              <YearBtn
                key={year}
                year={year}
                active={activeYear === year}
                count={count}
                onClick={() => handleYearClick(year)}
              />
            );
          })}
        </div>
      )}

      {/* ── Lista de inspecciones (botones de fecha) ─────────────────────── */}
      {yearMap[activeYear]?.dates === null ? (
        <div style={{ textAlign: "center", padding: 24 }}><Spinner /></div>
      ) : currentDates.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
          📸 No hay inspecciones en {activeYear}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {currentDates.map(folder => {
            const isOpen   = expandedDate === folder.id;
            const photos   = photoMap[folder.id];
            const isLoading = photos === "loading";
            const isEmpty   = photos === "empty";
            const hasPhotos = Array.isArray(photos) && photos.length > 0;

            return (
              <div key={folder.id}>
                {/* Botón de fecha */}
                <button
                  onClick={() => handleDateClick(folder.id)}
                  style={{
                    width: "100%", padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: isOpen ? `${C.accent}15` : C.surface2,
                    border: `1px solid ${isOpen ? C.accent : C.border}`,
                    borderRadius: isOpen ? "10px 10px 0 0" : 10,
                    cursor: "pointer",
                    fontFamily: "DM Sans", fontSize: 14,
                    color: isOpen ? C.accent : C.text,
                    fontWeight: isOpen ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <span>{folder.name}</span>
                    {hasPhotos && (
                      <span style={{
                        fontSize: 11, color: C.textDim,
                        background: C.surface2, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: "1px 7px",
                      }}>
                        {photos.length} 📸
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: C.textDim, transition: "transform 0.15s",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </button>

                {/* Panel de fotos inline */}
                {isOpen && (
                  <div style={{
                    border: `1px solid ${C.accent}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: 14,
                    background: C.surface,
                  }}>
                    {/* Toolbar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                      <button
                        onClick={() => uploadRef.current?.click()}
                        disabled={uploading}
                        style={{
                          padding: "6px 14px",
                          background: C.accent, color: "white",
                          border: "none", borderRadius: 6,
                          cursor: uploading ? "not-allowed" : "pointer",
                          fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
                          opacity: uploading ? 0.5 : 1,
                        }}
                      >
                        {uploading ? "Subiendo..." : "+ Agregar Fotos"}
                      </button>
                    </div>

                    {/* Fotos */}
                    {isLoading ? (
                      <div style={{ textAlign: "center", padding: "32px 0" }}><Spinner /></div>
                    ) : isEmpty ? (
                      <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>
                        📸 No hay fotos en esta inspección
                      </div>
                    ) : (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                        gap: 10,
                      }}>
                        {photos.map((photo, idx) => (
                          <div
                            key={photo.id}
                            onClick={() => { setGalleryImages(photos); setGalleryStart(idx); }}
                            style={{
                              aspectRatio: "1",
                              borderRadius: 8,
                              overflow: "hidden",
                              cursor: "pointer",
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            <AuthImage
                              fileId={photo.id}
                              drive={drive}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InspectionPanel;
