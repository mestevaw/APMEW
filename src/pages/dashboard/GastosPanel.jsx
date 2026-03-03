// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/GastosPanel.jsx  
// Versión: V2
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - Busca carpeta GASTOS directamente en Drive (no usa Supabase)
// - Muestra TODOS los archivos de cada año (no solo docs indexados)
// - Avisa si no encuentra directorio de gastos
// - Ordenado por año descendente
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";

const GastosPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [yearFolders, setYearFolders] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [notFound, setNotFound] = useState(false);

  // ─── Cargar años desde Drive DIRECTAMENTE ───
  useEffect(() => {
    const loadYears = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
          setYearFolders([]);
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
          setStatus(`❌ No se encontró la carpeta de la propiedad: ${property.address}`);
          setNotFound(true);
          setYearFolders([]);
          setLoading(false);
          return;
        }

        // 2. Buscar carpeta GASTOS
        const gastosFolder = await drive.findSubfolder(propFolder.id, "GASTO");

        if (!gastosFolder) {
          setStatus(`❌ No existe carpeta GASTOS para: ${property.address}`);
          console.warn(`[GastosPanel] Carpeta GASTOS no encontrada para ${property.address}`);
          setNotFound(true);
          setYearFolders([]);
          setLoading(false);
          return;
        }

        // 3. Listar años dentro de GASTOS
        const allFiles = await drive.listAllFiles(gastosFolder.id);
        
        const years = (allFiles || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
          .map(f => ({ id: f.id, name: f.name }))
          .sort((a, b) => b.name.localeCompare(a.name));

        setYearFolders(years);

        if (years.length === 0) {
          setStatus("No hay años registrados en GASTOS");
        }

        // Auto-seleccionar año actual o más reciente
        const currentYear = new Date().getFullYear().toString();
        const current = years.find(y => y.name === currentYear);
        if (current) {
          setSelectedYear(current.id);
        } else if (years.length > 0) {
          setSelectedYear(years[0].id);
        }
      } catch (err) {
        console.error("[GastosPanel] Error loading years:", err);
        setStatus(`Error: ${err.message}`);
        setNotFound(true);
      }
      setLoading(false);
    };

    loadYears();
  }, [property.address, property.owner, drive?.token, drive?.listAllFiles, drive?.searchFolderByAddress, drive?.findSubfolder]);

  // ─── Cargar archivos cuando se selecciona un año ───
  useEffect(() => {
    if (!selectedYear || !drive?.listAllFiles) return;

    const loadFiles = async () => {
      setLoading(true);
      try {
        const allFiles = await drive.listAllFiles(selectedYear);
        
        // Filtrar solo archivos (no carpetas) y ordenar por nombre
        const documents = (allFiles || [])
          .filter(f => f.mimeType !== "application/vnd.google-apps.folder")
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            fileType: (f.name || "").split(".").pop().toLowerCase(),
          }));

        setFiles(documents);
      } catch (err) {
        console.error("[GastosPanel] Error loading files:", err);
        setFiles([]);
      }
      setLoading(false);
    };

    loadFiles();
  }, [selectedYear, drive?.listAllFiles]);

  const openFile = (file) => {
    if (!file.id) return;
    window.open(`https://drive.google.com/file/d/${file.id}/view`, '_blank');
  };

  const getFileIcon = (mimeType, fileType) => {
    if (!mimeType && !fileType) return "📄";
    if (mimeType === "application/pdf" || fileType === "pdf") return "📕";
    if (mimeType?.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(fileType)) return "📗";
    if (mimeType?.includes("document") || ["docx", "doc"].includes(fileType)) return "📘";
    if (mimeType?.includes("presentation") || ["pptx", "ppt"].includes(fileType)) return "📙";
    if (mimeType?.startsWith("image/")) return "🖼️";
    if (mimeType?.startsWith("video/")) return "🎥";
    return "📄";
  };

  if (loading && yearFolders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spinner />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
            {status || "Buscando carpeta de gastos..."}
          </p>
        </div>
      </Card>
    );
  }

  if (notFound || yearFolders.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 8 }}>
          {status || "No hay carpeta de gastos para esta propiedad"}
        </div>
        {notFound && (
          <div style={{ 
            fontFamily: "DM Sans", 
            fontSize: 11, 
            color: C.red, 
            marginTop: 12,
            padding: "8px 12px",
            background: `${C.red}15`,
            borderRadius: 6,
            display: "inline-block",
          }}>
            ⚠️ Estructura esperada: PROPERTY/{property.address}/GASTOS/{"{año}"}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
      {/* Selector de Año */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, display: "block", marginBottom: 6 }}>
          Año:
        </label>
        <select
          value={selectedYear || ""}
          onChange={(e) => setSelectedYear(e.target.value)}
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
            fontWeight: 600,
          }}
        >
          {yearFolders.map(year => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>

      {/* Archivos */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          📄 {files.length} archivos
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Spinner />
          </div>
        ) : files.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map(file => {
              const icon = getFileIcon(file.mimeType, file.fileType);

              return (
                <button
                  key={file.id}
                  onClick={() => openFile(file)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: C.surface2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.background = C.accentGlow;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.background = C.surface2;
                  }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      color: C.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {file.name}
                    </div>
                    {file.fileType && (
                      <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                        {file.fileType.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span style={{ color: C.textMuted, fontSize: 14 }}>→</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
              No hay archivos en este año
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GastosPanel;
