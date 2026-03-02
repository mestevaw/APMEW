// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/GastosPanel.jsx  
// Versión: 1.0
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { C } from "../../lib/theme";
import { Card, Spinner } from "../../components/UI";
import { supaFetch } from "../../lib/supabase";

const GastosPanel = ({ property, mob, drive }) => {
  const [loading, setLoading] = useState(true);
  const [yearFolders, setYearFolders] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [documents, setDocuments] = useState([]);

  // ─── Cargar años desde Supabase ───
  useEffect(() => {
    const loadYears = async () => {
      setLoading(true);
      try {
        // Buscar folders que contengan GASTOS en el path de esta propiedad
        const folders = await supaFetch("drive_folders", {
          filters: `folder_path.ilike.%${encodeURIComponent(property.address)}%GASTOS%`,
          order: "folder_path.desc",
        });

        if (!folders || folders.length === 0) {
          setYearFolders([]);
          setLoading(false);
          return;
        }

        // Filtrar solo folders de años (formato: 4 dígitos)
        const years = folders.filter(f => {
          const pathParts = f.folder_path.split('/');
          const folderName = pathParts[pathParts.length - 1];
          return /^\d{4}$/.test(folderName);
        }).map(f => ({
          id: f.google_drive_id,
          name: f.folder_path.split('/').pop(),
          path: f.folder_path,
        }));

        // Eliminar duplicados y ordenar
        const uniqueYears = Array.from(new Map(years.map(y => [y.name, y])).values())
          .sort((a, b) => b.name.localeCompare(a.name));

        setYearFolders(uniqueYears);

        // Auto-seleccionar año actual
        const currentYear = new Date().getFullYear().toString();
        const current = uniqueYears.find(y => y.name === currentYear);
        if (current) {
          setSelectedYear(current.id);
        } else if (uniqueYears.length > 0) {
          setSelectedYear(uniqueYears[0].id);
        }
      } catch (err) {
        console.error("[GastosPanel] Error loading years:", err);
      }
      setLoading(false);
    };

    loadYears();
  }, [property.address]);

  // ─── Cargar documentos cuando se selecciona un año ───
  useEffect(() => {
    if (!selectedYear) return;

    const loadDocuments = async () => {
      setLoading(true);
      try {
        // Buscar documentos en Supabase cuyo parent sea el año seleccionado
        const docs = await supaFetch("documents", {
          filters: `parent_folder_drive_id=eq.${selectedYear}`,
          order: "title.asc",
        });

        setDocuments(docs || []);
      } catch (err) {
        console.error("[GastosPanel] Error loading documents:", err);
        setDocuments([]);
      }
      setLoading(false);
    };

    loadDocuments();
  }, [selectedYear]);

  const openDocument = (doc) => {
    if (!doc.google_drive_file_id) return;
    window.open(`https://drive.google.com/file/d/${doc.google_drive_file_id}/view`, '_blank');
  };

  if (loading && yearFolders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 30 }}>
          <Spinner />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>
            Cargando gastos...
          </p>
        </div>
      </Card>
    );
  }

  if (yearFolders.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
          No hay carpeta de gastos para esta propiedad
        </div>
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

      {/* Documentos */}
      <Card>
        <div style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          📄 {documents.length} documentos
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Spinner />
          </div>
        ) : documents.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {documents.map(doc => {
              const isPDF = doc.mime_type === "application/pdf" || doc.file_type === "pdf";
              const isExcel = doc.mime_type?.includes("spreadsheet") || ["xlsx", "xls"].includes(doc.file_type);
              const isWord = doc.mime_type?.includes("document") || ["docx", "doc"].includes(doc.file_type);
              const isImage = doc.mime_type?.startsWith("image/");

              const icon = isPDF ? "📕" : isExcel ? "📗" : isWord ? "📘" : isImage ? "🖼️" : "📄";

              return (
                <button
                  key={doc.id}
                  onClick={() => openDocument(doc)}
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
                      {doc.title}
                    </div>
                    {doc.file_type && (
                      <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                        {doc.file_type.toUpperCase()}
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
              No hay documentos en este año
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GastosPanel;
