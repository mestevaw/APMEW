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

  const listFiles = async (folderId, pageToken) => {
    if (!token) return null;
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,parents)&pageSize=100&orderBy=folder,name`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
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

  return { token, gisLoaded, signIn, signOut, listAllFiles };
};
