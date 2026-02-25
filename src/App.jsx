// ═══════════════════════════════════════════
// Archivo: src/lib/useGoogleDrive.js
// Versión: 1.1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE, DRIVE_RESOURCE_KEY } from "./config";

export const useGoogleDrive = () => {
  const [token, setToken] = useState(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (resp) => { if (resp.access_token) setToken(resp.access_token); },
      });
      setGisLoaded(true);
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch (e) {} };
  }, []);

  const signIn = useCallback(() => {
    if (clientRef.current) clientRef.current.requestAccessToken();
  }, []);

  const signOut = useCallback(() => {
    if (token) { window.google.accounts.oauth2.revoke(token); setToken(null); }
  }, [token]);

  const apiHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const listFiles = useCallback(async (folderId, pageToken) => {
    if (!token || !folderId || folderId === "undefined" || folderId === "null") return null;
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,parents)&pageSize=100&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, {
      headers: {
        ...apiHeaders(),
        "X-Goog-Drive-Resource-Keys": `${folderId}/${DRIVE_RESOURCE_KEY}`,
      },
    });
    return res.json();
  }, [token, apiHeaders]);

  const listAllFiles = useCallback(async (folderId) => {
    let allFiles = [];
    let pageToken = null;
    do {
      const data = await listFiles(folderId, pageToken);
      if (data && data.files) allFiles = [...allFiles, ...data.files];
      pageToken = data?.nextPageToken;
    } while (pageToken);
    return allFiles;
  }, [listFiles]);

  // ─── Create a folder inside a parent folder ───
  const createFolder = useCallback(async (name, parentId) => {
    if (!token) throw new Error("No token");
    const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
      method: "POST",
      headers: {
        ...apiHeaders(),
        "Content-Type": "application/json",
        "X-Goog-Drive-Resource-Keys": `${parentId}/${DRIVE_RESOURCE_KEY}`,
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Create folder "${name}" failed: ${res.status} ${errText}`);
    }
    return res.json();
  }, [token, apiHeaders]);

  // ─── Find subfolder by name using listFiles ───
  const findSubfolder = useCallback(async (parentId, nameQuery) => {
    if (!token) return null;
    const data = await listFiles(parentId);
    if (!data || !data.files) return null;
    const query = nameQuery.toLowerCase();
    const folder = data.files.find(f =>
      f.mimeType === "application/vnd.google-apps.folder" && f.name.toLowerCase().includes(query)
    );
    return folder ? { id: folder.id, name: folder.name } : null;
  }, [token, listFiles]);

  // ─── Upload a file to a folder ───
  const uploadFile = useCallback(async (file, fileName, parentId, onProgress) => {
    if (!token) throw new Error("No token");

    const metadata = { name: fileName, parents: [parentId] };

    // Initiate resumable upload
    const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
      method: "POST",
      headers: {
        ...apiHeaders(),
        "Content-Type": "application/json",
        "X-Goog-Drive-Resource-Keys": `${parentId}/${DRIVE_RESOURCE_KEY}`,
      },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => "");
      throw new Error(`Upload init failed: ${initRes.status} ${errText}`);
    }
    const uploadUrl = initRes.headers.get("Location");

    // Upload the file content
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      throw new Error(`Upload failed: ${uploadRes.status} ${errText}`);
    }
    return uploadRes.json();
  }, [token, apiHeaders]);

  // ─── Search for a property folder by navigating Drive tree ───
  const searchFolderByAddress = useCallback(async (address, ownerName, rootFolderId) => {
    if (!token || !rootFolderId || !address) return null;
    try {
      const numMatch = address.match(/^\d+/);
      const street = address.replace(/^\d+\s*/, "").trim().split(/[\s,]/)[0].toUpperCase();
      if (!numMatch) return null;
      console.log("[searchFolder] Looking for:", numMatch[0], street, "owner:", ownerName);

      // Step 1: Find PROPERTY MANAGEMENT in root
      const pmFolder = await findSubfolder(rootFolderId, "PROPERTY MANAGEMENT");
      if (!pmFolder) { console.log("[searchFolder] PROPERTY MANAGEMENT not found"); return null; }

      // Step 2: Find owner folder (e.g. TORTUGA HOME)
      const ownerClean = ownerName?.trim();
      const ownerFolder = ownerClean ? await findSubfolder(pmFolder.id, ownerClean) : null;
      console.log("[searchFolder] Owner folder:", ownerFolder);

      // Step 3: Search for address folder inside owner (or PM if no owner found)
      const searchIn = ownerFolder || pmFolder;
      const data = await listFiles(searchIn.id);
      if (!data?.files) return null;

      const match = data.files.find(f => {
        if (f.mimeType !== "application/vnd.google-apps.folder") return false;
        const name = f.name.toUpperCase();
        return name.includes(numMatch[0]) && name.includes(street);
      });

      if (match) {
        console.log("[searchFolder] Found:", match.name, match.id);
        return { id: match.id, name: match.name };
      }

      // Step 4: If not found in owner, try all PM subfolders (fallback)
      if (ownerFolder) {
        console.log("[searchFolder] Not in owner folder, trying all PM subfolders...");
        const pmData = await listFiles(pmFolder.id);
        if (pmData?.files) {
          for (const sub of pmData.files.filter(f => f.mimeType === "application/vnd.google-apps.folder")) {
            const subData = await listFiles(sub.id);
            const found = subData?.files?.find(f => {
              if (f.mimeType !== "application/vnd.google-apps.folder") return false;
              const name = f.name.toUpperCase();
              return name.includes(numMatch[0]) && name.includes(street);
            });
            if (found) {
              console.log("[searchFolder] Found in", sub.name, ":", found.name, found.id);
              return { id: found.id, name: found.name };
            }
          }
        }
      }

      console.log("[searchFolder] NOT FOUND:", address);
      return null;
    } catch (e) {
      console.error("[searchFolder] Error:", e);
      return null;
    }
  }, [token, findSubfolder, listFiles]);

  // ─── Upload multiple photos to inspection folder ───
  // v1.1: Detección de duplicados — lista archivos existentes y salta los que ya están
  const uploadPhotos = useCallback(async (files, propertyFolderId, propertyName, onProgress) => {
    if (!token) throw new Error("No token");
    console.log("[uploadPhotos] Starting:", { propertyFolderId, propertyName, fileCount: files.length });

    // 1. Find or create INSPECCION folder
    let inspeccionFolder = await findSubfolder(propertyFolderId, "INSPEC");
    console.log("[uploadPhotos] INSPECCION found:", inspeccionFolder);
    if (!inspeccionFolder) {
      inspeccionFolder = await createFolder("INSPECCION", propertyFolderId);
      console.log("[uploadPhotos] INSPECCION created:", inspeccionFolder);
    }

    // 2. Find or create year folder
    const year = new Date().getFullYear().toString();
    let yearFolder = await findSubfolder(inspeccionFolder.id, year);
    console.log("[uploadPhotos] Year folder found:", yearFolder);
    if (!yearFolder) {
      yearFolder = await createFolder(year, inspeccionFolder.id);
      console.log("[uploadPhotos] Year folder created:", yearFolder);
    }

    // 3. Create date subfolder: "22 feb 26"
    const now = new Date();
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const dateName = `${now.getDate()} ${months[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
    let dateFolder = await findSubfolder(yearFolder.id, dateName);
    console.log("[uploadPhotos] Date folder found:", dateFolder);
    if (!dateFolder) {
      dateFolder = await createFolder(dateName, yearFolder.id);
      console.log("[uploadPhotos] Date folder created:", dateFolder);
    }

    // 4. Check existing files in date folder to avoid duplicates
    const existingFiles = await listAllFiles(dateFolder.id);
    const existingNames = new Set((existingFiles || []).map(f => f.name));
    console.log("[uploadPhotos] Existing files in folder:", existingNames.size, [...existingNames]);

    // 5. Upload each photo, skipping duplicates
    const results = [];
    let skipped = 0;
    const shortName = propertyName.replace(/^\d+\s*/, "").split(/\s+/).slice(0, 2).join(" ");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${shortName} ${i + 1} Foto ${dateName}.${ext}`;

      if (existingNames.has(fileName)) {
        console.log("[uploadPhotos] SKIP (duplicate):", fileName);
        skipped++;
        if (onProgress) onProgress(i + 1, files.length, `⏭️ ${fileName} (ya existe)`);
        // Add to results with the existing file's id so Supabase indexing still works
        const existing = (existingFiles || []).find(f => f.name === fileName);
        if (existing) results.push({ id: existing.id, name: existing.name, mimeType: existing.mimeType, skipped: true });
        continue;
      }

      if (onProgress) onProgress(i + 1, files.length, fileName);
      const result = await uploadFile(file, fileName, dateFolder.id);
      console.log("[uploadPhotos] Uploaded:", fileName, "→", result.id);
      results.push(result);
    }

    console.log("[uploadPhotos] Done!", { uploaded: results.length - skipped, skipped, total: files.length });
    return { dateFolder, yearFolder, inspeccionFolder, results, skipped };
  }, [token, findSubfolder, createFolder, uploadFile, listAllFiles]);

  return { token, gisLoaded, signIn, signOut, listAllFiles, createFolder, findSubfolder, uploadFile, uploadPhotos, searchFolderByAddress };
};
