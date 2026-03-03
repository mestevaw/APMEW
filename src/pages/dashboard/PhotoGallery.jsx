// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PhotoGallery.jsx
// Versión: V2
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - AuthImage con useThumbnail={false} para imagen completa en galería
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { C } from "../../lib/theme";
import AuthImage from "./AuthImage";
import { supaFetch } from "../../lib/supabase";

const PhotoGallery = ({ images, startIndex = 0, onClose, mob, token, propertyAddress }) => {
  const [index, setIndex] = useState(startIndex);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);

  const img = images[index];

  // Load notes for current image
  useEffect(() => {
    if (!img?.id) return;
    const loadNotes = async () => {
      try {
        const rows = await supaFetch("photo_notes", {
          filters: `photo_id=eq.${img.id}`,
          order: "created_at.desc"
        });
        setNotes(rows || []);
        setShowNotes((rows || []).length > 0);
      } catch (e) {
        console.error("Error loading notes:", e);
      }
    };
    loadNotes();
  }, [img?.id]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose]);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Image + Notes side by side on desktop, stacked on mobile */}
      <div style={{ display: "flex", gap: 12, alignItems: mob ? "stretch" : "center", flexDirection: mob ? "column" : "row", maxWidth: "95vw" }}>
        {/* Image */}
        <div style={{ width: mob ? "92vw" : (notes.length > 0 && showNotes ? "60vw" : "80vw"), height: mob ? "45vh" : "70vh", borderRadius: 8, overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <AuthImage
            fileId={img.google_drive_file_id || img.id}
            token={token}
            alt={img.title || img.name}
            useThumbnail={false}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Notes panel */}
        {notes.length > 0 && showNotes && (
          <div style={{ width: mob ? "92vw" : 280, maxHeight: mob ? "20vh" : "70vh", overflow: "auto", background: "rgba(30,30,40,0.9)", borderRadius: 10, padding: 14, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "white" }}>📝 Notas</span>
              <button onClick={() => setShowNotes(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notes.map(n => (
                <div key={n.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: 8, borderLeft: "3px solid rgba(255,255,255,0.2)" }}>
                  <div style={{ fontFamily: "DM Sans", fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                    {new Date(n.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "white" }}>{n.note_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 12, alignItems: "center", background: "rgba(30,30,40,0.9)", padding: "8px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
        <button onClick={goPrev} style={{ background: "none", border: "none", color: "white", fontSize: 24, cursor: "pointer", padding: "0 8px" }}>‹</button>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "white" }}>{index + 1} / {images.length}</span>
        <button onClick={goNext} style={{ background: "none", border: "none", color: "white", fontSize: 24, cursor: "pointer", padding: "0 8px" }}>›</button>
        {notes.length > 0 && !showNotes && (
          <button onClick={() => setShowNotes(true)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 10px", color: "white", fontSize: 12, cursor: "pointer", marginLeft: 8, fontFamily: "DM Sans" }}>📝 {notes.length}</button>
        )}
      </div>

      {/* Close button */}
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(30,30,40,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 20 }}>✕</button>
    </div>
  );
};

export default PhotoGallery;
