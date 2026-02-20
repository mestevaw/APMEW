import { useState, useEffect } from "react";

export const fmt = (n, d = 0) => {
  if (n == null || isNaN(n)) return "$0";
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(n);
};

export const pct = (n) => `${(n * 100).toFixed(1)}%`;

export const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};
