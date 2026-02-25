// src/lib/useGoogleDrive.js
import { useState, useEffect, useRef } from "react";
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

  const signIn = () => { if (clientRef.current) clientRef.current.requestAccessToken(); };

  const signOut = () => {
    if (token) { window.google.accounts.oauth2.revoke(token); setToken(null); }
  };

  const apiHeaders = () => ({
    Authorization: `Bearer ${token}`,
  });

  const listFiles = async (folderId, pageToken) => {
    if (!token) return null;
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,parents)&pageSize=100&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, {
      headers: {
        ...apiHeaders(),
        "X-Goog-Drive-Resource-Keys": `${folderId}/${DRIVE_RESOURCE_KEY}`,
      },
    });
    return res.json();
  };

  const listAllFiles = async (folderId) => {
    let allFiles = [];
    let pageToken = null;
    do {
      const data = await listFiles(folderId, pageToken);
      if (data && data.files) allFiles = [...allFiles, ...data.files];
      pageToken = data?.nextPageToken;
    } while (pageToken);
    return allFiles;
  };

  // ─── Create a folder inside a parent folder ───
  const createFolder = async (name, parentId) => {
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
  };

  // ─── Find subfolder by name using listFiles (search API doesn't work for shared folders) ───
  const findSubfolder = async (parentId, nameQuery) => {
    if (!token) return null;
    const data = await listFiles(parentId);
    if (!data || !data.files) return null;
    const query = nameQuery.toLowerCase();
    const folder = data.files.find(f =>
      f.mimeType === "application/vnd.google-apps.folder" && f.name.toLowerCase().includes(query)
    );
    return folder ? { id: folder.id, name: folder.name } : null;
  };

  // ─── Upload a file to a folder ───
  const uploadFile = async (file, fileName, parentId, onProgress) => {
    if (!token) throw new Error("No token");

    // Use resumable upload for reliability
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
  };

  // ─── Upload multiple photos to inspection folder ───
  const uploadPhotos = async (files, propertyFolderId, propertyName, onProgress) => {
    if (!token) throw new Error("No token");
    console.log("[uploadPhotos] Starting:", { propertyFolderId, propertyName, fileCount: files.length });

    // 1. Find or create INSPECCION folder — search "INSPEC" to match INSPECCION/INSPECCIONES/INSPECCIÓN
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

    // 4. Upload each photo
    const results = [];
    const shortName = propertyName.replace(/^\d+\s*/, "").split(/\s+/).slice(0, 2).join(" ");
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${shortName} ${i + 1} Foto ${dateName}.${ext}`;
      if (onProgress) onProgress(i + 1, files.length, fileName);
      const result = await uploadFile(file, fileName, dateFolder.id);
      console.log("[uploadPhotos] Uploaded:", fileName, "→", result.id);
      results.push(result);
    }

    console.log("[uploadPhotos] Done!", { inspeccionFolder: inspeccionFolder.id, yearFolder: yearFolder.id, dateFolder: dateFolder.id, uploaded: results.length });
    return { dateFolder, yearFolder, inspeccionFolder, results };
  };

  return { token, gisLoaded, signIn, signOut, listAllFiles, createFolder, findSubfolder, uploadFile, uploadPhotos };
};
