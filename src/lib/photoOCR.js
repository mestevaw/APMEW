// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V8 — ImageDescription EXIF como fuente primaria
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// ESTRATEGIA (en orden de prioridad):
//
//   DIRECCIÓN: 1. EXIF ImageDescription  (0x010E)  ← Timestamp Camera lo pone aquí
//              2. EXIF UserComment        (0x9286)  ← segundo lugar donde lo escribe
//              3. GPS → Nominatim         (fallback)
//              4. OCR                     (último recurso)
//
//   FECHA:     1. EXIF DateTimeOriginal  (0x9003)
//              2. EXIF DateTime          (0x0132)
//              3. OCR                     (último recurso)
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";

// ════════════════════════════════════════════
// EXIF — Lector binario sin librería externa
// ════════════════════════════════════════════

/**
 * Lee EXIF completo: ImageDescription + fecha + GPS
 * @param {File} file
 * @returns {Promise<{ description: string|null, date: Date|null, lat: number|null, lon: number|null }>}
 */
export const extractExifData = async (file) => {
  const out = { description: null, date: null, lat: null, lon: null };
  try {
    const buffer = await file.arrayBuffer();
    const view   = new DataView(buffer);
    if (view.getUint16(0) !== 0xFFD8) return out;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xFFE1) {
        parseApp1(view, offset + 4, out);
        // Si ya tenemos descripción y fecha, no hace falta seguir
        if (out.description && out.date) break;
      }
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  } catch (err) {
    console.warn("[EXIF] Error:", err.message);
  }
  return out;
};

const readAsciiStr = (view, absOffset, maxLen) => {
  let s = "";
  for (let i = 0; i < maxLen; i++) {
    const ch = view.getUint8(absOffset + i);
    if (!ch) break;
    s += String.fromCharCode(ch);
  }
  return s.trim();
};

const parseApp1 = (view, start, out) => {
  try {
    const sig = String.fromCharCode(
      view.getUint8(start), view.getUint8(start+1),
      view.getUint8(start+2), view.getUint8(start+3)
    );
    if (sig !== "Exif") return;

    const tiff  = start + 6;
    const le    = view.getUint16(tiff) === 0x4949;
    const u16   = (o) => view.getUint16(tiff + o, le);
    const u32   = (o) => view.getUint32(tiff + o, le);
    const ratio = (o) => { const n = u32(o), d = u32(o+4); return d ? n/d : 0; };

    const ifd0  = u32(4);
    const n0    = u16(ifd0);
    let exifOff = null;
    let gpsOff  = null;

    // ── Escanear IFD0 ───────────────────────────────────────────────────
    for (let i = 0; i < n0; i++) {
      const e   = ifd0 + 2 + i * 12;
      const tag = u16(e);
      const cnt = u32(e + 4);
      const vo  = u32(e + 8);  // valor u offset según cnt

      switch (tag) {
        case 0x8769: exifOff = vo; break;  // ExifIFD pointer
        case 0x8825: gpsOff  = vo; break;  // GPSIFD pointer

        // ImageDescription — Timestamp Camera escribe la dirección aquí
        case 0x010E: {
          // Tipo ASCII: si cnt <= 4 el valor está inline en los bytes e+8..e+11
          const absOff = cnt <= 4 ? (tiff + e + 8 - start + start) : tiff + vo;
          // Más seguro: siempre usar tiff + vo cuando cnt > 4
          const addr = cnt > 4
            ? readAsciiStr(view, tiff + vo, cnt)
            : readAsciiStr(view, tiff + vo, cnt);
          if (addr && /\d/.test(addr)) {
            out.description = addr;
            console.log("[EXIF] ImageDescription:", addr);
          }
          break;
        }

        // DateTime IFD0 (fallback de fecha)
        case 0x0132: {
          if (!out.date) {
            const s = readAsciiStr(view, tiff + vo, 20);
            const d = exifStrToDate(s);
            if (d) out.date = d;
          }
          break;
        }
      }
    }

    // ── ExifIFD: DateTimeOriginal (0x9003) y UserComment (0x9286) ────────
    if (exifOff) {
      const ne = u16(exifOff);
      for (let i = 0; i < ne; i++) {
        const e   = exifOff + 2 + i * 12;
        const tag = u16(e);
        const cnt = u32(e + 4);
        const vo  = u32(e + 8);

        // DateTimeOriginal — máxima prioridad de fecha
        if ((tag === 0x9003 || tag === 0x9004) && !out.date) {
          const s = readAsciiStr(view, tiff + vo, 20);
          const d = exifStrToDate(s);
          if (d) {
            out.date = d;
            console.log("[EXIF] DateTimeOriginal:", s);
          }
        }

        // UserComment — Timestamp Camera a veces también pone la dirección aquí
        // Formato: "ASCII\0\0\0" + texto
        if (tag === 0x9286 && !out.description) {
          const headerLen = 8; // "ASCII\0\0\0" o "UNICODE\0"
          const textOff   = tiff + vo + headerLen;
          const s = readAsciiStr(view, textOff, cnt - headerLen);
          if (s && /\d/.test(s)) {
            out.description = s;
            console.log("[EXIF] UserComment:", s);
          }
        }
      }
    }

    // ── GPSIFD ───────────────────────────────────────────────────────────
    if (gpsOff && (out.lat === null)) {
      const ng = u16(gpsOff);
      const g  = {};
      for (let i = 0; i < ng; i++) {
        const e   = gpsOff + 2 + i * 12;
        const tag = u16(e);
        const vo  = u32(e + 8);

        if (tag === 1 || tag === 3) {
          g[tag] = String.fromCharCode(view.getUint8(tiff + vo));
        }
        if (tag === 2 || tag === 4) {
          g[tag] = ratio(vo) + ratio(vo+8)/60 + ratio(vo+16)/3600;
        }
      }
      if (g[2] != null && g[4] != null) {
        out.lat = parseFloat(((g[1] === "S" ? -1 : 1) * g[2]).toFixed(7));
        out.lon = parseFloat(((g[3] === "W" ? -1 : 1) * g[4]).toFixed(7));
        console.log("[EXIF] GPS:", out.lat, out.lon);
      }
    }

  } catch (err) {
    console.warn("[EXIF] parseApp1:", err.message);
  }
};

const exifStrToDate = (s) => {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (y < 2000 || y > 2100) return null;
  return new Date(y, mo-1, d, 12, 0, 0);
};

// ════════════════════════════════════════════
// REVERSE GEOCODING — Nominatim (fallback GPS)
// ════════════════════════════════════════════

export const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en-US,en", "User-Agent": "APMEW-PropertyApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const num  = addr.house_number || "";
    const road = addr.road || addr.pedestrian || "";
    if (!num || !road) return null;
    const cleanRoad = road
      .replace(/\b(Drive|Dr|Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Way|Wy|Court|Ct|Trail|Trl|Boulevard|Blvd|Place|Pl)\b\.?/gi, "")
      .replace(/\s+/g, " ").trim();
    return { houseNumber: num, road, clean: `${num} ${cleanRoad}`.trim(), full: `${num} ${road}`.trim() };
  } catch (err) {
    console.warn("[Geocode]", err.message);
    return null;
  }
};

// ════════════════════════════════════════════
// OCR — Último recurso
// ════════════════════════════════════════════

const preprocessForOCR = async (imageFile) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload  = () => {
        const cW = Math.min(img.width * 0.65, 500);
        const cH = Math.min(img.height * 0.22, 300);
        const cX = img.width - cW;
        const W  = cW * 2, H = cH * 2;

        const make = (fn) => {
          const c = document.createElement("canvas");
          c.width = W; c.height = H;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, cX, 0, cW, cH, 0, 0, W, H);
          const id = ctx.getImageData(0, 0, W, H);
          for (let i = 0; i < id.data.length; i += 4) {
            const g = id.data[i]*0.299 + id.data[i+1]*0.587 + id.data[i+2]*0.114;
            id.data[i] = id.data[i+1] = id.data[i+2] = fn(g);
          }
          ctx.putImageData(id, 0, 0);
          return c.toDataURL("image/png");
        };

        resolve([make(g => 255-g), make(g => g)]);
      };
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
};

export const extractTextFromImage = async (imageFile) => {
  try {
    const imgs  = await preprocessForOCR(imageFile);
    const opts  = { logger: () => {}, tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT };
    const texts = await Promise.all(imgs.map(img =>
      Tesseract.recognize(img, "eng", opts).then(r => r.data.text || "")
    ));
    const pat = /\b\d{4,6}\s+[A-Za-z]/;
    return texts.find(t => pat.test(t)) || texts.sort((a,b) => b.length-a.length)[0] || "";
  } catch { return ""; }
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
  for (const line of text.split("\n").map(l=>l.trim()).filter(l=>l.length>3).slice(0,8)) {
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
// MATCH dirección vs. lista de propiedades
// ════════════════════════════════════════════
const matchToProperty = (addressStr, properties) => {
  if (!addressStr) return null;
  const numMatch = addressStr.match(/^\d+/);
  if (!numMatch) return null;
  const houseNum = numMatch[0];

  const cands = properties.filter(p => (p.address.match(/^\d+/)||[])[0] === houseNum);
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];

  // Desempate por tokens de la calle
  const qTokens = addressStr.toLowerCase().replace(/^\d+\s*/,"").split(/\s+/);
  let best = cands[0], bestScore = 0;
  for (const p of cands) {
    const pTokens = p.address.toLowerCase().replace(/^\d+\s*/,"").split(/\s+/);
    const score   = qTokens.filter(t => pTokens.some(pt => pt.startsWith(t)||t.startsWith(pt))).length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
};

// ════════════════════════════════════════════
// PUNTO DE ENTRADA PRINCIPAL
// ════════════════════════════════════════════
export const extractPhotoMetadata = async (imageFile, properties) => {
  console.log("[Meta] ═══", imageFile.name);

  // ── 1. EXIF: description + fecha + GPS (todo de una pasada, ~5ms) ────────
  const exif = await extractExifData(imageFile);
  console.log("[Meta] EXIF →", { desc: exif.description, date: exif.date?.toDateString(), gps: exif.lat });

  let date          = exif.date;
  let address       = null;
  let matchedProp   = null;
  let dateSource    = exif.date        ? "exif" : null;
  let addrSource    = null;

  // ── 2. Dirección desde ImageDescription / UserComment ────────────────────
  if (exif.description) {
    address       = exif.description;
    addrSource    = "exif";
    matchedProp   = matchToProperty(exif.description, properties);
    console.log("[Meta] EXIF description match:", matchedProp?.address || "sin match en lista");
  }

  // ── 3. GPS → Nominatim (si no hubo match por description) ────────────────
  if (!matchedProp && exif.lat !== null && exif.lon !== null) {
    console.log("[Meta] Intentando GPS...");
    const geo = await reverseGeocode(exif.lat, exif.lon);
    if (geo) {
      const m = matchToProperty(geo.clean, properties) || matchToProperty(geo.full, properties);
      if (m) {
        address     = geo.clean;
        addrSource  = "gps";
        matchedProp = m;
        console.log("[Meta] GPS match:", m.address);
      }
    }
  }

  // ── 4. OCR (solo si los dos métodos anteriores fallaron) ─────────────────
  if (!matchedProp) {
    console.log("[Meta] Fallback a OCR...");
    const raw     = await extractTextFromImage(imageFile);
    const ocrAddr = parsePhotoAddress(raw);
    const ocrDate = parsePhotoDate(raw);

    if (!date && ocrDate)  { date = ocrDate; dateSource = "ocr"; }
    if (ocrAddr) {
      address    = ocrAddr;
      addrSource = "ocr";
      matchedProp = matchToProperty(ocrAddr, properties);
      console.log("[Meta] OCR match:", matchedProp?.address || "ninguno");
    }
  }

  console.log("[Meta] Final →", {
    fecha: date?.toDateString(), fuenteFecha: dateSource,
    dir: address, fuenteDir: addrSource,
    match: matchedProp?.address || "—",
  });

  return {
    date,
    dateSource,
    address,
    addressSource: addrSource,
    matchedProperty: matchedProp,
    fileName: imageFile.name,
  };
};
