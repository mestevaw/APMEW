// ═══════════════════════════════════════════
// Archivo: src/pages/dashboard/PropertyTabs.jsx
// Versión: 1.0
// Fecha: 2026-03-02
// ═══════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { C } from "../../lib/theme";
import { Card } from "../../components/UI";
import PropertyExpenses from "./PropertyExpenses";
import InspectionPanel from "./InspectionPanel";
import { PROPERTY_VALUES_2025 } from "./constants";
import { fmtMoney } from "./helpers";

const PropertyTabs = ({ property, mob, drive, onInspectionPhotos }) => {
  const [activeTab, setActiveTab] = useState("inspecciones");

  const tabs = [
    { id: "inspecciones", label: "📸 Inspecciones", icon: "📸" },
    { id: "gastos", label: "💰 Gastos", icon: "💰" },
    { id: "valor", label: "🏠 Valor", icon: "🏠" },
    { id: "ingresos", label: "📊 Ingresos/Egresos", icon: "📊" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 16,
        borderBottom: `1px solid ${C.border}`,
        overflowX: "auto",
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: mob ? "10px 16px" : "12px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "DM Sans",
              fontSize: mob ? 12 : 13,
              fontWeight: activeTab === tab.id ? 600 : 500,
              color: activeTab === tab.id ? C.accent : C.textDim,
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {mob ? tab.icon : tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "inspecciones" && (
          <InspectionTab property={property} mob={mob} drive={drive} onPhotos={onInspectionPhotos} />
        )}
        
        {activeTab === "gastos" && (
          <GastosTab property={property} mob={mob} />
        )}
        
        {activeTab === "valor" && (
          <ValorTab property={property} mob={mob} />
        )}
        
        {activeTab === "ingresos" && (
          <IngresosEgresosTab property={property} mob={mob} />
        )}
      </div>
    </div>
  );
};

// ── Pestaña de Inspecciones ──
const InspectionTab = ({ property, mob, drive, onPhotos }) => {
  return <InspectionPanel property={property} mob={mob} drive={drive} />;
};

// ── Pestaña de Gastos ──
const GastosTab = ({ property, mob }) => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div>
      {/* Búsqueda por proveedor */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: C.surface2,
          border: `1px solid ${searchTerm ? C.accent : C.border}`,
          borderRadius: 8,
          transition: "border-color 0.2s",
        }}>
          <span style={{ fontSize: 16, color: searchTerm ? C.accent : C.textMuted }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por proveedor, concepto o tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: C.text,
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.accent,
                padding: 4,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              ✕
            </button>
          )}
        </div>
        {searchTerm && (
          <div style={{
            fontFamily: "DM Sans",
            fontSize: 11,
            color: C.accent,
            marginTop: 6,
            padding: "4px 8px",
            background: `${C.accent}10`,
            borderRadius: 4,
            display: "inline-block",
          }}>
            🔍 Buscando: "{searchTerm}"
          </div>
        )}
      </div>

      {/* Component de gastos con filtro */}
      <PropertyExpenses address={property.address} mob={mob} searchFilter={searchTerm} />
    </div>
  );
};

// ── Pestaña de Valor ──
const ValorTab = ({ property, mob }) => {
  const value = PROPERTY_VALUES_2025[property.address];

  return (
    <div>
      {value ? (
        <Card>
          <div style={{ textAlign: "center", padding: mob ? 30 : 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 8 }}>
              Valor Estimado 2025
            </div>
            <div style={{
              fontFamily: "JetBrains Mono",
              fontSize: mob ? 28 : 36,
              fontWeight: 700,
              color: C.accent,
            }}>
              {fmtMoney(value)}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim }}>
              No hay valor estimado para esta propiedad
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ── Pestaña de Ingresos y Egresos ──
const IngresosEgresosTab = ({ property, mob }) => {
  return (
    <Card>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.textDim, marginBottom: 4 }}>
          Reporte de Ingresos y Egresos
        </div>
        <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted }}>
          Próximamente
        </div>
      </div>
    </Card>
  );
};

export default PropertyTabs;
