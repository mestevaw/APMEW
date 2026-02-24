// dashboard/PhotoGallery.jsx
import { useState, useCallback, useEffect } from "react";
import { C } from "../../lib/theme";
import AuthImage from "./AuthImage";
import { getThumbnailUrl } from "./helpers";
import { ArrowLeft, ArrowRight } from "./icons";

const PhotoGallery = ({ images, startIndex, onClose, mob, token }) => {
  const [idx, setIdx] = useState(startIndex || 0);
  const img = images[idx];
  const prev = () => setIdx(i => i > 0 ? i - 1 : images.length - 1);
  const next = () => setIdx(i => i < images.length - 1 ? i + 1 : 0);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!img) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999 }} />
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0 20px" }}>
        {/* Header */}
        <div style={{ position: "absolute", top: 12, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 8 }}>{img.title || img.name} — {idx + 1}/{images.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`https://drive.google.com/file/d/${img.google_drive_file_id || img.id}/view`} target="_blank" rel="noopener" style={{ fontFamily: "DM Sans", fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 8, textDecoration: "none" }}>Abrir en Drive ↗</a>
            <button onClick={onClose} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 18 }}>✕</button>
          </div>
        </div>

        {/* Image */}
        <div style={{ width: mob ? "92vw" : "80vw", height: mob ? "55vh" : "70vh", borderRadius: 8, overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AuthImage
            fileId={img.google_drive_file_id || img.id}
            token={token}
            alt={img.title || img.name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Navigation arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 24 : 40, marginTop: 16 }}>
          <button onClick={prev} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", color: "#fff", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}>
            <ArrowLeft />
          </button>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{idx + 1} / {images.length}</span>
          <button onClick={next} style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", color: "#fff", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.3)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}>
            <ArrowRight />
          </button>
        </div>
      </div>
    </>
  );
};


export default PhotoGallery;
