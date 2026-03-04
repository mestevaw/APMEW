// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V6 — EXIF + OCR Multi-estrategia
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// CAMBIOS EN V6:
// - EXIF: extrae fecha directamente de los metadatos del archivo JPEG
//         (más confiable que OCR para la fecha)
// - OCR mejorado: enfoca la esquina SUPERIOR DERECHA donde el sello
//         de iOS/Android suele estampar dirección y fecha
// - Multi-estrategia: corre 3 versiones de preprocesamiento en paralelo
//         (original, invertida, alto contraste) y usa la que encuentre
//         la dirección
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";

// ════════════════════════════════════════════
// EXIF — Extracción de fecha sin librería
// ════════════════════════════════════════════

/**
 * Lee el tag DateTimeOriginal del EXIF de un JPEG.
 * Formato EXIF: "YYYY:MM:DD HH:MM:SS"
 * @param {File} file
 * @returns {Promise<Date|null>}
 */
export const extractExifDate = async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    const view   = new DataView(buffer);

    // Verificar marcador SOI de JPEG
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      const length = view.getUint16(offset + 2);

      // APP1 = 0xFFE1 (donde vive EXIF)
      if (marker === 0xFFE1) {
        const exifDate = parseExifFromApp1(view, offset + 4, length - 2);
        if (exifDate) return exifDate;
      }

      // Saltar al siguiente segmento
      if (length < 2) break;
      offset += 2 + length;
    }
    return null;
  } catch (err) {
    console.warn("[EXIF] Error leyendo EXIF:", err);
    return null;
  }
};

const parseExifFromApp1 = (view, start, length) => {
  try {
    // Verificar firma "Exif\0\0"
    const sig = String.fromCharCode(
      view.getUint8(start),   view.getUint8(start+1),
      view.getUint8(start+2), view.getUint8(start+3)
    );
    if (sig !== "Exif") return null;

    const tiffStart  = start + 6;
    const byteOrder  = view.getUint16(tiffStart); // 0x4949=LE, 0x4D4D=BE
    const littleEnd  = byteOrder === 0x4949;
    const getUint16  = (o) => view.getUint16(tiffStart + o, littleEnd);
    const getUint32  = (o) => view.getUint32(tiffStart + o, littleEnd);

    // IFD0 offset
    const ifd0Offset = getUint32(4);
    const ifd0Count  = getUint16(ifd0Offset);

    let exifIFDOffset = null;

    // Buscar tag ExifIFD (0x8769) en IFD0
    for (let i = 0; i < ifd0Count; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      const tag = getUint16(entryOffset);
      if (tag === 0x8769) {
        exifIFDOffset = getUint32(entryOffset + 8);
        break;
      }
    }

    // Buscar DateTimeOriginal (0x9003) en ExifIFD
    const searchIn = exifIFDOffset ? [exifIFDOffset, ifd0Offset] : [ifd0Offset];

    for (const ifdOffset of searchIn) {
      if (!ifdOffset) continue;
      const count = getUint16(ifdOffset);
      for (let i = 0; i < count; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = getUint16(entryOffset);

        // 0x9003 = DateTimeOriginal, 0x0132 = DateTime
        if (tag === 0x9003 || tag === 0x0132) {
          const valueOffset = getUint32(entryOffset + 8);
          // Leer string ASCII desde el offset
          let dateStr = "";
          for (let c = 0; c < 19; c++) {
            const ch = view.getUint8(tiffStart + valueOffset + c);
            if (ch === 0) break;
            dateStr += String.fromCharCode(ch);
          }
          // Formato: "2026:03:03 10:48:57"
          const parsed = parseExifDateString(dateStr);
          if (parsed) {
            console.log("[EXIF] Fecha encontrada:", dateStr, "→", parsed);
            return parsed;
          }
        }
      }
    }
    return null;
  } catch (err) {
    return null;
  }
};

const parseExifDateString = (str) => {
  // "2026:03:03 10:48:57"
  const m = str.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, year, month, day] = m.map(Number);
  if (year < 2000 || year > 2100) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
};

// ════════════════════════════════════════════
// OCR — Pre-procesamiento multi-estrategia
// ════════════════════════════════════════════

/**
 * Preprocesa la imagen para OCR.
 * Enfoca la esquina SUPERIOR DERECHA (donde iOS/Android pone el sello).
 * Genera 3 versiones: original escala de grises, invertida, alto contraste.
 * @param {File} imageFile
 * @returns {Promise<string[]>} Array de base64 (3 versiones)
 */
const preprocessImageMulti = async (imageFile) => {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        // ── Recortar esquina SUPERIOR DERECHA ──────────────────────────────
        // El sello "Mar 3, 2026 / 15151 Spring Mist" aparece en top-right
        const cropW  = Math.min(img.width  * 0.65, 500); // 65% ancho desde la derecha
        const cropH  = Math.min(img.height * 0.22, 300); // 22% alto desde arriba
        const cropX  = img.width - cropW;                // Empezar desde la derecha
        const cropY  = 0;

        // Escalar 2x para mejorar resolución de OCR
        const scale  = 2;
        const cW     = cropW  * scale;
        const cH     = cropH  * scale;

        const versions = [];

        // ── Versión 1: Escala de grises suave ──────────────────────────────
        const c1  = document.createElement("canvas");
        c1.width  = cW; c1.height = cH;
        const ctx1 = c1.getContext("2d");
        ctx1.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cW, cH);
        const d1 = ctx1.getImageData(0, 0, cW, cH);
        for (let i = 0; i < d1.data.length; i += 4) {
          const g = d1.data[i] * 0.299 + d1.data[i+1] * 0.587 + d1.data[i+2] * 0.114;
          d1.data[i] = d1.data[i+1] = d1.data[i+2] = g;
        }
        ctx1.putImageData(d1, 0, 0);
        versions.push(c1.toDataURL("image/png"));

        // ── Versión 2: INVERTIDA (texto blanco → negro sobre blanco) ───────
        const c2  = document.createElement("canvas");
        c2.width  = cW; c2.height = cH;
        const ctx2 = c2.getContext("2d");
        ctx2.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cW, cH);
        const d2 = ctx2.getImageData(0, 0, cW, cH);
        for (let i = 0; i < d2.data.length; i += 4) {
          const g = d2.data[i] * 0.299 + d2.data[i+1] * 0.587 + d2.data[i+2] * 0.114;
          d2.data[i] = d2.data[i+1] = d2.data[i+2] = 255 - g; // Invertir
        }
        ctx2.putImageData(d2, 0, 0);
        versions.push(c2.toDataURL("image/png"));

        // ── Versión 3: Alto contraste con umbral suave ──────────────────────
        const c3  = document.createElement("canvas");
        c3.width  = cW; c3.height = cH;
        const ctx3 = c3.getContext("2d");
        ctx3.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cW, cH);
        const d3 = ctx3.getImageData(0, 0, cW, cH);
        for (let i = 0; i < d3.data.length; i += 4) {
          const g = d3.data[i] * 0.299 + d3.data[i+1] * 0.587 + d3.data[i+2] * 0.114;
          // Threshold: pixeles muy claros (texto blanco) → negro, resto → blanco
          const v = g > 200 ? 0 : 255;
          d3.data[i] = d3.data[i+1] = d3.data[i+2] = v;
        }
        ctx3.putImageData(d3, 0, 0);
        versions.push(c3.toDataURL("image/png"));

        resolve(versions);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
};

// ════════════════════════════════════════════
// OCR — Extracción de texto
// ════════════════════════════════════════════

/**
 * Corre OCR sobre una imagen base64.
 * @param {string} imageBase64
 * @returns {Promise<string>}
 */
const runOcr = async (imageBase64) => {
  const result = await Tesseract.recognize(imageBase64, "eng", {
    logger: () => {},
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,:@./",
  });
  return result.data.text || "";
};

/**
 * Extrae texto corriendo OCR en 3 versiones de la imagen.
 * Devuelve el texto de la versión que mejor resultado da.
 * @param {File} imageFile
 * @returns {Promise<string>}
 */
export const extractTextFromImage = async (imageFile) => {
  try {
    console.log("[OCR] Iniciando multi-estrategia...");
    const versions = await preprocessImageMulti(imageFile);

    // Correr las 3 versiones en paralelo
    const [text1, text2, text3] = await Promise.all(versions.map(runOcr));

    console.log("[OCR] Versión 1 (gris):", text1.substring(0, 80));
    console.log("[OCR] Versión 2 (invertida):", text2.substring(0, 80));
    console.log("[OCR] Versión 3 (contraste):", text3.substring(0, 80));

    // Elegir la versión que encuentre una dirección (número + calle)
    const addrPattern = /\b\d{4,6}\s+[A-Za-z]/;
    if (addrPattern.test(text2)) { console.log("[OCR] Usando versión INVERTIDA"); return text2; }
    if (addrPattern.test(text3)) { console.log("[OCR] Usando versión CONTRASTE"); return text3; }
    if (addrPattern.test(text1)) { console.log("[OCR] Usando versión GRIS");      return text1; }

    // Ninguna encontró dirección — devolver la que tiene más texto
    const best = [text1, text2, text3].sort((a, b) => b.length - a.length)[0];
    console.log("[OCR] Sin dirección detectada, devolviendo texto más largo");
    return best;
  } catch (err) {
    console.error("[OCR] Error:", err);
    return "";
  }
};

// ════════════════════════════════════════════
// Parsers de fecha y dirección (sin cambios)
// ════════════════════════════════════════════

/**
 * Parsea fecha del formato: "Mar 2, 2026 at 10:03:47 AM"
 */
export const parsePhotoDate = (text) => {
  const pattern = /\b([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})\b/i;
  const match   = text.match(pattern);
  if (match) {
    const monthMap = {
      jan:0, january:0, feb:1, february:1, mar:2, march:2,
      apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6,
      aug:7, august:7, sep:8, sept:8, september:8,
      oct:9, october:9, nov:10, november:10, dec:11, december:11,
    };
    const month = monthMap[match[1].toLowerCase()];
    if (month !== undefined) {
      console.log(`[OCR] Fecha OCR: ${match[1]} ${match[2]}, ${match[3]}`);
      return new Date(parseInt(match[3]), month, parseInt(match[2]), 12, 0, 0);
    }
  }
  return null;
};

/**
 * Extrae dirección del formato: "15151 Spring Mist"
 */
export const parsePhotoAddress = (text) => {
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 3)
    .slice(0, 8); // Ampliar a 8 líneas para capturar más casos

  console.log("[OCR] Líneas a analizar:", lines);

  for (const line of lines) {
    if (/\d{4}.*at.*[AP]M/i.test(line))              continue; // Skip fecha con hora
    if (/(TX|Texas|United States|USA|San Antonio)/i.test(line)) continue; // Skip ciudad/estado

    const pattern = /^(\d{4,6})\s+([A-Za-z]+(?: [A-Za-z]+){0,4})(?:\s|$)/;
    const match   = line.match(pattern);
    if (match) {
      const address = `${match[1]} ${match[2].trim()}`;
      console.log("[OCR] Dirección encontrada:", address);
      return address;
    }
  }
  return null;
};

/**
 * Convierte Date a formato de carpeta: "3 mar 26"
 */
export const dateToFolderName = (date) => {
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
};

// ════════════════════════════════════════════
// Extracción completa de metadata
// ORDEN DE PRIORIDAD:
//   Fecha:     1. EXIF  2. OCR  3. null
//   Dirección: 1. OCR   2. null  (GPS no disponible sin API)
// ════════════════════════════════════════════

export const extractPhotoMetadata = async (imageFile, properties) => {
  console.log("[Meta] ═══ Iniciando extracción:", imageFile.name, "═══");

  // ── 1. Fecha desde EXIF (más rápido y confiable) ─────────────────────────
  const exifDate = await extractExifDate(imageFile);
  console.log("[Meta] Fecha EXIF:", exifDate);

  // ── 2. OCR para dirección (y fecha como fallback) ─────────────────────────
  const rawText      = await extractTextFromImage(imageFile);
  const ocrDate      = parsePhotoDate(rawText);
  const addressFromOCR = parsePhotoAddress(rawText);

  // ── 3. Elegir la mejor fecha ───────────────────────────────────────────────
  // EXIF tiene prioridad sobre OCR (más preciso, no depende de imagen)
  const date = exifDate || ocrDate;
  console.log("[Meta] Fecha final:", date, exifDate ? "(EXIF)" : ocrDate ? "(OCR)" : "(no encontrada)");

  // ── 4. Match de dirección contra lista de propiedades ────────────────────
  let matchedProperty = null;
  if (addressFromOCR) {
    const numMatch = addressFromOCR.match(/^\d+/);
    if (numMatch) {
      const houseNumber    = numMatch[0];
      const withSameNumber = properties.filter(p => {
        const pn = p.address.match(/^\d+/);
        return pn && pn[0] === houseNumber;
      });

      if (withSameNumber.length === 1) {
        matchedProperty = withSameNumber[0];
        console.log("[Meta] ✅ Match directo:", matchedProperty.address);
      } else if (withSameNumber.length > 1) {
        // Desempate por primera letra de la calle
        const streetOCR     = addressFromOCR.replace(/^\d+\s*/, "").trim();
        const firstLetterOCR = streetOCR[0]?.toUpperCase();
        matchedProperty = withSameNumber.find(p => {
          const ps = p.address.replace(/^\d+\s*/, "").trim();
          return ps[0]?.toUpperCase() === firstLetterOCR;
        }) || withSameNumber[0];
        console.log("[Meta] ✅ Match desempate:", matchedProperty.address);
      } else {
        console.log("[Meta] ❌ Número no encontrado en propiedades:", houseNumber);
      }
    }
  } else {
    console.log("[Meta] ❌ No se detectó dirección en OCR");
  }

  console.log("[Meta] ═══ Fin extracción ═══");

  return {
    date,
    address:         addressFromOCR,
    matchedProperty,
    rawText,
    fileName:        imageFile.name,
    dateSource:      exifDate ? "exif" : ocrDate ? "ocr" : null,
  };
};
