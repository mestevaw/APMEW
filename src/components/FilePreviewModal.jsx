// Componente compartido: modal de vista previa de archivos de Google Drive
// Usado en DocumentsPage y SupaExplorer
import { C } from "../lib/theme";
import { I } from "../lib/icons";
import { getPreviewUrl } from "../lib/helpers";

export const FilePreviewModal = ({ file, onClose, mob }) => {
  if (!file) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999 }} />
      <div style={{ position: "fixed", top: mob ? "2%" : "5%", left: mob ? "2%" : "10%", right: mob ? "2%" : "10%", bottom: mob ? "2%" : "5%", zIndex: 10000, display: "flex", flexDirection: "column", background: C.surface, borderRadius: 16, border: `1px solid ${C.accent}40`, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{file.name}</span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a href={`https://drive.google.com/file/d/${file.id}/view`} target="_blank" rel="noopener" style={{ fontFamily: "DM Sans", fontSize: 12, color: C.blue, textDecoration: "none", padding: "4px 10px", border: `1px solid ${C.border}`, borderRadius: 6 }}>Abrir en Drive ↗</a>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 4 }}>{I.close}</button>
          </div>
        </div>
        <iframe src={getPreviewUrl(file.id)} style={{ flex: 1, border: "none", background: "#fff" }} allow="autoplay" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" />
      </div>
    </>
  );
};
