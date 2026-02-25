// dashboard/PropertyDetail.jsx
import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { OWNER_COLORS } from "./constants";
import { fmtMoney, findFolderByAddress } from "./helpers";
import { HouseIcon } from "./icons";
import { DropMenu, MenuBtn, MenuDivider, MenuLabel, HamburgerBtn } from "./MenuComponents";
import SupaExplorer from "./SupaExplorer";
import PropertyExpenses from "./PropertyExpenses";

const PropertyDetail = ({ property, mob, drive, onBack, onOwnerClick }) => {
  const [folderId, setFolderId] = useState(null);
  const [searching, setSearching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [inspPanel, setInspPanel] = useState(false);
  const [tenant, setTenant] = useState(null);
  const uploadRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const personal = property.address.includes("Progreso") || property.address.includes("Argo"); // to refresh SupaExplorer after upload

  useEffect(() => {
    setSearching(true); setNotFound(false); setFolderId(null); setTenant(null);
    findFolderByAddress(property.address).then(folder => {
      console.log("[PropertyDetail] findFolderByAddress result:", folder ? { name: folder.name, id: folder.google_drive_id, path: folder.folder_path } : "NOT FOUND");
      if (folder) setFolderId(folder.google_drive_id);
      else setNotFound(true);
      setSearching(false);
    });
    if (!personal) {
      supaFetch("tenants", { filters: `property_address=eq.${encodeURIComponent(property.address)}`, limit: 1 })
        .then(rows => { if (rows && rows[0]) setTenant(rows[0]); });
    }
  }, [property.address]);

  const handleCameraClick = () => {
    if (!drive?.token) {
      drive?.signIn?.();
      return;
    }
    uploadRef.current?.click();
  };

  const registerInSupabase = async (dateFolder, yearFolder, inspeccionFolder, results) => {
    // Register folders in drive_folders if not already there
    const folderPath = `PROPERTY > ${property.address} > INSPECCION`;
    for (const f of [
      { name: "INSPECCION", id: inspeccionFolder.id, parent: folderId, path: folderPath },
      { name: yearFolder.name, id: yearFolder.id, parent: inspeccionFolder.id, path: `${folderPath} > ${yearFolder.name}` },
      { name: dateFolder.name, id: dateFolder.id, parent: yearFolder.id, path: `${folderPath} > ${yearFolder.name} > ${dateFolder.name}` },
    ]) {
      try {
        const exists = await supaFetch("drive_folders", { filters: `google_drive_id=eq.${f.id}` });
        if (!exists || exists.length === 0) {
          await supaInsert("drive_folders", { name: f.name, google_drive_id: f.id, parent_drive_id: f.parent, folder_path: f.path });
        }
      } catch (e) { console.error("folder register:", e); }
    }
    // Register each uploaded photo in documents
    for (const r of results) {
      try {
        const ext = (r.name || "").split(".").pop().toLowerCase();
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" };
        await supaInsert("documents", {
          title: r.name, google_drive_file_id: r.id,
          parent_folder_drive_id: dateFolder.id,
          folder_path: `${folderPath} > ${yearFolder.name} > ${dateFolder.name}`,
          category: "inspeccion",
          mime_type: mimeMap[ext] || r.mimeType || "image/jpeg",
          file_type: ext || "jpg",
        });
      } catch (e) { console.error("doc register:", e); }
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !drive?.token || !drive?.uploadPhotos || !folderId) return;
    console.log("[PropertyDetail] handleUpload using folderId:", folderId, "for property:", property.address);
    setUploading(true); setUploadMsg(`Subiendo ${files.length} fotos...`);
    try {
      const { dateFolder, results, yearFolder, inspeccionFolder } = await drive.uploadPhotos(
        files, folderId, property.address,
        (cur, total, name) => setUploadMsg(`Subiendo ${cur}/${total}...`)
      );
      // Register in Supabase so they appear in SupaExplorer
      setUploadMsg(`Indexando ${results.length} fotos...`);
      await registerInSupabase(dateFolder, yearFolder, inspeccionFolder, results);
      setUploadMsg(`✓ ${results.length} fotos subidas e indexadas`);
      setRefreshKey(k => k + 1); // refresh file list
    } catch (err) { setUploadMsg("Error: " + err.message); }
    setUploading(false); e.target.value = "";
    setTimeout(() => setUploadMsg(""), 5000);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.back}</button>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
          <span style={{ color: OWNER_COLORS[property.owner] || C.accent }}><HouseIcon /></span>
        </button>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={onBack}>
          <h1 style={{ fontFamily: "DM Sans", fontSize: mob ? 18 : 22, fontWeight: 700, color: C.text }}>{property.address}</h1>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: OWNER_COLORS[property.owner] || C.textDim }}>
            <button onClick={(e) => { e.stopPropagation(); onOwnerClick?.(property.owner); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "DM Sans", fontSize: 12, color: OWNER_COLORS[property.owner] || C.textDim, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}>{property.owner}</button>
            {property.sold ? " · Vendida" : ""}
          </span>
        </div>
        {folderId && (
          <div style={{ position: "relative" }}>
            <HamburgerBtn open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
            <DropMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
              <MenuBtn onClick={() => { setInspPanel(true); setMenuOpen(false); }}>📸 Inspección</MenuBtn>
              <MenuBtn onClick={() => { setShowDocs(!showDocs); setMenuOpen(false); }}>{showDocs ? "📂 Ocultar docs" : "📂 Ver docs"}</MenuBtn>
            </DropMenu>
          </div>
        )}
      </div>

      {uploadMsg && (
        <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: uploadMsg.startsWith("✓") ? `${C.green}15` : `${C.accent}15`, border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : C.accent}40` }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent }}>{uploadMsg}</span>
        </div>
      )}

      {/* ── Inspection Panel ── */}
      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />
      {inspPanel && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>📋 Inspección</span>
            <button onClick={() => setInspPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans", fontSize: 12, color: C.textMuted }}>✕ Cerrar</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleCameraClick} disabled={uploading} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
              fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1, minWidth: 140,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <span style={{ fontSize: 20 }}>📸</span>
              <div>
                <div style={{ fontWeight: 600 }}>Fotos</div>
                <div style={{ fontSize: 10, color: C.textDim }}>Subir fotos de inspección</div>
              </div>
            </button>
            <button onClick={() => {
              const note = prompt("Nota de inspección:");
              if (note && note.trim()) {
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10);
                supaInsert("inspection_notes", { property_address: property.address, note_date: dateStr, note_text: note.trim(), created_by: "MEW" })
                  .then(() => setUploadMsg("✓ Nota guardada"))
                  .catch(err => setUploadMsg("Error: " + err.message));
                setTimeout(() => setUploadMsg(""), 4000);
              }
            }} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer",
              fontFamily: "DM Sans", fontSize: 13, color: C.text, flex: 1, minWidth: 140,
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <span style={{ fontSize: 20 }}>📝</span>
              <div>
                <div style={{ fontWeight: 600 }}>Nota</div>
                <div style={{ fontSize: 10, color: C.textDim }}>Agregar apunte</div>
              </div>
            </button>
          </div>
        </Card>
      )}

      {/* Tenant Info */}
      {tenant && !personal && (() => {
        const leaseTo = tenant.lease_to ? new Date(tenant.lease_to) : null;
        const now = new Date();
        const mtm = tenant.month_to_month || !leaseTo;
        const expired = leaseTo && leaseTo < now;
        const soonDays = leaseTo ? Math.ceil((leaseTo - now) / 86400000) : null;
        const soon = soonDays != null && soonDays > 0 && soonDays <= 90;
        const statusColor = expired ? C.red : soon ? "#F59E0B" : mtm ? C.blue : C.green;
        const statusText = expired ? "Vencido" : mtm ? "Mes a mes" : soon ? `Vence en ${soonDays}d` : `Hasta ${leaseTo.toLocaleDateString("es-MX", { month: "short", year: "numeric" })}`;
        return (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text }}>👤 Inquilino</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${statusColor}18`, color: statusColor, fontWeight: 600 }}>{statusText}</span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.text }}>{tenant.tenant_name}</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginTop: 2 }}>
                  {tenant.bd_ba && `${tenant.bd_ba}`}{tenant.sqft ? ` · ${tenant.sqft.toLocaleString()} sqft` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, color: C.green }}>{fmtMoney(tenant.monthly_rent)}</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 10, color: C.textDim }}>/mes</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontFamily: "DM Sans", fontSize: 10, color: C.textMuted }}>
              <span>Desde: {new Date(tenant.lease_from).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
              {Number(tenant.deposit) > 0 && <span>Depósito: {fmtMoney(tenant.deposit)}</span>}
            </div>
          </Card>
        );
      })()}

      {/* Property Expenses */}
      <PropertyExpenses address={property.address} mob={mob} />

      {/* Documents toggle */}
      {searching && <Card style={{ textAlign: "center", padding: 30 }}><Spinner /><p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginTop: 12 }}>Buscando carpeta...</p></Card>}
      {notFound && !searching && (
        <Card style={{ textAlign: "center", padding: 30 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📂</div><p style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>No se encontró carpeta de Drive</p></Card>
      )}
      {folderId && (
        <>
          <button onClick={() => setShowDocs(!showDocs)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", marginBottom: 12,
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10,
            cursor: "pointer", width: "100%", fontFamily: "DM Sans", fontSize: 13, fontWeight: 500, color: C.accent,
          }}>
            <span>{showDocs ? "▼" : "▶"}</span>
            <span>📂 Documentos en Drive</span>
          </button>
          {showDocs && <SupaExplorer key={refreshKey} rootFolderId={folderId} mob={mob} drive={drive} />}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════

export default PropertyDetail;
