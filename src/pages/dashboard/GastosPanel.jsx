// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/GastosPanel.jsx  
// Versión: V5
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V5:
// - Controles ultra-compactos pegados a tabs (margin-top: -4px)
// - "Todos" → "Años"
// - Width 100px en dropdown
// - Padding reducido (6px 8px)
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch } from "../../lib/supabase";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import { findFolderByAddress } from "./helpers";

const parseGastoPath = (folderPath) => {
  const parts = folderPath.split('/');
  if (parts.length < 5) return null;
  
  const gastosIdx = parts.findIndex(p => p.toLowerCase().includes('gasto'));
  if (gastosIdx === -1 || gastosIdx + 1 >= parts.length) return null;
  
  const year = parts[gastosIdx + 1];
  if (!/^\d{4}$/.test(year)) return null;
  
  return { year, folderPath };
};

const GastosPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [yearFolders, setYearFolders] = useState([]);
  const [selectedYear, setSelectedYear] = useState("all"); // "all" o google_drive_id
  const [allFilesByYear, setAllFilesByYear] = useState({}); // { "2025": [...], "2024": [...] }
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [anaPDoc, setAnaPDoc] = useState(null); // PDF suelto en la carpeta GASTOS

  // ─── Cargar años desde Supabase ───
  useEffect(() => {
    const loadYears = async () => {
      setLoading(true);
      setNotFound(false);
      
      try {
        const folders = await supaFetch("drive_folders", {
          filters: `folder_path=ilike.*${property.address}*GASTO*`,
          order: "folder_path.desc"
        });

        if (folders && folders.length > 0) {
          const parsed = folders
            .map(f => ({ ...parseGastoPath(f.folder_path), driveId: f.google_drive_id }))
            .filter(p => p && p.year);

          if (parsed.length > 0) {
            const uniqueYears = Array.from(
              new Map(parsed.map(p => [p.year, { year: p.year, id: p.driveId, folderPath: p.folderPath }])).values()
            ).sort((a, b) => b.year.localeCompare(a.year));

            // Buscar PDF suelto en la misma carpeta GASTOS vía Supabase + Drive
            if (drive?.listAllFiles) {
              try {
                const basePath = parsed[0]?.folderPath;
                if (basePath) {
                  const gastosPath = basePath.split("/").slice(0, -1).join("/");
                  const gastosRows = await supaFetch("drive_folders", {
                    filters: `folder_path=eq.${encodeURIComponent(gastosPath)}`,
                    limit: 1
                  });
                  const gastosId = gastosRows?.[0]?.google_drive_id;
                  if (gastosId) {
                    const allInGastos = await drive.listAllFiles(gastosId);
                    const pdf = (allInGastos || []).find(f =>
                      f.mimeType === "application/pdf" || (f.name || "").toLowerCase().endsWith(".pdf")
                    );
                    if (pdf) setAnaPDoc(pdf.id);
                  }
                }
              } catch(e) { /* silencioso */ }
            }

            setYearFolders(uniqueYears);
            setSelectedYear("all"); // Iniciar en "Todos"
            setLoading(false);
            setStatus("");
            return;
          }
        }

        // Fallback a Drive API
        await loadFromDrive();

      } catch (err) {
        console.error("[GastosPanel] Error:", err);
        setStatus("Error: " + err.message);
        setNotFound(true);
        setLoading(false);
      }
    };

    const loadFromDrive = async () => {
      if (!drive?.token || !drive?.listAllFiles || !drive?.searchFolderByAddress || !drive?.findSubfolder) {
        setYearFolders([]);
        setLoading(false);
        return;
      }

      setStatus("Cargando desde Drive...");

      const propFolder = await drive.searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
      if (!propFolder) {
        setStatus(`❌ No se encontró la carpeta de la propiedad: ${property.address}`);
        setNotFound(true);
        setYearFolders([]);
        setLoading(false);
        return;
      }

      const gastosFolder = await drive.findSubfolder(propFolder.id, "GASTO");
      if (!gastosFolder) {
        setStatus(`❌ No existe carpeta GASTOS para: ${property.address}`);
        setNotFound(true);
        setYearFolders([]);
        setLoading(false);
        return;
      }

      const allFiles = await drive.listAllFiles(gastosFolder.id);
      const years = (allFiles || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder" && /^\d{4}$/.test(f.name))
        .map(f => ({ id: f.id, year: f.name }))
        .sort((a, b) => b.year.localeCompare(a.year));

      // Buscar PDF suelto (no dentro de subcarpetas de año)
      const loosePdf = (allFiles || []).find(f =>
        f.mimeType === "application/pdf" || (f.name || "").toLowerCase().endsWith(".pdf")
      );
      if (loosePdf) setAnaPDoc(loosePdf.id);

      setYearFolders(years);
      setSelectedYear("all");
      setLoading(false);
      setStatus("");
    };

    loadYears();
  }, [property.address, property.owner, drive?.token]);

  // ─── Cargar archivos según año seleccionado ───
  useEffect(() => {
    if (yearFolders.length === 0) return;

    const loadFiles = async () => {
      setLoading(true);
      
      try {
        if (selectedYear === "all") {
          // Cargar archivos de TODOS los años
          const filesByYear = {};
          
          for (const year of yearFolders) {
            const docs = await supaFetch("documents", {
              filters: `parent_folder_drive_id=eq.${year.id}`,
              order: "title.asc"
            });

            if (docs && docs.length > 0) {
              filesByYear[year.year] = docs.map(d => ({
                id: d.google_drive_file_id,
                name: d.title,
                mimeType: d.mime_type,
                fileType: d.file_type,
              }));
            } else if (drive?.listAllFiles) {
              // Fallback a Drive
              const driveFiles = await drive.listAllFiles(year.id);
              filesByYear[year.year] = (driveFiles || [])
                .filter(f => f.mimeType !== "application/vnd.google-apps.folder")
                .map(f => ({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  fileType: (f.name || "").split(".").pop().toLowerCase(),
                }));
            }
          }
          
          setAllFilesByYear(filesByYear);
        } else {
          // Cargar archivos de un año específico
          const docs = await supaFetch("documents", {
            filters: `parent_folder_drive_id=eq.${selectedYear}`,
            order: "title.asc"
          });

          const yearObj = yearFolders.find(y => y.id === selectedYear);
          if (docs && docs.length > 0) {
            setAllFilesByYear({
              [yearObj.year]: docs.map(d => ({
                id: d.google_drive_file_id,
                name: d.title,
                mimeType: d.mime_type,
                fileType: d.file_type,
              }))
            });
          } else if (drive?.listAllFiles) {
            const driveFiles = await drive.listAllFiles(selectedYear);
            setAllFilesByYear({
              [yearObj.year]: (driveFiles || [])
                .filter(f => f.mimeType !== "application/vnd.google-apps.folder")
                .map(f => ({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  fileType: (f.name || "").split(".").pop().toLowerCase(),
                }))
            });
          }
        }
      } catch (err) {
        console.error("[GastosPanel] Error loading files:", err);
        setAllFilesByYear({});
      }
      
      setLoading(false);
    };

    loadFiles();
  }, [selectedYear, yearFolders, drive?.listAllFiles]);

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

  // Filtrar archivos por búsqueda
  const filterFiles = (files) => {
    if (!searchTerm.trim()) return files;
    const term = searchTerm.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(term));
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

  const totalFiles = Object.values(allFilesByYear).flat().length;
  const filteredByYear = {};
  Object.entries(allFilesByYear).forEach(([year, files]) => {
    const filtered = filterFiles(files);
    if (filtered.length > 0) {
      filteredByYear[year] = filtered;
    }
  });

  return (
    <div>
      {/* ✅ CONTROLES COMPACTOS pegados a tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, marginTop: -4, alignItems: "center" }}>
        {/* Botón documento AnaP */}
        {anaPDoc && (
          <button
            onClick={() => window.open(`https://drive.google.com/file/d/${anaPDoc}/view`, "_blank")}
            style={{
              padding: "6px 10px",
              background: `${C.accent}18`,
              border: `1px solid ${C.accent}60`,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontSize: 11,
              fontWeight: 600,
              color: C.accent,
              whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            📕 Doc AnaP
          </button>
        )}
        {/* Dropdown de Año (compacto) */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{
            width: 100,
            padding: "6px 8px",
            fontFamily: "DM Sans",
            fontSize: 12,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            background: C.surface2,
            color: C.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <option value="all">Años</option>
          {yearFolders.map(year => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </select>

        {/* Búsqueda (compacta) */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: C.surface2,
          border: `1px solid ${searchTerm ? C.accent : C.border}`,
          borderRadius: 6,
          transition: "border-color 0.2s",
        }}>
          <span style={{ fontSize: 14, color: searchTerm ? C.accent : C.textMuted }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar archivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontFamily: "DM Sans",
              fontSize: 12,
              color: C.text,
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.accent,
                padding: 2,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Archivos agrupados por año */}
      {loading ? (
        <Card>
          <div style={{ textAlign: "center", padding: 20 }}>
            <Spinner />
          </div>
        </Card>
      ) : Object.keys(filteredByYear).length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(filteredByYear)
            .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
            .map(([year, files]) => (
              <div key={year}>
                {/* Header del año (solo si es "Todos") */}
                {selectedYear === "all" && (
                  <div style={{
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.accent,
                    marginBottom: 8,
                    padding: "4px 8px",
                    background: `${C.accent}10`,
                    borderRadius: 4,
                    display: "inline-block",
                  }}>
                    {year} · {files.length} archivos
                  </div>
                )}

                {/* Lista de archivos */}
                <Card>
                  {!selectedYear === "all" && (
                    <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                      📄 {files.length} archivos
                    </div>
                  )}
                  
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
                </Card>
              </div>
            ))}
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
              {searchTerm ? `No se encontraron archivos con "${searchTerm}"` : "No hay archivos"}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GastosPanel;
