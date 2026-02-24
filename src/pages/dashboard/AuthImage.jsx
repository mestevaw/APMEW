// dashboard/AuthImage.jsx
import { useState, useEffect } from "react";
import { getDriveMediaUrl, getThumbnailUrl } from "./helpers";

const AuthImage = ({ fileId, token, alt, style }) => {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    if (token) {
      fetch(getDriveMediaUrl(fileId), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(blob => { if (!cancelled) setSrc(URL.createObjectURL(blob)); })
        .catch(() => { if (!cancelled) setSrc(getThumbnailUrl(fileId)); });
    } else {
      setSrc(getThumbnailUrl(fileId));
    }
    return () => { cancelled = true; };
  }, [fileId, token]);

  if (err) return <span style={{ fontSize: 24 }}>📷</span>;
  if (!src) return <Spinner />;
  return <img src={src} alt={alt || ""} style={style} onError={() => setErr(true)} />;
};


export default AuthImage;
