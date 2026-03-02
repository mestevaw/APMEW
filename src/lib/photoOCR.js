// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: 1
// Fecha: 2026-03-02
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
 * Parsea fecha del formato: "Feb 25, 2026 at 10:03:47 AM"
 * @param {string} text - Texto extraído del OCR
 * @returns {Date|null} Fecha parseada o null
 */
export const parsePhotoDate = (text) => {
  // Formato 1: "Feb 25, 2026 at 10:03:47 AM"
  const pattern1 = /([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})/i;
  const match = text.match(pattern1);
  
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Convertir nombre de mes a número
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthMap[monthStr.toLowerCase()];
    
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  
  return null;
};

/**
 * Extrae dirección del formato: "10731 Shaencrossing" o "11636 Midnight Rain"
 * @param {string} text - Texto extraído del OCR
 * @returns {string|null} Dirección o null
 */
export const parsePhotoAddress = (text) => {
  // Buscar patrón: número (4-6 dígitos) seguido de nombre de calle (1-3 palabras)
  // Formato 1: "10731 Shaencrossing"
  // Formato 2: "11636 Midnight Rain"
  const pattern = /(\d{4,6})\s+([A-Za-z]+(?: [A-Za-z]+){0,2})/;
  const match = text.match(pattern);
  
  if (match) {
    return `${match[1]} ${match[2].trim()}`;
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
  
  // Intentar hacer match con propiedades
  let matchedProperty = null;
  if (addressFromOCR) {
    const numMatch = addressFromOCR.match(/^\d+/);
    const streetFromOCR = addressFromOCR.replace(/^\d+\s*/, "").trim().toUpperCase();
    
    matchedProperty = properties.find(p => {
      const propNum = p.address.match(/^\d+/);
      const propStreet = p.address.replace(/^\d+\s*/, "").trim().toUpperCase();
      
      // Match si el número coincide Y (la calle de OCR está en la propiedad O viceversa)
      if (propNum && propNum[0] === (numMatch ? numMatch[0] : "")) {
        // Comparar ambas direcciones para ver si hay match parcial
        const streetWords = streetFromOCR.split(/\s+/);
        const propWords = propStreet.split(/[\s,]/);
        
        // Si la primera palabra de la calle coincide, es un match
        return streetWords[0] === propWords[0];
      }
      return false;
    });
  }
  
  return {
    date,
    address: addressFromOCR,
    matchedProperty,
    rawText,
    fileName: imageFile.name,
  };
};
