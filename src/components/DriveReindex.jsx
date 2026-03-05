// ═══════════════════════════════════════════
// Archivo: src/components/DriveReindex.jsx
// Versión: V1
// Fecha: 2026-03-04
// ═══════════════════════════════════════════
// Herramienta de uso único (o cuando se agreguen propiedades nuevas).
// Recorre Drive: PROPERTY MANAGEMENT → owner folders → property folders
// y hace UPSERT en la tabla drive_folders de Supabase.
// Solo indexa carpetas de propiedad (no subcarpetas internas).
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { supaUpsert, supaFetch } from "../lib/supabase";
import { DRIVE_ROOT_FOLDER } from "../lib/config";

// Nombres de carpetas de owner en Drive (tal como aparecen en Drive)
// findSubfolder usa .includes() así que son tolerantes a sufijos
const OWNER_FOLDERS = [
  "MANGO NEST",
  "MNA WORKS",
  "TORTUGA HOME",
  "MAUD WATSON",
  "PM PORTFOLIO",   // por si Maud Watson cae bajo PM Portfolio Maud
];

export const DriveReindex = ({ drive, onClose }) => {
  const [running, setRunning]   = useState(false);
  const [done, setDone]         = useState(false);
  const [log, setLog]           = useState([]);
  const [summary, setSummary]   = useState(null);
  const logRef = useRef(null);

  const addLog = (msg, color) => {
    setLog(prev => [...prev, { msg, color }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  const run = async () => {
    setRunning(true);
    setLog([]);
    setSummary(null);

    let indexed = 0, skipped = 0, errors = 0;

    try {
      // ── 1. Encontrar PROPERTY MANAGEMENT ─────────────────────────────
      addLog("🔍 Buscando carpeta PROPERTY MANAGEMENT...");
      const pmContents = await drive.listAllFiles(DRIVE_ROOT_FOLDER);
      const pmFolder   = (pmContents?.files || pmContents || [])
        .find(f => f.mimeType === "application/vnd.google-apps.folder"
               && f.name.toUpperCase().includes("PROPERTY MANAGEMENT"));

      if (!pmFolder) {
        addLog("❌ No se encontró PROPERTY MANAGEMENT en la raíz de Drive", C.red);
        setRunning(false); return;
      }
      addLog(`✅ PROPERTY MANAGEMENT: ${pmFolder.id}`, C.green);

      // ── 2. Listar carpetas de owner dentro de PM ──────────────────────
      const pmChildren = await drive.listAllFiles(pmFolder.id);
      const ownerFolders = (pmChildren?.files || pmChildren || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder");

      addLog(`📂 ${ownerFolders.length} carpetas de owner encontradas`);

      // ── 3. Por cada owner, listar sus propiedades ─────────────────────
      for (const ownerFolder of ownerFolders) {
        addLog(`\n👤 ${ownerFolder.name}`);

        const ownerPath = `PROPERTY MANAGEMENT/${ownerFolder.name}`;

        // Upsert del owner folder
        try {
          await supaUpsert("drive_folders", {
            name:            ownerFolder.name,
            google_drive_id: ownerFolder.id,
            parent_drive_id: pmFolder.id,
            folder_path:     ownerPath,
          });
        } catch (e) {
          addLog(`  ⚠️ Error guardando owner: ${e.message}`, C.orange);
        }

        // Listar propiedades dentro del owner
        const ownerChildren = await drive.listAllFiles(ownerFolder.id);
        const propFolders   = (ownerChildren?.files || ownerChildren || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder"
                    && /^\d/.test(f.name)); // Solo carpetas que empiezan con número (propiedades)

        addLog(`  📋 ${propFolders.length} propiedades`);

        for (const propFolder of propFolders) {
          const propPath = `${ownerPath}/${propFolder.name}`;

          // Verificar si ya existe en Supabase
          try {
            const existing = await supaFetch("drive_folders", {
              filters: `google_drive_id=eq.${propFolder.id}`,
              limit: 1,
            });

            if (existing?.length > 0) {
              addLog(`  ⏭️ ${propFolder.name}`, C.textDim);
              skipped++;
            } else {
              await supaUpsert("drive_folders", {
                name:            propFolder.name,
                google_drive_id: propFolder.id,
                parent_drive_id: ownerFolder.id,
                folder_path:     propPath,
              });
              addLog(`  ✅ ${propFolder.name}`, C.green);
              indexed++;
            }
          } catch (e) {
            addLog(`  ❌ ${propFolder.name}: ${e.message}`, C.red);
            errors++;
          }
        }

        // Pequeña pausa para no saturar las APIs
        await new Promise(r => setTimeout(r, 300));
      }

      addLog(`\n🎉 Reindexación completa`, C.green);
      setSummary({ indexed, skipped, errors });

    } catch (err) {
      addLog(`\n❌ Error general: ${err.message}`, C.red);
    }

    setRunning(false);
    setDone(true);
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 24,
    }}>
      <Card style={{ maxWidth: 560, width: "100%", padding: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            🗂️ Reindexar Drive → Supabase
          </h2>
          {!running && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
          )}
        </div>

        {/* Descripción */}
        {!running && !done && (
          <div style={{
            padding: "12px 14px", marginBottom: 18,
            background: `${C.accent}12`, border: `1px solid ${C.accent}40`,
            borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.text, lineHeight: 1.6,
          }}>
            <p style={{ margin: "0 0 8px" }}>
              Recorre toda la estructura de Drive y registra en Supabase la carpeta de cada propiedad.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>
              • Solo indexa carpetas de propiedad (las que empiezan con número)<br/>
              • Las que ya existen se saltan (sin duplicados)<br/>
              • Tarda ~1-2 min dependiendo del número de propiedades
            </p>
          </div>
        )}

        {/* Log */}
        {(running || done) && (
          <div
            ref={logRef}
            style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 14px",
              fontFamily: "monospace", fontSize: 12,
              maxHeight: 340, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 2,
              marginBottom: 14,
            }}
          >
            {log.map((entry, i) => (
              <div key={i} style={{ color: entry.color || C.textDim, whiteSpace: "pre-wrap" }}>
                {entry.msg}
              </div>
            ))}
            {running && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.accent, marginTop: 4 }}>
                <Spinner size={12} /> <span>Procesando...</span>
              </div>
            )}
          </div>
        )}

        {/* Resumen final */}
        {summary && (
          <div style={{
            padding: "12px 14px", marginBottom: 14,
            background: `${C.green}12`, border: `1px solid ${C.green}40`,
            borderRadius: 10, fontFamily: "DM Sans", fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, color: C.green, marginBottom: 6 }}>✅ Resultado</div>
            <div>📥 Nuevas en Supabase: <strong>{summary.indexed}</strong></div>
            <div style={{ color: C.textDim }}>⏭️ Ya existían: <strong>{summary.skipped}</strong></div>
            {summary.errors > 0 && <div style={{ color: C.red }}>❌ Errores: <strong>{summary.errors}</strong></div>}
          </div>
        )}

        {/* Botones */}
        {!running && !done && (
          <button
            onClick={run}
            style={{
              width: "100%", padding: "12px 0",
              background: C.accent, color: "white",
              border: "none", borderRadius: 8,
              fontFamily: "DM Sans", fontSize: 14, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🚀 Iniciar Reindexación
          </button>
        )}

        {done && (
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px 0",
              background: C.green, color: "white",
              border: "none", borderRadius: 8,
              fontFamily: "DM Sans", fontSize: 14, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        )}

      </Card>
    </div>
  );
};
