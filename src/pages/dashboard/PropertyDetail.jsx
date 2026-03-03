// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PropertyDetail.jsx
// Versión: V3
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V3 (desde V2):
// - Bug fix: Agregado prop "open" a DropMenu para que funcione el menú hamburguesa
// - Verificado: Flecha de regreso (onBack) funciona correctamente
// - Eliminada sección "Documentos en Drive" (ya en tab Documentos)
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/theme";
import { I } from "../../lib/icons";
import { supaFetch, supaInsert } from "../../lib/supabase";
import { Card, Badge, Spinner } from "../../components/UI";
import { OWNER_COLORS, PROPERTY_VALUES_2025 } from "./constants";
import { fmtMoney, findFolderByAddress, isPersonalProperty } from "./helpers";
import { DRIVE_ROOT_FOLDER } from "../../lib/config";
import { HouseIcon } from "./icons";
import { DropMenu, MenuBtn, MenuDivider, MenuLabel, HamburgerBtn } from "./MenuComponents";
import SupaExplorer from "./SupaExplorer";
import PropertyExpenses from "./PropertyExpenses";
import PropertyTabs from "./PropertyTabs";
import { BulkPhotoUpload } from "../../components/BulkPhotoUpload";

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
  const personal = isPersonalProperty(property.address);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  useEffect(() => {
    setSearching(true); setNotFound(false); setFolderId(null); setTenant(null);

    const findFolder = async () => {
      // Strategy 1: Search directly in Drive API (works even if Supabase index is incomplete)
      if (drive?.token && drive?.searchFolderByAddress) {
        try {
          console.log("[PropertyDetail] Searching Drive API for:", property.address);
          const driveResult = await drive.searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
          if (driveResult?.id) {
            console.log("[PropertyDetail] Found via Drive API:", driveResult);
            setFolderId(driveResult.id);
            setSearching(false);
            return;
          }
          console.log("[PropertyDetail] Not found via Drive API, trying Supabase...");
        } catch (err) {
          console.error("[PropertyDetail] Drive search failed:", err);
        }
      }
      // Strategy 2: Fallback to Supabase index
      try {
        const folder = await findFolderByAddress(property.address, property.owner);
        console.log("[PropertyDetail] Supabase result:", folder ? { name: folder.name, id: folder.google_drive_id } : "NOT FOUND");
        if (folder?.google_drive_id) setFolderId(folder.google_drive_id);
        else setNotFound(true);
      } catch (err) {
        console.error("[PropertyDetail] Supabase search failed:", err);
        setNotFound(true);
      }
      setSearching(false);
    };

    findFolder();
    if (!personal) {
      supaFetch("tenants", { filters: `property_address=eq.${encodeURIComponent(property.address)}`, limit: 1 })
        .then(rows => { if (rows && rows[0]) setTenant(rows[0]); });
    }
  }, [property.address, drive?.token]);

  const handleCameraClick = () => {
    if (!drive?.token) {
      setUploadMsg("Conecta Google Drive primero (botón en la barra lateral)");
      setTimeout(() => setUploadMsg(""), 4000);
      return;
    }
    uploadRef.current?.click();
  };

  const registerInSupabase = async (dateFolder, yearFolder, inspeccionFolder, results) => {
    let basePath = "";
    try {
      const parentRows = await supaFetch("drive_folders", { filters: `google_drive_id=eq.${folderId}` });
      if (parentRows && parentRows[0]) basePath = parentRows[0].folder_path;
    } catch (e) { console.error("lookup parent path:", e); }
    if (!basePath) basePath = `PROPERTY > ${property.address}`;

    const inspecPath = `${basePath}/${inspeccionFolder.name}`;
    const yearPath = `${inspecPath}/${yearFolder.name}`;
    const datePath = `${yearPath}/${dateFolder.name}`;

    for (const f of [
      { name: inspeccionFolder.name, id: inspeccionFolder.id, parent: folderId, path: inspecPath },
      { name: yearFolder.name, id: yearFolder.id, parent: inspeccionFolder.id, path: yearPath },
      { name: dateFolder.name, id: dateFolder.id, parent: yearFolder.id, path: datePath },
    ]) {
      try {
        const exists = await supaFetch("drive_folders", { filters: `google_drive_id=eq.${f.id}` });
        if (!exists || exists.length === 0) {
          await supaInsert("drive_folders", { name: f.name, google_drive_id: f.id, parent_drive_id: f.parent, folder_path: f.path });
        }
      } catch (e) { console.error("supa folder insert:", e); }
    }

    for (const r of results) {
      if (r.id) {
        try {
          await supaInsert("documents", {
            title: r.name, google_drive_file_id: r.id,
            mime_type: r.mimeType, file_type: (r.name || "").split(".").pop().toLowerCase(),
            folder_path: datePath, parent_folder_drive_id: dateFolder.id,
            synced_from_drive: true,
          });
        } catch (e) { console.error("supa doc insert:", e); }
      }
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadMsg(`Subiendo ${files.length} fotos...`);
    try {
      const result = await drive.uploadPhotos(files, folderId, property.address, (cur, total, name) => {
        setUploadMsg(`Subiendo ${cur}/${total}: ${name.slice(0, 30)}...`);
      });
      setUploadMsg(`✓ ${result.results.length} fotos subidas`);
      if (result.results.length > 0) {
        await registerInSupabase(result.dateFolder, result.yearFolder, result.inspeccionFolder, result.results);
      }
      setTimeout(() => setUploadMsg(""), 6000);
    } catch (err) {
      console.error(err);
      setUploadMsg("Error: " + err.message);
    }
    setUploading(false);
    e.target.value = "";
  };

  const ownerColor = OWNER_COLORS[property.owner] || C.accent;

  return (
    <div>
      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* ✅ Flecha de regreso - VERIFICADA */}
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, padding: 4, display: "flex" }}>
            {I.back}
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <HouseIcon size={24} color={ownerColor} />
              <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
                {property.address}
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => onOwnerClick(property.owner)} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontFamily: "DM Sans", fontSize: 13, color: ownerColor, textDecoration: "underline",
              }}>{property.owner}</button>
              {personal && (
                <Badge color={C.green} style={{ fontSize: 10 }}>Personal</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Menu hamburguesa - ✅ FIX: Agregado prop "open" */}
        <div style={{ position: "relative" }}>
          <HamburgerBtn open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          <DropMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuLabel>📸 Inspecciones</MenuLabel>
            <MenuBtn onClick={() => { handleCameraClick(); setMenuOpen(false); }}>
              📷 Subir Fotos
            </MenuBtn>
            <MenuBtn onClick={() => { setShowBulkUpload(true); setMenuOpen(false); }}>
              📦 Subida Masiva
            </MenuBtn>
            <MenuDivider />
            <MenuLabel>📂 Documentos</MenuLabel>
            <MenuBtn onClick={() => { setShowDocs(true); setMenuOpen(false); }}>
              🔍 Ver Documentos
            </MenuBtn>
          </DropMenu>
        </div>
      </div>

      {uploadMsg && (
        <div style={{
          padding: "8px 12px", marginBottom: 16, borderRadius: 8,
          background: uploadMsg.startsWith("✓") ? `${C.green}15` : uploadMsg.startsWith("Error") ? `${C.red}15` : `${C.accent}15`,
          border: `1px solid ${uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent}40`,
        }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: uploadMsg.startsWith("✓") ? C.green : uploadMsg.startsWith("Error") ? C.red : C.accent }}>
            {uploadMsg}
          </span>
        </div>
      )}

      {/* Tenant info (solo rental) */}
      {(() => {
        if (personal || !tenant) return null;
        return (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim, marginBottom: 2 }}>👤 Inquilino</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 2 }}>{tenant.tenant_name}</div>
                <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textDim }}>{property.beds}/{property.baths} · {property.sqft} sqft</div>
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

      {/* Property Tabs (solo en desktop) */}
      {!mob && <PropertyTabs property={property} mob={mob} drive={drive} onInspectionPhotos={() => setInspPanel(true)} folderId={folderId} />}

      {/* Mobile: mantener vista original */}
      {mob && (
        <>
          {/* Property Value 2025 */}
          {PROPERTY_VALUES_2025[property.address] && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 16 }}>
              <div style={{
                padding: "10px 12px", background: `${C.accent}10`, borderRadius: 8,
                border: `1px solid ${C.accent}40`, textAlign: "left",
              }}>
                <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.accent }}>🏠 Valor 2025</div>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: 14, fontWeight: 600, color: C.accent, marginTop: 4 }}>
                  {fmtMoney(PROPERTY_VALUES_2025[property.address])}
                </div>
              </div>
            </div>
          )}

          {/* Property Expenses */}
          <PropertyExpenses address={property.address} mob={mob} />
        </>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkPhotoUpload
          drive={drive}
          onClose={() => setShowBulkUpload(false)}
          onComplete={(results) => {
            setUploadMsg(`✓ ${results.success} fotos subidas, ${results.failed} fallidas`);
            setTimeout(() => setUploadMsg(""), 6000);
            setRefreshKey(k => k + 1);
          }}
          mob={mob}
        />
      )}

      {/* ✅ ELIMINADO: Sección "Documentos en Drive" 
          Ya no es necesaria porque los documentos están en el tab "Documentos" */}
      
    </div>
  );
};

export default PropertyDetail;
