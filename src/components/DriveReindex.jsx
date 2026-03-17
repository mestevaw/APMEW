// ═══════════════════════════════════════════
// Archivo: src/components/DriveReindex.jsx
// Versión: V2
// Fecha: 2026-03-16
// ═══════════════════════════════════════════
// CAMBIOS EN V2:
// - Además de PROPERTY MANAGEMENT, ahora también indexa PROPIEDADES MEXICO
//   (carpeta raíz de "Miguel y AnaP" — antes nunca se escaneaba)
// - Usa DRIVE_ROOT_FOLDER_ID desde constants en lugar de config
//   para que el root sea el Drive completo y no una subcarpeta
// - Estructura de indexación para PROPIEDADES MEXICO:
//   root → PROPIEDADES MEXICO → subcarpetas de propiedad (cualquier nombre)
// ═══════════════════════════════════════════

import { useState, useRef } from "react";
import { C } from "../lib/theme";
import { Card, Spinner } from "./UI";
import { supaUpsert, supaFetch } from "../lib/supabase";
import { DRIVE_ROOT_FOLDER } from "../lib/config";
import { PROPERTY_FOLDER_IDS } from "../pages/dashboard/constants";

// ─── Raíz alternativa: el Drive completo (para encontrar PROPIEDADES MEXICO) ──
// Si DRIVE_ROOT_FOLDER apunta a una subcarpeta (ej. APMEW), usamos ese mismo
// ya que PROPIEDADES MEXICO está dentro de él según los IDs confirmados
const ROOT = DRIVE_ROOT_FOLDER;

// ─── Helper: indexar todas las subcarpetas de propiedad dentro de un folder ───
const indexPropertyFolder = async (
  drive, supaUpsert, supaFetch,
  parentFolder, ownerPath, addLog
) => {
  let indexed = 0, skipped = 0, errors = 0;

  const children = await drive.listAllFiles(parentFolder.id);
  const propFolders = (children?.files || children || [])
    .filter(f => f.mimeType === "application/vnd.google-apps.folder");

  addLog(`  📋 ${propFolders.length} carpetas encontradas`);

  for (const propFolder of propFolders) {
    const propPath = `${ownerPath}/${propFolder.name}`;
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
          parent_drive_id: parentFolder.id,
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

  return { indexed, skipped, errors };
};

export const DriveReindex = ({ drive, onClose }) => {
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [log,     setLog]     = useState([]);
  const [summary, setSummary] = useState(null);
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
      const rootContents = await drive.listAllFiles(ROOT);
      const rootFolders  = (rootContents?.files || rootContents || [])
        .filter(f => f.mimeType === "application/vnd.google-apps.folder");

      // ══════════════════════════════════════════════════════
      // BLOQUE 1: PROPERTY MANAGEMENT
      // ══════════════════════════════════════════════════════
      addLog("🔍 Buscando PROPERTY MANAGEMENT...");
      const pmFolder = rootFolders.find(f => f.name.toUpperCase().includes("PROPERTY MANAGEMENT"));

      if (pmFolder) {
        addLog(`✅ PROPERTY MANAGEMENT: ${pmFolder.id}`, C.green);

        // Upsert del folder de PM
        await supaUpsert("drive_folders", {
          name:            pmFolder.name,
          google_drive_id: pmFolder.id,
          parent_drive_id: ROOT,
          folder_path:     pmFolder.name,
        }).catch(() => {});

        const pmChildren   = await drive.listAllFiles(pmFolder.id);
        const ownerFolders = (pmChildren?.files || pmChildren || [])
          .filter(f => f.mimeType === "application/vnd.google-apps.folder");

        addLog(`📂 ${ownerFolders.length} carpetas de owner en PROPERTY MANAGEMENT`);

        for (const ownerFolder of ownerFolders) {
          addLog(`\n👤 ${ownerFolder.name}`);
          const ownerPath = `${pmFolder.name}/${ownerFolder.name}`;

          await supaUpsert("drive_folders", {
            name:            ownerFolder.name,
            google_drive_id: ownerFolder.id,
            parent_drive_id: pmFolder.id,
            folder_path:     ownerPath,
          }).catch(e => addLog(`  ⚠️ Error guardando owner: ${e.message}`, C.orange));

          // Solo indexar subcarpetas que empiecen con número (propiedades)
          const ownerChildren = await drive.listAllFiles(ownerFolder.id);
          const propFolders   = (ownerChildren?.files || ownerChildren || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder"
                      && /^\d/.test(f.name));

          addLog(`  📋 ${propFolders.length} propiedades`);

          for (const propFolder of propFolders) {
            const propPath = `${ownerPath}/${propFolder.name}`;
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

          await new Promise(r => setTimeout(r, 300));
        }
      } else {
        addLog("⚠️ PROPERTY MANAGEMENT no encontrado en la raíz", C.orange);
      }

      // ══════════════════════════════════════════════════════
      // BLOQUE 2: PROPIEDADES MEXICO (Miguel y AnaP)
      // ══════════════════════════════════════════════════════
      addLog("\n🔍 Buscando PROPIEDADES MEXICO...");
      const propMexFolder = rootFolders.find(f =>
        f.name.toUpperCase().includes("PROPIEDADES MEXICO") ||
        f.name.toUpperCase().includes("PROPIEDADES MX")
      );

      if (propMexFolder) {
        addLog(`✅ ${propMexFolder.name}: ${propMexFolder.id}`, C.green);

        await supaUpsert("drive_folders", {
          name:            propMexFolder.name,
          google_drive_id: propMexFolder.id,
          parent_drive_id: ROOT,
          folder_path:     propMexFolder.name,
        }).catch(() => {});

        addLog(`\n👤 Miguel y AnaP (${propMexFolder.name})`);
        const res = await indexPropertyFolder(
          drive, supaUpsert, supaFetch,
          propMexFolder,
          `${propMexFolder.name}`,
          addLog
        );
        indexed += res.indexed;
        skipped += res.skipped;
        errors  += res.errors;
      } else {
        // Fallback: usar ID hardcodeado de constants si el folder no aparece en el listado
        addLog("⚠️ PROPIEDADES MEXICO no encontrado por nombre — usando ID hardcodeado", C.orange);
        addLog("  Intentando con ID: 0B9ZOcVkjNKRIUTRRWTJkajNyODQ");
        try {
          const propMexFiles = await drive.listAllFiles("0B9ZOcVkjNKRIUTRRWTJkajNyODQ");
          const subfolders   = (propMexFiles?.files || propMexFiles || [])
            .filter(f => f.mimeType === "application/vnd.google-apps.folder");
          addLog(`  📋 ${subfolders.length} carpetas encontradas vía ID`);

          for (const sub of subfolders) {
            const propPath = `PROPIEDADES MEXICO/${sub.name}`;
            try {
              const existing = await supaFetch("drive_folders", {
                filters: `google_drive_id=eq.${sub.id}`,
                limit: 1,
              });
              if (existing?.length > 0) {
                addLog(`  ⏭️ ${sub.name}`, C.textDim);
                skipped++;
              } else {
                await supaUpsert("drive_folders", {
                  name:            sub.name,
                  google_drive_id: sub.id,
                  parent_drive_id: "0B9ZOcVkjNKRIUTRRWTJkajNyODQ",
                  folder_path:     propPath,
                });
                addLog(`  ✅ ${sub.name}`, C.green);
                indexed++;
              }
            } catch (e) {
              addLog(`  ❌ ${sub.name}: ${e.message}`, C.red);
              errors++;
            }
          }
        } catch (e) {
          addLog(`  ❌ Error accediendo PROPIEDADES MEXICO: ${e.message}`, C.red);
        }
      }

      // ══════════════════════════════════════════════════════
      // BLOQUE 3: Progreso 15 C101 — verificar/insertar directo
      // ══════════════════════════════════════════════════════
      addLog("\n🏠 Verificando Progreso 15 C101 (ID directo)...");
      try {
        const existing = await supaFetch("drive_folders", {
          filters: `google_drive_id=eq.1iHjjMzSWdMzaG9Lgeu5JG7YvXkEBHMDs`,
          limit: 1,
        });
        if (existing?.length > 0) {
          addLog("  ⏭️ Progreso 15 C101 ya estaba en Supabase", C.textDim);
          skipped++;
        } else {
          await supaUpsert("drive_folders", {
            name:            "Progreso 15 C101",
            google_drive_id: "1iHjjMzSWdMzaG9Lgeu5JG7YvXkEBHMDs",
            parent_drive_id: "0B9ZOcVkjNKRIUTRRWTJkajNyODQ",
            folder_path:     "PROPIEDADES MEXICO/Progreso 15 C101",
          });
          addLog("  ✅ Progreso 15 C101 agregado a Supabase", C.green);
          indexed++;
        }
      } catch (e) {
        addLog(`  ❌ Progreso 15: ${e.message}`, C.red);
        errors++;
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            🗂️ Reindexar Drive → Supabase
          </h2>
          {!running && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 22 }}>✕</button>
          )}
        </div>

        {!running && !done && (
          <div style={{
            padding: "12px 14px", marginBottom: 18,
            background: `${C.accent}12`, border: `1px solid ${C.accent}40`,
            borderRadius: 10, fontFamily: "DM Sans", fontSize: 13, color: C.text, lineHeight: 1.6,
          }}>
            <p style={{ margin: "0 0 8px" }}>
              Recorre Drive y registra en Supabase la carpeta de cada propiedad.
            </p>
            <p style={{ margin: 0, color: C.textDim, fontSize: 12 }}>
              • Escanea <strong style={{ color: C.text }}>PROPERTY MANAGEMENT</strong> (todas las empresas)<br/>
              • Escanea <strong style={{ color: C.text }}>PROPIEDADES MEXICO</strong> (Miguel y AnaP)<br/>
              • Registra <strong style={{ color: C.text }}>Progreso 15 C101</strong> directamente por ID<br/>
              • Las que ya existen se saltan (sin duplicados)<br/>
              • Tarda ~1-2 min
            </p>
          </div>
        )}

        {(running || done) && (
          <div ref={logRef} style={{
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px",
            fontFamily: "monospace", fontSize: 12,
            maxHeight: 340, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 2,
            marginBottom: 14,
          }}>
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

        {!running && !done && (
          <button onClick={run} style={{
            width: "100%", padding: "12px 0",
            background: C.accent, color: "white",
            border: "none", borderRadius: 8,
            fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            🚀 Iniciar Reindexación
          </button>
        )}

        {done && (
          <button onClick={onClose} style={{
            width: "100%", padding: "12px 0",
            background: C.green, color: "white",
            border: "none", borderRadius: 8,
            fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            Cerrar
          </button>
        )}

      </Card>
    </div>
  );
};
