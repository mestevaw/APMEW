// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PropertiesView.jsx
// Versión: V3 — Subtotales por Dueño + Total Global
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - Subtotales por dueño cuando se ordena por "Dueño"
// - Total global siempre visible al final de la tabla
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

const PropertiesView = ({ mob, drive, onSelectProperty, onBack }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("address"); // address, owner, rent
  const [sortDir, setSortDir] = useState("asc");   // asc, desc
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [rents, setRents] = useState({});
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

  // ─── Filtrar ───
  let filtered = [...PROPERTIES];
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.address.toLowerCase().includes(query) ||
      p.owner.toLowerCase().includes(query) ||
      getNumber(p.address).toString().includes(query)
    );
  }

  // ─── Ordenar ───
  filtered.sort((a, b) => {
    let valA, valB;
    if (sortBy === "address") {
      valA = getNumber(a.address);
      valB = getNumber(b.address);
    } else if (sortBy === "owner") {
      valA = a.owner.toLowerCase();
      valB = b.owner.toLowerCase();
    } else if (sortBy === "rent") {
      valA = rents[a.address] || 0;
      valB = rents[b.address] || 0;
    }
    return sortDir === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  // ─── Calcular totales ───
  const grandTotal = filtered.reduce((sum, p) => sum + (rents[p.address] || 0), 0);
  const grandTotalCount = filtered.filter(p => rents[p.address]).length;

  // ─── Agrupar por dueño (solo cuando sortBy === "owner") ───
  const buildOwnerGroups = () => {
    const groups = [];
    const seen = {};
    filtered.forEach(prop => {
      if (!seen[prop.owner]) {
        seen[prop.owner] = { owner: prop.owner, props: [] };
        groups.push(seen[prop.owner]);
      }
      seen[prop.owner].props.push(prop);
    });
    return groups.map(g => ({
      ...g,
      subtotal: g.props.reduce((sum, p) => sum + (rents[p.address] || 0), 0),
      rentCount: g.props.filter(p => rents[p.address]).length,
    }));
  };

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

  // ─── Estilos compartidos de celdas ───
  const cellBase = { padding: "12px 16px", fontFamily: "DM Sans" };

  // ─── Fila de Subtotal ───
  const SubtotalRow = ({ owner, count, subtotal, rentCount }) => {
    const ownerColor = OWNER_COLORS[owner] || C.textDim;
    return (
      <tr style={{ background: `${ownerColor}12`, borderBottom: `2px solid ${ownerColor}40` }}>
        <td colSpan={2} style={{
          ...cellBase,
          fontSize: 12,
          fontWeight: 700,
          color: ownerColor,
          paddingLeft: 24,
        }}>
          Subtotal {OWNER_SHORT[owner] || owner}
          <span style={{ fontWeight: 400, color: C.textDim, marginLeft: 8 }}>
            ({count} prop{count !== 1 ? "s" : ""}, {rentCount} con renta)
          </span>
        </td>
        <td style={{
          ...cellBase,
          textAlign: "right",
          fontSize: 13,
          fontWeight: 700,
          color: subtotal > 0 ? ownerColor : C.textDim,
        }}>
          {subtotal > 0 ? fmtMoney(subtotal) : "—"}
        </td>
        <td />
      </tr>
    );
  };

  // ─── Fila de Total Global ───
  const GrandTotalRow = () => (
    <tr style={{
      background: `${C.accent}18`,
      borderTop: `2px solid ${C.accent}60`,
    }}>
      <td colSpan={2} style={{
        ...cellBase,
        fontSize: 13,
        fontWeight: 700,
        color: C.text,
        paddingLeft: 24,
      }}>
        TOTAL GLOBAL
        <span style={{ fontWeight: 400, color: C.textDim, marginLeft: 8 }}>
          ({filtered.length} props, {grandTotalCount} con renta)
        </span>
      </td>
      <td style={{
        ...cellBase,
        textAlign: "right",
        fontSize: 14,
        fontWeight: 800,
        color: grandTotal > 0 ? C.green : C.textDim,
      }}>
        {grandTotal > 0 ? fmtMoney(grandTotal) : "—"}
      </td>
      <td />
    </tr>
  );

  // ─── Filas de propiedad ───
  const PropertyRow = ({ prop, idx }) => {
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
        <td style={{ ...cellBase, fontSize: 14, color: C.text, fontWeight: prop.sold ? 400 : 500 }}>
          {prop.address}
        </td>
        <td style={{ ...cellBase, fontSize: 13, color: ownerColor }}>
          {OWNER_SHORT[prop.owner] || prop.owner}
        </td>
        <td style={{
          ...cellBase,
          fontSize: 14,
          color: rents[prop.address] ? C.green : C.textDim,
          textAlign: "right",
          fontWeight: rents[prop.address] ? 600 : 400,
        }}>
          {rents[prop.address] ? fmtMoney(rents[prop.address]) : "N/A"}
        </td>
        <td style={{ ...cellBase, textAlign: "center" }}>
          {prop.sold ? (
            <span style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${C.red}20`, color: C.red }}>
              Vendida
            </span>
          ) : (
            <span style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${C.green}20`, color: C.green }}>
              Activa
            </span>
          )}
        </td>
      </tr>
    );
  };

  // ─── Renderizar cuerpo de tabla ───
  const renderTableBody = () => {
    if (sortBy === "owner") {
      const groups = buildOwnerGroups();
      return (
        <>
          {groups.map((group) => (
            <>
              {group.props.map((prop, idx) => (
                <PropertyRow key={`${group.owner}-${idx}`} prop={prop} idx={idx} />
              ))}
              <SubtotalRow
                key={`sub-${group.owner}`}
                owner={group.owner}
                count={group.props.length}
                subtotal={group.subtotal}
                rentCount={group.rentCount}
              />
            </>
          ))}
          <GrandTotalRow />
        </>
      );
    }

    // Ordenamiento normal (address / rent)
    return (
      <>
        {filtered.map((prop, idx) => (
          <PropertyRow key={idx} prop={prop} idx={idx} />
        ))}
        <GrandTotalRow />
      </>
    );
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} style={{ display: "none" }} />

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
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: C.textDim, padding: 2, display: "flex", fontSize: 16,
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
            {drive?.token && <MenuBtn onClick={() => setMenuOpen(false)}>✅ Drive conectado</MenuBtn>}
            {drive?.token && (
              <MenuBtn onClick={() => { setShowBulkUpload(true); setMenuOpen(false); }}>
                📤 Subir Batch de Fotos
              </MenuBtn>
            )}
          </DropMenu>
        </div>
      </div>

      {/* Upload status */}
      {uploadMsg && (
        <div style={{
          padding: "8px 14px", marginBottom: 12, borderRadius: 8,
          background: uploadMsg.startsWith("✓") ? `${C.green}15` : `${C.accent}15`,
          border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : C.accent}40`,
        }}>
          <span style={{
            fontFamily: "DM Sans", fontSize: 12,
            color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent,
          }}>
            {uploadMsg}
          </span>
        </div>
      )}

      {/* Tabla */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans" }}>
            <thead>
              <tr style={{ background: C.surface2, borderBottom: `2px solid ${C.border}` }}>
                <th onClick={() => handleSort("address")} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.text, cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>Dirección <SortIcon column="address" /></div>
                </th>
                <th onClick={() => handleSort("owner")} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.text, cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>Dueño <SortIcon column="owner" /></div>
                </th>
                <th onClick={() => handleSort("rent")} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontSize: 13, color: C.text, cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>Renta <SortIcon column="rent" /></div>
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, fontSize: 13, color: C.text }}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "40px 20px", textAlign: "center", color: C.textDim, fontFamily: "DM Sans", fontSize: 14 }}>
                    No se encontraron propiedades
                  </td>
                </tr>
              ) : (
                renderTableBody()
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Resumen */}
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "DM Sans", fontSize: 12, color: C.textDim }}>
        <div>Total: <strong style={{ color: C.text }}>{PROPERTIES.length}</strong></div>
        <div>Activas: <strong style={{ color: C.green }}>{PROPERTIES.filter(p => !p.sold).length}</strong></div>
        <div>Vendidas: <strong style={{ color: C.red }}>{PROPERTIES.filter(p => p.sold).length}</strong></div>
        {searchQuery && <div>Filtradas: <strong style={{ color: C.accent }}>{filtered.length}</strong></div>}
      </div>
    </div>
  );
};

export default PropertiesView;
