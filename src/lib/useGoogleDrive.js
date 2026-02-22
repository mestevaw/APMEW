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
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,parents)&pageSize=100&orderBy=folder,name`;
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
    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { ...apiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    });
    if (!res.ok) throw new Error(`Create folder failed: ${res.status}`);
    return res.json();
  };

  // ─── Find subfolder by name (case-insensitive partial match) ───
  const findSubfolder = async (parentId, nameQuery) => {
    if (!token) return null;
    const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '${nameQuery}' and trashed=false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: apiHeaders(),
    });
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  };

  // ─── Upload a file to a folder ───
  const uploadFile = async (file, fileName, parentId, onProgress) => {
    if (!token) throw new Error("No token");

    // Use resumable upload for reliability
    const metadata = { name: fileName, parents: [parentId] };

    // Initiate resumable upload
    const initRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: { ...apiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    if (!initRes.ok) throw new Error(`Upload init failed: ${initRes.status}`);
    const uploadUrl = initRes.headers.get("Location");

    // Upload the file content
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    return uploadRes.json();
  };

  // ─── Upload multiple photos to inspection folder ───
  const uploadPhotos = async (files, propertyFolderId, propertyName, onProgress) => {
    if (!token) throw new Error("No token");

    // 1. Find or create INSPECCION folder
    let inspeccionFolder = await findSubfolder(propertyFolderId, "INSPECCION");
    if (!inspeccionFolder) inspeccionFolder = await findSubfolder(propertyFolderId, "Inspeccion");
    if (!inspeccionFolder) inspeccionFolder = await findSubfolder(propertyFolderId, "inspeccion");
    if (!inspeccionFolder) {
      inspeccionFolder = await createFolder("INSPECCION", propertyFolderId);
    }

    // 2. Find or create year folder
    const year = new Date().getFullYear().toString();
    let yearFolder = await findSubfolder(inspeccionFolder.id, year);
    if (!yearFolder) {
      yearFolder = await createFolder(year, inspeccionFolder.id);
    }

    // 3. Create date subfolder: "22 feb 26"
    const now = new Date();
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const dateName = `${now.getDate()} ${months[now.getMonth()]} ${String(now.getFullYear()).slice(2)}`;
    let dateFolder = await findSubfolder(yearFolder.id, dateName);
    if (!dateFolder) {
      dateFolder = await createFolder(dateName, yearFolder.id);
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
      results.push(result);
    }

    return { dateFolder, results };
  };

  return { token, gisLoaded, signIn, signOut, listAllFiles, createFolder, findSubfolder, uploadFile, uploadPhotos };
};
