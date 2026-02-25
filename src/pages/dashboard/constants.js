// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/constants.js
// Versión: 2
// Fecha: 2026-02-25
// ═══════════════════════════════════════════

const base = import.meta.env.BASE_URL || "/";

// ─── Fotos de los hijos (antes base64, ahora en /public/img/) ───
export const KIDS = [
  { name: "Miki",   img: `${base}img/miki.jpg`,   folderId: "1sd8nbfGFBYO7aIdYjRHeTsM_tbP-WVJF" },
  { name: "Nico",   img: `${base}img/nico.jpg`,   folderId: "1OEn8nMjpJ3TYb7WgPC0kHfI6l4vKVq7o" },
  { name: "Gusano", img: `${base}img/gusano.jpg`, folderId: "1b8X8SnIfiql5uGLKCzTfBG9fAajCsYnm" },
];

export const PROFILE_FOLDERS = {
  AnaP: "1LjQaL9mFUXRtZauUUTCJdiBvE25vG8jr",
  Miguel: "1BRArGXI25YRMTl_l69DDqV0mFgeN9LIm",
};

// ─── Propiedades ───
export const PROPERTIES = [
  { address: "9519 Gillcross Way", owner: "Mango Nest" },
  { address: "10123 Dixon Wood", owner: "MNA Works" },
  { address: "10919 Soogan Trail", owner: "Tortuga Home" },
  { address: "14331 Purple Martin", owner: "Tortuga Home" },
  { address: "8719 Snow Goose", owner: "Tortuga Home" },
  { address: "10731 Shaencrossing", owner: "Tortuga Home" },
  { address: "9283 Ridge Breeze", owner: "Mango Nest" },
  { address: "5802 Silent Meadow", owner: "Mango Nest" },
  { address: "10603 Shaencrest", owner: "Tortuga Home" },
  { address: "12118 Allegheny River", owner: "MNA Works" },
  { address: "5275 Charolais", owner: "Mango Nest" },
  { address: "6515 Hazy Glen", owner: "Tortuga Home" },
  { address: "15151 Spring Mist", owner: "MNA Works" },
  { address: "14231 Dusky Thrush", owner: "Tortuga Home" },
  { address: "10 Moondance Hill", owner: "Mango Nest" },
  { address: "1526 Alaskan Wolf", owner: "Mango Nest" },
  { address: "5430 Spring Walk", owner: "Mango Nest" },
  { address: "7039 Cozy Run", owner: "MNA Works" },
  { address: "14107 Purple Martin", owner: "MNA Works" },
  { address: "5403 Villa Marco", owner: "MNA Works" },
  { address: "11636 Midnight Rain", owner: "MNA Works" },
  { address: "9319 Caen", owner: "MNA Works" },
  { address: "13662 Escort Drive", owner: "MNA Works", sold: true },
  { address: "626 Scarlet Ibis", owner: "MNA Works", sold: true },
  { address: "66 Brees Apt 37", owner: "MNA Works", sold: true },
  { address: "232 Argo Avenue", owner: "Miguel y AnaP" },
  { address: "Ave Progreso 15, Depto C101", owner: "Miguel y AnaP" },
];

export const PROPERTY_VALUES_2025 = {
  "6515 Hazy Glen": 195000, "10919 Soogan Trail": 185000, "14231 Dusky Thrush": 237000,
  "10731 Shaencrossing": 215000, "10603 Shaencrest": 215000, "8719 Snow Goose": 180000,
  "14331 Purple Martin": 215000, "5275 Charolais": 190000, "9283 Ridge Breeze": 240000,
  "5430 Spring Walk": 190000, "5802 Silent Meadow": 225000, "10 Moondance Hill": 214000,
  "1526 Alaskan Wolf": 175000, "9519 Gillcross Way": 220000, "5403 Villa Marco": 200000,
  "10123 Dixon Wood": 200000, "15151 Spring Mist": 215000, "14107 Purple Martin": 230000,
  "9319 Caen": 230000, "12118 Allegheny River": 260000, "11636 Midnight Rain": 254000,
  "7039 Cozy Run": 215000,
};
export const OWNER_COLORS = { "Mango Nest": "#4ADE80", "MNA Works": "#60A5FA", "Tortuga Home": "#F59E0B", "Argo Real": "#A78BFA", "Miguel y AnaP": "#C8A862" };
export const OWNER_SHORT = { "Mango Nest": "Mango", "MNA Works": "MNA", "Tortuga Home": "Tortuga", "Argo Real": "Argo", "Miguel y AnaP": "AnaPMEW" };

export const CARS = [
  { name: "Honda CRV", brand: "Honda", color: "#E11D48", folderId: "1bRNwYy_7oOBrpsfM6L3CXkNqJkDf9ez2" },
  { name: "Hyundai Tucson", brand: "Hyundai", color: "#0EA5E9", folderId: "16xmawC5FseVanmCF7vRS_lmeJdwwo3KJ" },
  { name: "Mazda 6", brand: "Mazda", color: "#8B5CF6", folderId: "1KoWVscaou96uzaB3w-92OmydVdtjEzf7" },
];

export const DEADLINE_TYPES = [
  { key: "seguro", label: "Seguro", icon: "🛡️" },
  { key: "verificacion", label: "Verificación", icon: "✅" },
  { key: "servicio", label: "Servicio/Mantenimiento", icon: "🔧" },
  { key: "utilidad", label: "Utilidad/Pago", icon: "💡" },
  { key: "impuesto", label: "Impuesto", icon: "🏛️" },
  { key: "renovacion", label: "Renovación", icon: "🔄" },
  { key: "otro", label: "Otro", icon: "📌" },
];

export const DEADLINE_CATEGORIES = [
  { key: "coche", label: "Coches", icon: "🚗", color: "#0EA5E9" },
  { key: "propiedad", label: "Propiedades", icon: "🏠", color: "#F59E0B" },
  { key: "personal", label: "Personal", icon: "👤", color: "#A78BFA" },
  { key: "negocio", label: "Negocio", icon: "💼", color: "#4ADE80" },
];

export const RECURRENCE_OPTIONS = [
  { key: null, label: "Una vez" },
  { key: "mensual", label: "Mensual" },
  { key: "trimestral", label: "Trimestral" },
  { key: "semestral", label: "Semestral" },
  { key: "anual", label: "Anual" },
];


export const getPropExpenseTypes = (addr) => {
  const mx = addr.includes("Progreso");
  const personal = mx || addr.includes("Argo");
  if (personal) return [
    { key: "electricity", label: mx ? "Luz" : "Electricity", icon: "💡" },
    { key: "water", label: mx ? "Agua" : "Water", icon: "💧" },
    { key: "gas", label: "Gas", icon: "🔥" },
    { key: "property_tax", label: mx ? "Predial" : "Property Tax", icon: "🏛️" },
    { key: "insurance", label: mx ? "Seguro" : "Insurance", icon: "🛡️" },
    { key: "hoa", label: "Mantenimiento", icon: "🏘️" },
  ];
  // US rental properties (Form 8825 categories)
  return [
    { key: "gross_rents", label: "Rentas Totales", icon: "💰", income: true },
    { key: "maintenance", label: "Maintenance", icon: "🔧" },
    { key: "insurance", label: "Insurance", icon: "🛡️" },
    { key: "legal_fees", label: "Legal Fees", icon: "⚖️" },
    { key: "repairs", label: "Repairs", icon: "🔨" },
    { key: "property_tax", label: "Property Taxes", icon: "🏛️" },
    { key: "utilities", label: "Utilities", icon: "💡" },
    { key: "depreciation", label: "Depreciation", icon: "📉" },
    { key: "other_expenses", label: "Other", icon: "📋" },
  ];
};

export const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
