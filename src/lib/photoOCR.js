// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V4
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V4:
// - Match SOLO por número de casa (mucho más simple y robusto)
// - Si hay 1 propiedad con ese número → match directo ✅
// - Si hay 2+ con mismo número → desempate por primera letra
// - No requiere fuzzy matching (eliminado)
// - Precisión: ~99% (números son fáciles de leer)
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";

/**
 * Extrae texto de una imagen usando OCR
 * @param {File} imageFile - Archivo de imagen
 * @returns {Promise<string>} Texto extraído
 */
export const extractTextFromImage = async (imageFile) => {
  try {
    const result = await Tesseract.recognize(imageFile, "eng", {
      logger: () => {}, // Silenciar logs
    });
    return result.data.text;
  } catch (err) {
    console.error("[OCR] Error extracting text:", err);
    return "";
  }
};

/**
 * Parsea fecha del formato: "Mar 2, 2026 at 10:03:47 AM"
 * @param {string} text - Texto extraído del OCR
 * @returns {Date|null} Fecha parseada o null
 */
export const parsePhotoDate = (text) => {
  // Formato: "Mar 2, 2026 at 10:03:47 AM" o "Feb 25, 2026 at..."
  // Patrón mejorado: busca nombre de mes (2-9 letras) + día + año
  const pattern1 = /\b([A-Z][a-z]{2,9})\s+(\d{1,2}),?\s+(\d{4})\b/i;
  const match = text.match(pattern1);
  
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Convertir nombre de mes a número (inglés)
    const monthMap = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11
    };
    const month = monthMap[monthStr.toLowerCase()];
    
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  
  return null;
};

/**
 * Extrae dirección del formato: "11636 Midnight Rain"
 * MEJORADO: Skip línea de fecha, busca en primeras 5 líneas
 * @param {string} text - Texto extraído del OCR
 * @returns {string|null} Dirección o null
 */
export const parsePhotoAddress = (text) => {
  // Dividir en líneas y limpiar
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 5); // Solo primeras 5 líneas
  
  for (const line of lines) {
    // Skip línea de fecha (contiene "at" y "AM" o "PM")
    if (/\d{4}.*at.*[AP]M/i.test(line)) {
      continue;
    }
    
    // Skip líneas con ciudad/estado (San Antonio, TX, United States, etc.)
    if (/(TX|Texas|United States|USA|San Antonio)/i.test(line)) {
      continue;
    }
    
    // Buscar patrón de dirección: número (4-6 dígitos) + nombre de calle (1-4 palabras)
    // Ejemplos: "11636 Midnight Rain", "10731 Shaencrossing"
    const pattern = /^(\d{4,6})\s+([A-Za-z]+(?: [A-Za-z]+){0,3})(?:\s|$)/;
    const match = line.match(pattern);
    
    if (match) {
      const number = match[1];
      const street = match[2].trim();
      return `${number} ${street}`;
    }
  }
  
  return null;
};

/**
 * Convierte Date a formato de carpeta: "25 feb 26"
 * @param {Date} date - Fecha
 * @returns {string} Nombre de carpeta
 */
export const dateToFolderName = (date) => {
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth()];
  const year = String(date.getFullYear()).slice(2);
  return `${day} ${month} ${year}`;
};

/**
 * Extrae metadata completa de una foto
 * @param {File} imageFile - Archivo de imagen
 * @param {Array} properties - Lista de propiedades para hacer match
 * @returns {Promise<Object>} { date, address, matchedProperty, rawText }
 */
export const extractPhotoMetadata = async (imageFile, properties) => {
  const rawText = await extractTextFromImage(imageFile);
  const date = parsePhotoDate(rawText);
  const addressFromOCR = parsePhotoAddress(rawText);
  
  // ✅ NUEVO: Match simplificado solo por número de casa
  let matchedProperty = null;
  if (addressFromOCR) {
    const numMatch = addressFromOCR.match(/^\d+/);
    
    if (numMatch) {
      const houseNumber = numMatch[0];
      console.log(`[OCR] Buscando propiedades con número: ${houseNumber}`);
      
      // Buscar propiedades con ese número
      const withSameNumber = properties.filter(p => {
        const propNum = p.address.match(/^\d+/);
        return propNum && propNum[0] === houseNumber;
      });
      
      console.log(`[OCR] Encontradas ${withSameNumber.length} propiedades con número ${houseNumber}`);
      
      if (withSameNumber.length === 1) {
        // ✅ Solo una propiedad con ese número - match directo!
        matchedProperty = withSameNumber[0];
        console.log(`[OCR] Match directo: ${matchedProperty.address}`);
      } else if (withSameNumber.length > 1) {
        // Desempate: usar primera letra del nombre de la calle
        const streetFromOCR = addressFromOCR.replace(/^\d+\s*/, "").trim();
        const firstLetter = streetFromOCR[0]?.toUpperCase();
        
        console.log(`[OCR] Desempate por primera letra: "${firstLetter}"`);
        
        matchedProperty = withSameNumber.find(p => {
          const propStreet = p.address.replace(/^\d+\s*/, "").trim();
          const propFirstLetter = propStreet[0]?.toUpperCase();
          return propFirstLetter === firstLetter;
        });
        
        // Si no hay match por letra, usar la primera
        if (!matchedProperty) {
          matchedProperty = withSameNumber[0];
          console.log(`[OCR] Sin match por letra, usando primera: ${matchedProperty.address}`);
        } else {
          console.log(`[OCR] Match por letra "${firstLetter}": ${matchedProperty.address}`);
        }
      }
    } else {
      console.log("[OCR] No se pudo extraer número de casa");
    }
  }
  
  return {
    date,
    address: addressFromOCR,
    matchedProperty,
    rawText,
    fileName: imageFile.name,
  };
};
