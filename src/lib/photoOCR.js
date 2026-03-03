// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V3
// Fecha: 2026-03-02
// ═══════════════════════════════════════════
// CAMBIOS EN V3:
// - Agregado fuzzy matching para compensar errores OCR
// - Usa librería 'fastest-levenshtein' para similitud
// - Tolerancia de 5 caracteres de diferencia
// - "Midnight Naines" → Match con "Midnight Rain" ✅
// REQUIERE: npm install fastest-levenshtein
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";
import { distance } from "fastest-levenshtein";

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
  
  // Intentar hacer match con propiedades (exacto)
  let matchedProperty = null;
  if (addressFromOCR) {
    const numMatch = addressFromOCR.match(/^\d+/);
    const streetFromOCR = addressFromOCR.replace(/^\d+\s*/, "").trim().toUpperCase();
    
    matchedProperty = properties.find(p => {
      const propNum = p.address.match(/^\d+/);
      const propStreet = p.address.replace(/^\d+\s*/, "").trim().toUpperCase();
      
      // Match si el número coincide
      if (propNum && propNum[0] === (numMatch ? numMatch[0] : "")) {
        // Comparar palabras de la calle
        const streetWordsOCR = streetFromOCR.split(/\s+/);
        const propWords = propStreet.split(/[\s,]/);
        
        // Si alguna palabra coincide, es un match
        // Ejemplo: "MIDNIGHT" match con "MIDNIGHT RAIN"
        for (const wordOCR of streetWordsOCR) {
          for (const wordProp of propWords) {
            if (wordOCR.length >= 3 && wordProp.includes(wordOCR)) {
              return true;
            }
            if (wordProp.length >= 3 && wordOCR.includes(wordProp)) {
              return true;
            }
          }
        }
      }
      return false;
    });
    
    // ✅ NUEVO: Si no hay match exacto, usar fuzzy matching
    if (!matchedProperty) {
      console.log("[OCR] No match exacto, usando fuzzy matching...");
      
      const numMatch = addressFromOCR.match(/^\d+/);
      if (numMatch) {
        // Filtrar propiedades con mismo número
        const samNum = properties.filter(p => {
          const propNum = p.address.match(/^\d+/);
          return propNum && propNum[0] === numMatch[0];
        });
        
        // Calcular similitud con cada una
        let bestMatch = null;
        let bestSimilarity = Infinity;
        
        samNum.forEach(prop => {
          const similarity = distance(
            addressFromOCR.toUpperCase(),
            prop.address.toUpperCase()
          );
          
          if (similarity < bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = prop;
          }
        });
        
        // Tolerancia: máximo 5 caracteres de diferencia
        if (bestMatch && bestSimilarity <= 5) {
          console.log(`[OCR] Fuzzy match: "${addressFromOCR}" → "${bestMatch.address}" (diff: ${bestSimilarity})`);
          matchedProperty = bestMatch;
        }
      }
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
