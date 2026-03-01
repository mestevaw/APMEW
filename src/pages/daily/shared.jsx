// ═══════════════════════════════════════════
// Archivo: src/pages/daily/shared.jsx
// Versión: 1
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

import { C, inputStyle } from "../../lib/theme";

// ─── Re-export menú consolidado (antes estaba duplicado aquí) ───
export { DropMenu, MenuBtn, MenuDivider, MenuLabel, CloseBtn } from "../../components/Menu";

// ─── Display maps ───
export const CAT_DISPLAY = { hogar: "Casa", supermercado: "Súper", restaurantes: "Rest.", entretenimiento: "Entret.", servicios: "Serv.", transporte: "Transp.", salud: "Salud", otro: "Otro" };
export const displayCat = (cat) => CAT_DISPLAY[cat] || cat;
export const WHO_DISPLAY = { Miguel: "MEW", AnaP: "AP", Ambos: "Amb" };
export const displayWho = (who) => WHO_DISPLAY[who] || who;

export const CATEGORIES = ["supermercado","transporte","salud","entretenimiento","servicios","restaurantes","hogar","otro"];

export const TAG_OPTIONS = ["Argo - Agua/Gas","Argo - Luz","Argo - Mant.","Progreso - Luz","Progreso - Agua","Progreso - Mant.","Mango Nest","MNA Works","Tortuga Home","Honda CRV","Hyundai Tucson","Mazda 6","Personal","Médico","Viaje","Educación"];

export const SUBCATEGORIES = {
  hogar: ["Suscripciones","Limpieza","Muebles","Electrónica","Ropa","Mascotas"],
  servicios: ["Internet","Teléfono","Streaming","Software","Seguros"],
  restaurantes: ["Café","Comida rápida","Formal","Delivery"],
  transporte: ["Gasolina","Uber/Taxi","Estacionamiento","Mant. auto","Vuelos","Honda CRV","Hyundai Tucson","Mazda 6"],
  salud: ["Farmacia","Consulta","Dentista","Óptica","Gym"],
  entretenimiento: ["Cine","Libros","Juegos","Eventos","Música"],
  supermercado: ["HEB","Whole Foods","Costco","Otro"],
  otro: ["Propina","Comisión","Donación","Otro"],
};

// ─── Logic helpers ───
export const isPayment = (e) => (e.category === "otro" || e.category === "Otro") && Number(e.amount) < 0;
export const displayConcept = (e) => isPayment(e) ? "Pago" : e.concept;
export const amountColor = (e) => isPayment(e) ? C.green : C.red;

export const shortCardLabel = (source) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return "Visa";
  if (s.includes("amex") || s.includes("american")) return "Amex";
  if (s.includes("master")) return "MC";
  if (s.includes("efectivo")) return "Cash";
  if (s.includes("transfer")) return "Transf";
  return source ? source.slice(0, 5) : "—";
};

// ─── Small SVG components ───
export const VisaLogo = () => (
  <svg width="32" height="11" viewBox="0 0 1000 324" xmlns="http://www.w3.org/2000/svg">
    <path d="M413.8 2.4L271.4 321.6h-93.2L116.7 52.1c-3.7-14.7-7-20.1-18.4-26.3C78.5 15.1 42 5 9.4 0l2.2-10.2h150c19.1 0 36.3 12.7 40.6 34.8l37.1 197.3L331.9 2.4h81.9zm323.6 215c.3-84.3-116.6-88.9-115.8-126.6.2-11.5 11.2-23.7 35.1-26.8 11.8-1.6 44.5-2.8 81.6 14.5l14.5-67.8C735.1 3.5 712.7-4 684.8-4c-77.2 0-131.5 41-131.9 99.7-.5 43.4 38.7 67.6 68.3 82 30.4 14.7 40.6 24.1 40.5 37.3-.2 20.1-24.3 29-46.7 29.4-39.2.6-62-10.6-80.1-19.1l-14.1 66.1c18.2 8.4 51.8 15.7 86.6 16.1 82 0 135.7-40.5 135.9-103.1zm203.8 104.2h72.4L946 2.4h-66.9c-15 0-27.7 8.8-33.3 22.2L708.2 321.6h82l16.3-45.1h100.2l9.5 45.1zM825 207.3l41.1-113.5 23.7 113.5H825zM523.6 2.4l-64.5 319.2h-78.1L445.5 2.4h78.1z" fill="#1a1f71"/>
  </svg>
);

export const AmexLogo = () => (
  <svg width="28" height="11" viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="16" rx="2" fill="#006FCF"/>
    <text x="24" y="12" textAnchor="middle" fill="white" fontFamily="Arial" fontWeight="700" fontSize="9">AMEX</text>
  </svg>
);

export const CardLogo = ({ source }) => {
  const s = (source || "").toLowerCase();
  if (s.includes("capital") || s.includes("visa")) return <VisaLogo />;
  if (s.includes("amex") || s.includes("american")) return <AmexLogo />;
  if (s.includes("master")) return <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: "#fff", background: "#EB001B", padding: "1px 5px", borderRadius: 3, lineHeight: "14px" }}>MC</span>;
  if (s.includes("efectivo")) return <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>💵</span>;
  if (s.includes("transfer")) return <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>🏦</span>;
  return source ? <span style={{ fontFamily: "DM Sans", fontSize: 9, color: C.textMuted }}>{source.slice(0, 6)}</span> : null;
};

export const Flag = ({ country }) => <span style={{ fontSize: 13, lineHeight: 1, cursor: "default" }} title={country === "MX" ? "México" : "EUA"}>{country === "MX" ? "🇲🇽" : "🇺🇸"}</span>;

// ─── UI atoms ───
export const dateStyle = { ...inputStyle, fontSize: 12, background: "#fff", color: "#111", borderColor: "#ccc" };
