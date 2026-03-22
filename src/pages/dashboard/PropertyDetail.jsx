// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PropertyDetail.jsx
// Versión: V5
// Fecha: 2026-03-22
// ═══════════════════════════════════════════
// CAMBIOS EN V5:
// - Eliminada "Subida Masiva" del menú hamburguesa
// - "Subir Fotos" abre modal drag-and-drop (arrastra / clic / pega)
//   en lugar del input file invisible
// - findFolderByAddress recibe drive como 3er arg
// CAMBIOS EN V4 (desde V3):
// - Nuevo: Opción "Archivar Correspondencia" en menú hamburguesa
// - Abre modal CorrespondenciaUpload que lee el PDF con Claude y
//   permite seleccionar la carpeta destino dentro de la propiedad en Drive
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
import { CorrespondenciaUpload } from "../../components/CorrespondenciaUpload";

// ─── PhotoUploadModal — drag / click / paste ──────────────────────────────────
const PhotoUploadModal = ({ drive, folderId, property, mob, onClose, onComplete }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    if (!folderId) { onComplete("❌ Sin carpeta configurada para esta propiedad"); onClose(); return; }
    setUploading(true);
    try {
      const result = await drive.uploadPhotos(
        imgs, folderId, property.address,
        (cur, total, name) => setProgress(`Subiendo ${cur}/${total}: ${name.slice(0, 28)}...`)
      );
      onComplete(`✓ ${result.results.length - (result.skipped || 0)} fotos subidas${result.skipped ? `, ${result.skipped} ya existían` : ""}`);
      onClose();
    } catch (e) {
      onComplete("❌ Error: " + e.message);
      onClose();
    }
  };

  // Paste support
  useEffect(() => {
    const h = (e) => {
      const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith("image/"));
      if (files.length) handleFiles(files);
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [folderId]);

  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };
  const onClick     = () => inputRef.current?.click();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.80)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: mob ? 16 : 40,
    }}>
      <div style={{
        background: C.surface, borderRadius: 20,
        border: `1px solid ${C.border}`,
        padding: mob ? "24px 20px" : "32px 36px",
        maxWidth: 520, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📷</span>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
              Subir Fotos
            </h2>
          </div>
          {!uploading && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22, lineHeight: 1 }}>✕</button>
          )}
        </div>

        <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textDim, marginBottom: 20 }}>
          📍 {property.address}
        </div>

        {uploading ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim }}>{progress || "Subiendo..."}</div>
          </div>
        ) : (
          <>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: "none" }} />

            {/* Drop zone */}
            <div
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
              style={{
                border: `2px dashed ${dragging ? C.accent : C.border}`,
                borderRadius: 14,
                background: dragging ? `${C.accent}12` : C.surface2,
                padding: "44px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 14 }}>{dragging ? "⬇️" : "🖼️"}</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {dragging ? "Suelta las fotos aquí" : "Arrastra · Haz clic · Pega (Ctrl+V)"}
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.accent }}>
                Fotos desde cualquier fuente
              </div>
            </div>

            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, textAlign: "center" }}>
              Se guardan en Drive: {property.address} › INSPECCION › {new Date().getFullYear()} › hoy
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showCorrespondencia, setShowCorrespondencia] = useState(false);

  useEffect(() => {
    setSearching(true); setNotFound(false); setFolderId(null); setTenant(null);

    const findFolder = async () => {
      // Strategy 1: Supabase index (instantáneo — tiene el google_drive_id directo)
      try {
        const folder = await findFolderByAddress(property.address, property.owner, drive);
        if (folder?.google_drive_id) {
          console.log("[PropertyDetail] Found via Supabase:", folder.google_drive_id);
          setFolderId(folder.google_drive_id);
          setSearching(false);
          return;
        }
      } catch (err) {
        console.error("[PropertyDetail] Supabase search failed:", err);
      }
      // Strategy 2: Fallback — buscar en Drive API (más lento, solo si Supabase no tiene el registro)
      if (drive?.token && drive?.searchFolderByAddress) {
        try {
          console.log("[PropertyDetail] Supabase miss, trying Drive API for:", property.address);
          const driveResult = await drive.searchFolderByAddress(property.address, property.owner, DRIVE_ROOT_FOLDER);
          if (driveResult?.id) {
            console.log("[PropertyDetail] Found via Drive API:", driveResult);
            setFolderId(driveResult.id);
            setSearching(false);
            return;
          }
        } catch (err) {
          console.error("[PropertyDetail] Drive search failed:", err);
        }
      }
      setNotFound(true);
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
            <MenuBtn onClick={() => { setShowPhotoModal(true); setMenuOpen(false); }}>
              📷 Subir Fotos
            </MenuBtn>
            <MenuDivider />
            <MenuLabel>📂 Documentos</MenuLabel>
            <MenuBtn onClick={() => { setShowDocs(true); setMenuOpen(false); }}>
              🔍 Ver Documentos
            </MenuBtn>
            <MenuBtn onClick={() => { setShowCorrespondencia(true); setMenuOpen(false); }}>
              📬 Archivar Correspondencia
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

      {/* ✅ Property Tabs (desktop Y móvil - el componente maneja ambos casos) */}
      <PropertyTabs property={property} mob={mob} drive={drive} onInspectionPhotos={() => setInspPanel(true)} folderId={folderId} />


      {/* Photo Upload Modal — drag, click, paste */}
      {showPhotoModal && (
        <PhotoUploadModal
          drive={drive}
          folderId={folderId}
          property={property}
          mob={mob}
          onClose={() => setShowPhotoModal(false)}
          onComplete={(msg) => {
            setUploadMsg(msg);
            setTimeout(() => setUploadMsg(""), 6000);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {/* Correspondencia Upload Modal */}
      {showCorrespondencia && (
        <CorrespondenciaUpload
          drive={drive}
          folderId={folderId}
          property={property}
          mob={mob}
          onClose={() => setShowCorrespondencia(false)}
          onComplete={({ fileName }) => {
            setUploadMsg(`✓ Correspondencia archivada: ${fileName}`);
            setTimeout(() => setUploadMsg(""), 6000);
          }}
        />
      )}

      {/* ✅ ELIMINADO: Sección "Documentos en Drive" 
          Ya no es necesaria porque los documentos están en el tab "Documentos" */}
      
    </div>
  );
};

export default PropertyDetail;
