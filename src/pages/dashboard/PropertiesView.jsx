// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PropertiesView.jsx
// Versión: 2.0 - Tabla Mejorada
// Fecha: 2026-03-03
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { PROPERTIES, OWNER_COLORS, OWNER_SHORT } from "./constants";
import { fmtMoney, getNumber, getStreet, findFolderByAddress } from "./helpers";
import { HouseIcon } from "./icons";
import { DropMenu, MenuBtn, MenuDivider, MenuLabel, HamburgerBtn } from "./MenuComponents";
import { BulkPhotoUpload } from "../../components/BulkPhotoUpload";
import { DriveReindex } from "../../components/DriveReindex";
import { VendorSearch } from "../../components/VendorSearch";
import { BulkAnaPIndexer } from "../../components/BulkAnaPIndexer";
import { CorrespondenciaUpload } from "../../components/CorrespondenciaUpload";

const PropertiesView = ({ mob, drive, onSelectProperty, onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("address"); // address, owner, rent
  const [sortDir, setSortDir] = useState("asc"); // asc, desc
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showReindex, setShowReindex] = useState(false);
  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [showBulkAnaP, setShowBulkAnaP] = useState(false);
  const [showCorrespondencia, setShowCorrespondencia] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [rents, setRents] = useState({}); // ✅ Rentas por dirección
  const fileInputRef = useRef(null);

  // ✅ Cargar rentas de Supabase
  useEffect(() => {
    const loadRents = async () => {
      try {
        const tenants = await supaFetch("tenants", {});
        const rentMap = {};
        (tenants || []).forEach(t => {
          rentMap[t.property_address] = t.monthly_rent;
        });
        setRents(rentMap);
        console.log("[PropertiesView] Rentas cargadas:", Object.keys(rentMap).length);
      } catch (err) {
        console.error("[PropertiesView] Error loading rents:", err);
      }
    };
    loadRents();
  }, []);

  // Filtrar y ordenar propiedades
  let filtered = [...PROPERTIES];
  
  // Aplicar búsqueda
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.address.toLowerCase().includes(query) || 
      p.owner.toLowerCase().includes(query) ||
      getNumber(p.address).toString().includes(query)
    );
  }
  
  // Aplicar ordenamiento
  filtered.sort((a, b) => {
    let valA, valB;
    
    if (sortBy === "address") {
      valA = getNumber(a.address);
      valB = getNumber(b.address);
    } else if (sortBy === "owner") {
      valA = a.owner.toLowerCase();
      valB = b.owner.toLowerCase();
    } else if (sortBy === "rent") {
      valA = rents[a.address] || 0; // ✅ Usar rentas del estado
      valB = rents[b.address] || 0;
    }
    
    if (sortDir === "asc") {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  const handleStartUpload = (prop) => {
    setUploadTarget(prop);
    setMenuOpen(false);
    if (!drive?.token) { 
      setUploadMsg("Conecta Google Drive primero"); 
      setTimeout(() => setUploadMsg(""), 4000); 
      return; 
    }
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !drive?.token || !drive?.uploadPhotos || !uploadTarget) return;

    setUploading(true); 
    setUploadMsg(`Buscando carpeta de ${uploadTarget.address}...`);
    const folder = await findFolderByAddress(uploadTarget.address, uploadTarget.owner);
    if (!folder) {
      setUploadMsg("No se encontró la carpeta. Vincula manualmente primero.");
      setUploading(false); 
      return;
    }

    setUploadMsg(`Subiendo ${files.length} fotos...`);
    try {
      const { results, skipped = 0 } = await drive.uploadPhotos(
        files, folder.google_drive_id, uploadTarget.address,
        (i, total, name) => setUploadMsg(`Subiendo ${i}/${total}: ${name}`)
      );
      const newUploads = results.filter(r => !r.skipped).length;
      const msg = skipped > 0
        ? `✓ ${newUploads} nuevas, ${skipped} ya existían`
        : `✓ ${results.length} fotos subidas a ${uploadTarget.address}`;
      setUploadMsg(msg);
      setTimeout(() => setUploadMsg(""), 6000);
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`);
    }
    setUploading(false); 
    setUploadTarget(null);
    e.target.value = "";
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span style={{ color: C.textMuted, fontSize: 10 }}>⇅</span>;
    return <span style={{ color: C.accent, fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} style={{ display: "none" }} />

      {showBulkAnaP && (
        <BulkAnaPIndexer drive={drive} onClose={() => setShowBulkAnaP(false)} />
      )}

      {showVendorSearch && (
        <VendorSearch onClose={() => setShowVendorSearch(false)} />
      )}

      {showReindex && (
        <DriveReindex drive={drive} onClose={() => setShowReindex(false)} />
      )}

      {showBulkUpload && (
        <BulkPhotoUpload
          drive={drive}
          onClose={() => setShowBulkUpload(false)}
          onComplete={(results) => {
            setUploadMsg(`✓ ${results.success} fotos subidas, ${results.failed} fallidas`);
            setTimeout(() => setUploadMsg(""), 6000);
          }}
          mob={mob}
        />
      )}

      {showCorrespondencia && (
        <CorrespondenciaUpload
          drive={drive}
          mob={mob}
          onClose={() => setShowCorrespondencia(false)}
          onComplete={({ fileName }) => {
            setUploadMsg(`✓ Correspondencia archivada: ${fileName}`);
            setTimeout(() => setUploadMsg(""), 6000);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>
          {I.back}
        </button>
        <span style={{ color: C.orange }}><HouseIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.orange, flex: 1 }}>
          Maud Watson
        </h1>
        <Badge color={C.textDim}>{PROPERTIES.length}</Badge>
        
        {/* Búsqueda */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="🔍 Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: mob ? 120 : 180,
              padding: "6px 12px",
              fontFamily: "DM Sans",
              fontSize: 13,
              border: `1px solid ${searchQuery ? C.accent : C.border}`,
              borderRadius: 8,
              background: C.surface2,
              color: C.text,
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.textDim,
                padding: 2,
                display: "flex",
                fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>
        
        <div style={{ position: "relative" }}>
          <HamburgerBtn open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          <DropMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuLabel>Fotos</MenuLabel>
            {drive?.token && <MenuBtn onClick={() => { setShowBulkUpload(true); setMenuOpen(false); }}>
              📤 Subir Batch de Fotos
            </MenuBtn>}
            <MenuDivider />
            <MenuLabel>Herramientas</MenuLabel>
            {drive?.token && <MenuBtn onClick={() => { setShowReindex(true); setMenuOpen(false); }}>
              🗂️ Reindexar Drive
            </MenuBtn>}
            {drive?.token && <MenuBtn onClick={() => { setShowBulkAnaP(true); setMenuOpen(false); }}>
              🤖 Indexar Doc AnaP (todas)
            </MenuBtn>}
            <MenuDivider />
            <MenuLabel>Búsqueda</MenuLabel>
            <MenuBtn onClick={() => { setShowVendorSearch(true); setMenuOpen(false); }}>
              🔍 Buscar x Proveedor
            </MenuBtn>
            <MenuDivider />
            <MenuLabel>Documentos</MenuLabel>
            <MenuBtn onClick={() => { setShowCorrespondencia(true); setMenuOpen(false); }}>
              📬 Archivar Correspondencia
            </MenuBtn>
          </DropMenu>
        </div>
      </div>

      {/* Upload status */}
      {uploadMsg && (
        <div style={{ 
          padding: "8px 14px", 
          marginBottom: 12, 
          borderRadius: 8, 
          background: uploadMsg.startsWith("✓") ? `${C.green}15` : `${C.accent}15`, 
          border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : C.accent}40` 
        }}>
          <span style={{ 
            fontFamily: "DM Sans", 
            fontSize: 12, 
            color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent 
          }}>
            {uploadMsg}
          </span>
        </div>
      )}

      {/* ── Móvil: encabezado sticky con ordenamiento ── */}
      {mob && (
        <div
          style={{
            position: "sticky", top: 56, zIndex: 10,
            background: "#0f1117",
            display: "flex", gap: 0,
            borderBottom: `2px solid ${C.border}`,
            marginBottom: 0,
          }}
        >
          {[
            { col: "address", label: "Dirección" },
            { col: "owner",   label: "Dueño"     },
            { col: "rent",    label: "Renta"      },
          ].map(({ col, label }) => (
            <button
              key={col}
              onClick={() => handleSort(col)}
              style={{
                flex: 1, padding: "9px 6px",
                background: "none", border: "none",
                fontFamily: "DM Sans", fontSize: 12, fontWeight: 600,
                color: sortBy === col ? C.accent : C.textDim,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
              }}
            >
              {label}
              <span style={{ fontSize: 10, opacity: sortBy === col ? 1 : 0.4 }}>
                {sortBy === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Móvil: lista de 2 líneas ── */}
      {mob && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {filtered.map((prop, idx) => {
            const ownerColor = OWNER_COLORS[prop.owner] || C.textDim;
            const rent = rents[prop.address];
            return (
              <div
                key={idx}
                onClick={() => onSelectProperty(prop)}
                style={{
                  padding: "13px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer",
                  background: "transparent",
                  transition: "background 0.15s",
                }}
                onTouchStart={e => e.currentTarget.style.background = C.surface2}
                onTouchEnd={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Línea 1: Dirección + Renta */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>
                    {prop.address}
                  </span>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 700, color: rent ? C.green : C.textDim, marginLeft: 12, flexShrink: 0 }}>
                    {rent ? fmtMoney(rent) : "N/A"}
                  </span>
                </div>
                {/* Línea 2: Dueño + Estado */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: ownerColor }}>
                    {OWNER_SHORT[prop.owner] || prop.owner}
                  </span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: prop.sold ? `${C.red}20` : `${C.green}20`,
                    color: prop.sold ? C.red : C.green,
                  }}>
                    {prop.sold ? "Vendida" : "Activa"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Desktop: tabla completa ── */}
      {!mob && <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            fontFamily: "DM Sans",
          }}>
            <thead style={{ position: "sticky", top: 32, zIndex: 10 }}>
              <tr style={{ 
                background: C.surface2, 
                borderBottom: `2px solid ${C.border}` 
              }}>
                <th 
                  onClick={() => handleSort("address")}
                  style={{ 
                    padding: "12px 16px", 
                    textAlign: "left", 
                    fontWeight: 600, 
                    fontSize: 13, 
                    color: C.text,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Dirección <SortIcon column="address" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("owner")}
                  style={{ 
                    padding: "12px 16px", 
                    textAlign: "left", 
                    fontWeight: 600, 
                    fontSize: 13, 
                    color: C.text,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Dueño <SortIcon column="owner" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("rent")}
                  style={{ 
                    padding: "12px 16px", 
                    textAlign: "right", 
                    fontWeight: 600, 
                    fontSize: 13, 
                    color: C.text,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    Renta <SortIcon column="rent" />
                  </div>
                </th>
                <th style={{ 
                  padding: "12px 16px", 
                  textAlign: "center", 
                  fontWeight: 600, 
                  fontSize: 13, 
                  color: C.text 
                }}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prop, idx) => {
                const ownerColor = OWNER_COLORS[prop.owner] || C.textDim;
                return (
                  <tr 
                    key={idx}
                    onClick={() => onSelectProperty(prop)}
                    style={{ 
                      borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ 
                      padding: "12px 16px",
                      fontSize: 14,
                      color: C.text,
                      fontWeight: prop.sold ? 400 : 500,
                    }}>
                      {prop.address}
                    </td>
                    <td style={{ 
                      padding: "12px 16px",
                      fontSize: 13,
                      color: ownerColor,
                    }}>
                      {OWNER_SHORT[prop.owner] || prop.owner}
                    </td>
                    <td style={{ 
                      padding: "12px 16px",
                      fontSize: 14,
                      color: rents[prop.address] ? C.green : C.textDim, // ✅ Usar rentas del estado
                      textAlign: "right",
                      fontWeight: rents[prop.address] ? 600 : 400,
                    }}>
                      {rents[prop.address] ? fmtMoney(rents[prop.address]) : "N/A"}
                    </td>
                    <td style={{ 
                      padding: "12px 16px",
                      textAlign: "center",
                    }}>
                      {prop.sold ? (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${C.red}20`,
                          color: C.red,
                        }}>
                          Vendida
                        </span>
                      ) : (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          background: `${C.green}20`,
                          color: C.green,
                        }}>
                          Activa
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>}

      {filtered.length === 0 && (
          <div style={{ 
            padding: "40px 20px", 
            textAlign: "center",
            color: C.textDim,
            fontFamily: "DM Sans",
            fontSize: 14,
          }}>
            No se encontraron propiedades
          </div>
        )}

      {/* Resumen */}
      <div style={{ 
        marginTop: 12, 
        display: "flex", 
        gap: 16, 
        flexWrap: "wrap",
        fontFamily: "DM Sans",
        fontSize: 12,
        color: C.textDim,
      }}>
        <div>
          Total: <strong style={{ color: C.text }}>{PROPERTIES.length}</strong>
        </div>
        <div>
          Activas: <strong style={{ color: C.green }}>{PROPERTIES.filter(p => !p.sold).length}</strong>
        </div>
        <div>
          Vendidas: <strong style={{ color: C.red }}>{PROPERTIES.filter(p => p.sold).length}</strong>
        </div>
        {searchQuery && (
          <div>
            Filtradas: <strong style={{ color: C.accent }}>{filtered.length}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesView;
