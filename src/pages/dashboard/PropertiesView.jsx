// src/pages/dashboard/PropertiesView.jsx
import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { PROPERTIES, OWNER_COLORS, OWNER_SHORT } from "./constants";
import { fmtMoney, getNumber, getStreet, findFolderByAddress } from "./helpers";
import { HouseIcon } from "./icons";
import { DropMenu, MenuBtn, MenuDivider, MenuLabel, HamburgerBtn } from "./MenuComponents";

const PropertiesView = ({ mob, drive, onSelectProperty, onBack }) => {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("number");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null); // property for upload
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef(null);

  const owners = [...new Set(PROPERTIES.filter(p => !p.sold).map(p => p.owner))];
  const activeProps = PROPERTIES.filter(p => !p.sold);
  let filtered = filter === "all" ? [...activeProps] : filter === "vendidas" ? PROPERTIES.filter(p => p.sold) : PROPERTIES.filter(p => p.owner === filter && !p.sold);
  if (sortBy === "number") filtered.sort((a, b) => getNumber(a.address) - getNumber(b.address));
  else filtered.sort((a, b) => getStreet(a.address).localeCompare(getStreet(b.address)));

  const handleStartUpload = (prop) => {
    setUploadTarget(prop);
    setMenuOpen(false);
    if (!drive?.token) { setUploadMsg("Conecta Google Drive primero (botón en la barra lateral)"); setTimeout(() => setUploadMsg(""), 4000); return; }
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !drive?.token || !drive?.uploadPhotos || !uploadTarget) return;

    // Find folder ID for this property
    setUploading(true); setUploadMsg(`Buscando carpeta de ${uploadTarget.address}...`);
    const folder = await findFolderByAddress(uploadTarget.address, uploadTarget.owner);
    if (!folder) {
      setUploadMsg("No se encontró la carpeta. Vincula manualmente primero.");
      setUploading(false); return;
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
    setUploading(false); setUploadTarget(null);
    e.target.value = "";
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} style={{ display: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <span style={{ color: C.accent }}><HouseIcon /></span>
        <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 20 : 24, fontWeight: 700, color: C.accent, flex: 1 }}>Propiedades</h1>
        <Badge color={C.textDim}>{activeProps.length}</Badge>
        <div style={{ position: "relative" }}>
          <HamburgerBtn open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          <DropMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuLabel>Ordenar</MenuLabel>
            <MenuBtn onClick={() => { setSortBy("number"); setMenuOpen(false); }} active={sortBy === "number"}>
              # Número {sortBy === "number" && "✓"}
            </MenuBtn>
            <MenuBtn onClick={() => { setSortBy("street"); setMenuOpen(false); }} active={sortBy === "street"}>
              🏠 Calle {sortBy === "street" && "✓"}
            </MenuBtn>
            <MenuDivider />
            <MenuLabel>Fotos</MenuLabel>
            {drive?.token && <MenuBtn onClick={() => setMenuOpen(false)}>✅ Drive conectado</MenuBtn>}
          </DropMenu>
        </div>
      </div>

      {/* Upload status */}
      {uploadMsg && (
        <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: uploadMsg.startsWith("✓") ? `${C.green}15` : `${C.accent}15`, border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : C.accent}40` }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent }}>{uploadMsg}</span>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={{
          padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === "all" ? C.accent : C.border}`,
          background: filter === "all" ? C.accentGlow : "transparent", cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: filter === "all" ? C.accent : C.textDim,
        }}>Todas ({activeProps.length})</button>
        {owners.map(o => {
          const count = activeProps.filter(p => p.owner === o).length;
          const color = OWNER_COLORS[o] || C.textDim;
          return (
            <button key={o} onClick={() => setFilter(o)} style={{
              padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === o ? color : C.border}`,
              background: filter === o ? `${color}18` : "transparent", cursor: "pointer",
              fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: filter === o ? color : C.textDim,
            }}>{(OWNER_SHORT[o] || o)} ({count})</button>
          );
        })}
        <button onClick={() => setFilter("vendidas")} style={{
          padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === "vendidas" ? "#EF4444" : C.border}`,
          background: filter === "vendidas" ? "#EF444418" : "transparent", cursor: "pointer",
          fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: filter === "vendidas" ? "#EF4444" : C.textDim,
        }}>Vendidas ({PROPERTIES.filter(p => p.sold).length})</button>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((prop, i) => (
            <button key={i} onClick={() => onSelectProperty(prop)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "transparent", border: "none", cursor: "pointer", borderRadius: 8,
              textAlign: "left", width: "100%",
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: prop.sold ? C.textMuted : (OWNER_COLORS[prop.owner] || C.textDim), opacity: prop.sold ? 0.5 : 1 }}><HouseIcon /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: prop.sold ? 400 : 500, color: prop.sold ? C.textDim : C.text }}>{prop.address}</div>
              </div>
              <Badge color={OWNER_COLORS[prop.owner] || C.textDim}>{OWNER_SHORT[prop.owner] || prop.owner}</Badge>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};


export default PropertiesView;
