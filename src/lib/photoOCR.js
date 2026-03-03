// ═══════════════════════════════════════════
// Archivo: src/lib/photoOCR.js
// Versión: V5
// Fecha: 2026-03-03
// ═══════════════════════════════════════════
// CAMBIOS EN V5:
// - Pre-procesamiento de imagen antes de OCR
// - Conversión a escala de grises
// - Aumento de contraste
// - Binarización (threshold)
// - Enfoque en área superior (donde está el sello)
// - Configuración optimizada de Tesseract
// ═══════════════════════════════════════════

import Tesseract from "tesseract.js";
import { MONTHS_ES } from "./helpers";

/**
 * Pre-procesa la imagen para mejorar OCR
 * @param {File} imageFile - Archivo de imagen
 * @returns {Promise<string>} Base64 de imagen procesada
 */
const preprocessImage = async (imageFile) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.onload = () => {
        // Crear canvas para procesar
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Usar solo el área superior (donde está el sello)
        const cropHeight = Math.min(img.height * 0.3, 400); // Top 30% o 400px
        canvas.width = img.width;
        canvas.height = cropHeight;
        
        // Dibujar imagen
        ctx.drawImage(img, 0, 0, img.width, cropHeight, 0, 0, img.width, cropHeight);
        
        // Obtener datos de píxeles
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Convertir a escala de grises y aumentar contraste
        for (let i = 0; i < data.length; i += 4) {
          // Escala de grises
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // Aumentar contraste (threshold adaptativo)
          const enhanced = gray > 180 ? 255 : gray < 80 ? 0 : gray;
          
          data[i] = enhanced;     // R
          data[i + 1] = enhanced; // G
          data[i + 2] = enhanced; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Convertir a base64
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
};

/**
 * Extrae texto de una imagen usando OCR con pre-procesamiento
 * @param {File} imageFile - Archivo de imagen
 * @returns {Promise<string>} Texto extraído
 */
export const extractTextFromImage = async (imageFile) => {
  try {
    console.log("[OCR] Iniciando pre-procesamiento...");
    
    // Pre-procesar imagen
    const processedImage = await preprocessImage(imageFile);
    
    console.log("[OCR] Imagen pre-procesada, ejecutando OCR...");
    
    // Ejecutar OCR con configuración optimizada
    const result = await Tesseract.recognize(processedImage, "eng", {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progreso: ${Math.round(m.progress * 100)}%`);
        }
      },
      // Configuración optimizada para texto con sombra
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,:@.',
    });
    
    console.log("[OCR] Texto extraído:", result.data.text.substring(0, 100));
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
      console.log(`[OCR] Fecha parseada: ${monthStr} ${day}, ${year}`);
      return new Date(year, month, day);
    }
  }
  
  console.log("[OCR] No se pudo parsear fecha");
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
  
  console.log("[OCR] Líneas a analizar:", lines);
  
  for (const line of lines) {
    // Skip línea de fecha (contiene "at" y "AM" o "PM")
    if (/\d{4}.*at.*[AP]M/i.test(line)) {
      console.log("[OCR] Skip línea de fecha:", line);
      continue;
    }
    
    // Skip líneas con ciudad/estado (San Antonio, TX, United States, etc.)
    if (/(TX|Texas|United States|USA|San Antonio)/i.test(line)) {
      console.log("[OCR] Skip línea de ciudad:", line);
      continue;
    }
    
    // Buscar patrón de dirección: número (4-6 dígitos) + nombre de calle (1-4 palabras)
    // Ejemplos: "11636 Midnight Rain", "10731 Shaencrossing"
    const pattern = /^(\d{4,6})\s+([A-Za-z]+(?: [A-Za-z]+){0,3})(?:\s|$)/;
    const match = line.match(pattern);
    
    if (match) {
      const number = match[1];
      const street = match[2].trim();
      const address = `${number} ${street}`;
      console.log("[OCR] Dirección encontrada:", address);
      return address;
    }
  }
  
  console.log("[OCR] No se encontró dirección");
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
  console.log("[OCR] ═══ Iniciando extracción de metadata ═══");
  
  const rawText = await extractTextFromImage(imageFile);
  console.log("[OCR] Raw text:", rawText);
  
  const date = parsePhotoDate(rawText);
  const addressFromOCR = parsePhotoAddress(rawText);
  
  // ✅ Match simplificado solo por número de casa
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
        console.log(`[OCR] ✅ Match directo: ${matchedProperty.address}`);
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
          console.log(`[OCR] ✅ Match por letra "${firstLetter}": ${matchedProperty.address}`);
        }
      } else {
        console.log(`[OCR] ❌ No hay propiedades con número ${houseNumber}`);
      }
    } else {
      console.log("[OCR] ❌ No se pudo extraer número de casa");
    }
  } else {
    console.log("[OCR] ❌ No se detectó dirección");
  }
  
  console.log("[OCR] ═══ Fin extracción metadata ═══");
  
  return {
    date,
    address: addressFromOCR,
    matchedProperty,
    rawText,
    fileName: imageFile.name,
  };
};
