// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V7 — GPS + Reverse Geocoding como fuente primaria
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// ESTRATEGIA (en orden de prioridad):
//   FECHA:     1. EXIF DateTimeOriginal  2. OCR  3. null
//   DIRECCIÓN: 1. EXIF GPS → Nominatim  2. OCR  3. null
//
// OpenStreetMap Nominatim: gratis, sin API key
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";

// ════════════════════════════════════════════
// EXIF — Lector binario sin librería externa
// ════════════════════════════════════════════

/**
 * Lee fecha + GPS del EXIF binario de un JPEG
 * @param {File} file
 * @returns {Promise<{ date: Date|null, lat: number|null, lon: number|null }>}
 */
export const extractExifData = async (file) => {
  const out = { date: null, lat: null, lon: null };
  try {
    const buffer = await file.arrayBuffer();
    const view   = new DataView(buffer);
    if (view.getUint16(0) !== 0xFFD8) return out; // No es JPEG

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        parseApp1Segment(view, offset + 4, out);
        if (out.date && out.lat !== null) break; // Tenemos todo
      }
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  } catch (err) {
    console.warn("[EXIF] Error leyendo archivo:", err.message);
  }
  return out;
};

const parseApp1Segment = (view, start, out) => {
  try {
    // Verificar firma "Exif\0\0"
    const sig = String.fromCharCode(
      view.getUint8(start), view.getUint8(start + 1),
      view.getUint8(start + 2), view.getUint8(start + 3)
    );
    if (sig !== "Exif") return;

    const tiff   = start + 6;
    const le     = view.getUint16(tiff) === 0x4949; // little-endian
    const u16    = (o) => view.getUint16(tiff + o, le);
    const u32    = (o) => view.getUint32(tiff + o, le);
    const ratio  = (o) => { const n = u32(o), d = u32(o + 4); return d ? n / d : 0; };

    const ifd0   = u32(4);
    const n0     = u16(ifd0);
    let exifOff  = null;
    let gpsOff   = null;

    for (let i = 0; i < n0; i++) {
      const e   = ifd0 + 2 + i * 12;
      const tag = u16(e);
      if (tag === 0x8769) exifOff = u32(e + 8);
      if (tag === 0x8825) gpsOff  = u32(e + 8);
    }

    // ── Fecha desde ExifIFD (tag 0x9003) ────────────────────────────────
    if (!out.date && exifOff) {
      const ne = u16(exifOff);
      for (let i = 0; i < ne; i++) {
        const e   = exifOff + 2 + i * 12;
        const tag = u16(e);
        if (tag === 0x9003 || tag === 0x0132) {
          const vo = u32(e + 8);
          let s    = "";
          for (let c = 0; c < 19; c++) {
            const ch = view.getUint8(tiff + vo + c);
            if (!ch) break;
            s += String.fromCharCode(ch);
          }
          const d = exifStrToDate(s);
          if (d) { out.date = d; break; }
        }
      }
    }

    // ── GPS desde GPSIFD ─────────────────────────────────────────────────
    if (gpsOff) {
      const ng  = u16(gpsOff);
      const g   = {};
      for (let i = 0; i < ng; i++) {
        const e   = gpsOff + 2 + i * 12;
        const tag = u16(e);
        const vo  = u32(e + 8);
        if (tag === 1 || tag === 3) {
          // GPSLatitudeRef / GPSLongitudeRef — ASCII 1 char
          g[tag] = String.fromCharCode(view.getUint8(tiff + vo));
        }
        if (tag === 2 || tag === 4) {
          // GPSLatitude / GPSLongitude — 3 rationals (deg, min, sec)
          g[tag] = ratio(vo) + ratio(vo + 8) / 60 + ratio(vo + 16) / 3600;
        }
      }
      if (g[2] != null && g[4] != null) {
        out.lat = parseFloat(((g[1] === "S" ? -1 : 1) * g[2]).toFixed(7));
        out.lon = parseFloat(((g[3] === "W" ? -1 : 1) * g[4]).toFixed(7));
        console.log("[EXIF] GPS:", out.lat, out.lon);
      }
    }
  } catch (err) {
    console.warn("[EXIF] parseApp1 error:", err.message);
  }
};

const exifStrToDate = (s) => {
  // "2026:03:03 10:48:57"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (y < 2000 || y > 2100) return null;
  return new Date(y, mo - 1, d, 12, 0, 0);
};

// ════════════════════════════════════════════
// REVERSE GEOCODING — Nominatim (OpenStreetMap)
// Gratis, sin API key, respeta 1 req/seg
// ════════════════════════════════════════════

/**
 * Convierte coordenadas GPS en número + nombre de calle.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ houseNumber, road, clean, full } | null>}
 */
export const reverseGeocode = async (lat, lon) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    console.log("[Geocode] →", lat, lon);

    const res  = await fetch(url, {
      headers: {
        "Accept-Language": "en-US,en",
        "User-Agent": "APMEW-PropertyApp/1.0",
      },
    });
    if (!res.ok) { console.warn("[Geocode] HTTP:", res.status); return null; }

    const data = await res.json();
    const addr = data.address || {};
    const num  = addr.house_number || "";
    const road = addr.road || addr.pedestrian || addr.path || "";

    if (!num || !road) {
      console.warn("[Geocode] Sin número o calle en respuesta:", addr);
      return null;
    }

    // Versión limpia: sin sufijos de tipo de calle
    const cleanRoad = road
      .replace(/\b(Drive|Dr|Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Way|Wy|Court|Ct|Trail|Trl|Boulevard|Blvd|Place|Pl)\b\.?/gi, "")
      .replace(/\s+/g, " ").trim();

    const clean = `${num} ${cleanRoad}`.trim();
    const full  = `${num} ${road}`.trim();

    console.log("[Geocode] Resultado:", full, "| Clean:", clean);
    return { houseNumber: num, road, clean, full };
  } catch (err) {
    console.warn("[Geocode] Error:", err.message);
    return null;
  }
};

// ════════════════════════════════════════════
// OCR — Solo como último recurso
// ════════════════════════════════════════════

const preprocessForOCR = async (imageFile) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img   = new Image();
      img.onerror = reject;
      img.onload  = () => {
        // Esquina superior derecha, escala 2x
        const cW = Math.min(img.width  * 0.65, 500);
        const cH = Math.min(img.height * 0.22, 300);
        const cX = img.width - cW;
        const sc = 2;
        const W  = cW * sc, H = cH * sc;

        const make = (transform) => {
          const c   = document.createElement("canvas");
          c.width   = W; c.height = H;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, cX, 0, cW, cH, 0, 0, W, H);
          const id  = ctx.getImageData(0, 0, W, H);
          for (let i = 0; i < id.data.length; i += 4) {
            const g = id.data[i] * 0.299 + id.data[i+1] * 0.587 + id.data[i+2] * 0.114;
            const v = transform(g);
            id.data[i] = id.data[i+1] = id.data[i+2] = v;
          }
          ctx.putImageData(id, 0, 0);
          return c.toDataURL("image/png");
        };

        resolve([
          make(g => 255 - g),         // Invertida (texto blanco → negro)
          make(g => g),                // Escala de grises
          make(g => g > 200 ? 0 : 255), // Threshold
        ]);
      };
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
};

export const extractTextFromImage = async (imageFile) => {
  try {
    const imgs = await preprocessForOCR(imageFile);
    const opts = { logger: () => {}, tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT };
    const texts = await Promise.all(imgs.map(img =>
      Tesseract.recognize(img, "eng", opts).then(r => r.data.text || "")
    ));
    const addrPat = /\b\d{4,6}\s+[A-Za-z]/;
    return texts.find(t => addrPat.test(t)) || texts.sort((a, b) => b.length - a.length)[0] || "";
  } catch (err) {
    return "";
  }
};

export const parsePhotoDate = (text) => {
  const m = text.match(/\b([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (!m) return null;
  const mm = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
               january:0,february:1,march:2,april:3,june:5,july:6,august:7,
               september:8,october:9,november:10,december:11 };
  const mo = mm[m[1].toLowerCase()];
  return mo != null ? new Date(+m[3], mo, +m[2], 12) : null;
};

export const parsePhotoAddress = (text) => {
  for (const line of text.split("\n").map(l => l.trim()).filter(l => l.length > 3).slice(0, 8)) {
    if (/\d{4}.*at.*[AP]M/i.test(line)) continue;
    if (/(TX|Texas|United States|USA|San Antonio)/i.test(line)) continue;
    const m = line.match(/^(\d{4,6})\s+([A-Za-z]+(?: [A-Za-z]+){0,4})(?:\s|$)/);
    if (m) return `${m[1]} ${m[2].trim()}`;
  }
  return null;
};

export const dateToFolderName = (date) =>
  `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;

// ════════════════════════════════════════════
// MATCH de dirección vs. lista de propiedades
// ════════════════════════════════════════════
const matchToProperty = (addressStr, houseNumber, properties) => {
  if (!houseNumber) return null;
  const cands = properties.filter(p => (p.address.match(/^\d+/) || [])[0] === houseNumber);
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];

  // Desempate por tokens de la calle
  const qTokens = addressStr.toLowerCase().replace(/^\d+\s*/, "").split(/\s+/);
  let best = cands[0], bestScore = 0;
  for (const p of cands) {
    const pTokens = p.address.toLowerCase().replace(/^\d+\s*/, "").split(/\s+/);
    const score   = qTokens.filter(t => pTokens.some(pt => pt.startsWith(t) || t.startsWith(pt))).length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
};

// ════════════════════════════════════════════
// PUNTO DE ENTRADA PRINCIPAL
// ════════════════════════════════════════════
export const extractPhotoMetadata = async (imageFile, properties) => {
  console.log("[Meta] ═══ Iniciando:", imageFile.name);

  // 1. EXIF (fecha + GPS simultáneos, muy rápido)
  const exif = await extractExifData(imageFile);

  let date          = exif.date;
  let address       = null;
  let matchedProp   = null;
  let dateSource    = exif.date ? "exif" : null;
  let addrSource    = null;

  // 2. GPS → Nominatim (si hay coordenadas)
  if (exif.lat !== null && exif.lon !== null) {
    const geo = await reverseGeocode(exif.lat, exif.lon);
    if (geo) {
      // Intentar match con versión limpia primero, luego con sufijo
      matchedProp = matchToProperty(geo.clean, geo.houseNumber, properties)
                 || matchToProperty(geo.full,  geo.houseNumber, properties);
      address    = geo.clean;
      addrSource = "gps";
      console.log("[Meta] GPS match:", matchedProp?.address || "ninguno");
    }
  }

  // 3. OCR como último recurso (si no hubo match por GPS)
  if (!matchedProp) {
    console.log("[Meta] Fallback a OCR...");
    const raw     = await extractTextFromImage(imageFile);
    const ocrAddr = parsePhotoAddress(raw);
    const ocrDate = parsePhotoDate(raw);

    if (!date && ocrDate)  { date = ocrDate; dateSource = "ocr"; }

    if (ocrAddr) {
      address    = ocrAddr;
      addrSource = "ocr";
      const num  = (ocrAddr.match(/^\d+/) || [])[0];
      matchedProp = matchToProperty(ocrAddr, num, properties);
      console.log("[Meta] OCR match:", matchedProp?.address || "ninguno");
    }
  }

  console.log("[Meta] Final →", {
    fecha: date?.toDateString(), fuenteFecha: dateSource,
    dir: address, fuenteDir: addrSource,
    match: matchedProp?.address || "—",
  });

  return { date, dateSource, address, addressSource: addrSource, matchedProperty: matchedProp, fileName: imageFile.name };
};
