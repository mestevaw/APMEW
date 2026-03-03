// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/AuthImage.jsx
// Versión: V2
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - Agregado prop useThumbnail (default: true)
// - Usa thumbnails de Google Drive para carga rápida
// - Solo carga imagen completa cuando useThumbnail=false
// ═══════════════════════════════════════════

import { useState, useEffect } from "react";
import { getDriveMediaUrl, getThumbnailUrl } from "./helpers";
import { Spinner } from "../../components/UI";

const AuthImage = ({ fileId, token, alt, style, useThumbnail = true }) => {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;

    // ⚡ OPTIMIZACIÓN: Usar thumbnail por defecto (carga 10x más rápido)
    if (useThumbnail) {
      // Thumbnail público de Google Drive (no requiere auth, muy rápido)
      setSrc(getThumbnailUrl(fileId));
      return () => { cancelled = true; };
    }

    // Solo para galería: cargar imagen completa con auth
    if (token) {
      fetch(getDriveMediaUrl(fileId), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(blob => { if (!cancelled) setSrc(URL.createObjectURL(blob)); })
        .catch(() => { if (!cancelled) setSrc(getThumbnailUrl(fileId)); });
    } else {
      setSrc(getThumbnailUrl(fileId));
    }
    
    return () => { cancelled = true; };
  }, [fileId, token, useThumbnail]);

  if (err) return <span style={{ fontSize: 24 }}>📷</span>;
  if (!src) return <Spinner />;
  return <img src={src} alt={alt || ""} style={style} onError={() => setErr(true)} />;
};

export default AuthImage;
