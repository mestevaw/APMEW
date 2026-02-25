// Archivo: src/App.jsx
// Versión: 10.1 — Agregada página de Inspecciones
// Fecha: 2026-02-25

import { useState, useEffect, useCallback } from "react";

// ─── Lib ───
import { C, baseStyles } from "./lib/theme";
import { fmt } from "./lib/helpers";
import { useIsMobile } from "./lib/helpers";
import { I } from "./lib/icons";
import { supaFetch, supaUpdate, supaInsert } from "./lib/supabase";
import { useGoogleDrive } from "./lib/useGoogleDrive";

// ─── Components ───
import { Loading, NavItem } from "./components/UI";

// ─── Pages ───
import { DashboardPage } from "./pages/DashboardPage";
import { CrudPage } from "./pages/CrudPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { PatrimonyPage } from "./pages/PatrimonyPage";
import { ChecklistPage } from "./pages/ChecklistPage";
import { ProjectionPage } from "./pages/ProjectionPage";
import { DailyExpensesPage } from "./pages/DailyExpensesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { InspectionsPage } from "./pages/InspectionsPage";

// ─── Date helper ───
const todayStr = () => {
  const d = new Date();
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashKey, setDashKey] = useState(0);
  const mob = useIsMobile();
  const drive = useGoogleDrive();

  const [data, setData] = useState({
    profiles: [], assumptions: [], income: [], retIncome: [],
    expenses: [], expenseCategories: [], assets: [], debts: [],
    checklist: [], documents: [], dailyExpenses: [],
  });

  // ─── Carga inicial: todo de una vez (solo al montar) ───
  const loadData = useCallback(async () => {
    try {
      const [profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses] = await Promise.all([
        supaFetch("profiles", { order: "name" }),
        supaFetch("financial_assumptions", { order: "key" }),
        supaFetch("current_income", { order: "sort_order" }),
        supaFetch("retirement_income", { order: "sort_order" }),
        supaFetch("retirement_expenses", { order: "sort_order" }),
        supaFetch("expense_categories", { order: "sort_order" }),
        supaFetch("assets", { order: "sort_order" }),
        supaFetch("debts", { order: "sort_order" }),
        supaFetch("checklist_items", { order: "sort_order" }),
        supaFetch("documents", { order: "folder_path,title" }),
        supaFetch("daily_expenses", { order: "expense_date.desc,created_at.desc", limit: 10000 }),
      ]);
      setData({ profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses });
    } catch (err) { console.error("Error cargando datos:", err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Recargas selectivas: solo bajan la tabla que cambió ───
  const reloadTable = useCallback(async (key, table, options) => {
    try {
      const rows = await supaFetch(table, options);
      setData(prev => ({ ...prev, [key]: rows }));
    } catch (err) { console.error(`Error recargando ${table}:`, err); }
  }, []);

  const reloadChecklist = () => reloadTable("checklist", "checklist_items", { order: "sort_order" });
  const reloadDailyExpenses = () => reloadTable("dailyExpenses", "daily_expenses", { order: "expense_date.desc,created_at.desc", limit: 10000 });
  const reloadIncome = () => reloadTable("income", "current_income", { order: "sort_order" });
  const reloadRetIncome = () => reloadTable("retIncome", "retirement_income", { order: "sort_order" });
  const reloadExpenses = () => reloadTable("expenses", "retirement_expenses", { order: "sort_order" });
  const reloadAssets = () => reloadTable("assets", "assets", { order: "sort_order" });
  const reloadDebts = () => reloadTable("debts", "debts", { order: "sort_order" });
  const reloadDocuments = () => reloadTable("documents", "documents", { order: "folder_path,title" });
  const reloadPatrimony = async () => { await reloadAssets(); await reloadDebts(); };

  // ─── Actions ───
  const toggleChecklist = async (item) => {
    await supaUpdate("checklist_items", item.id, {
      is_completed: !item.is_completed,
      completed_date: !item.is_completed ? new Date().toISOString().split("T")[0] : null,
    });
    reloadChecklist();
  };

  const addDailyExpense = async (expense) => {
    await supaInsert("daily_expenses", expense);
    reloadDailyExpenses();
  };

  // ─── Navigation (sin Dashboard — se accede via APMEW logo) ───
  const navItems = [
    { id: "income", label: "Ingresos Actuales", icon: I.income },
    { id: "retIncome", label: "Ingresos Retiro", icon: I.income },
    { id: "expenses", label: "Gastos Retiro", icon: I.expenses },
    { id: "patrimony", label: "Patrimonio", icon: I.patrimony },
    { id: "projection", label: "Proyección 30 Años", icon: I.projection },
    { id: "checklist", label: "Checklist", icon: I.checklist },
    { id: "daily", label: "Gastos Diarios", icon: I.daily },
    { id: "docs", label: "Documentos", icon: I.docs },
    { id: "inspections", label: "Inspecciones", icon: I.inspection },
  ];

  const goHome = () => { setPage("dashboard"); setDashKey(k => k + 1); if (mob) setSidebarOpen(false); };
  const handleNav = (id) => { setPage(id); if (mob) setSidebarOpen(false); };

  // ─── Page Router ───
  const renderPage = () => {
    if (loading) return <Loading />;
    switch (page) {
      case "dashboard":
        return <DashboardPage key={dashKey} data={data} mob={mob} drive={drive} goToPage={(p) => { setPage(p); if (mob) setSidebarOpen(false); }} />;

      case "income":
        return <CrudPage title="Ingresos Actuales" subtitle="Últimos ingresos antes de retirarse" table="current_income" items={data.income} mob={mob} reload={reloadIncome} totalLabel="TOTAL MENSUAL" totalKey="monthly_amount"
          columns={[
            { label: "Fuente", key: "source", bold: true },
            { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
            { label: "Notas", key: "notes", color: () => C.textDim },
          ]}
          formFields={[
            { key: "source", label: "Fuente de Ingreso" },
            { key: "monthly_amount", label: "Monto Mensual", type: "number" },
            { key: "notes", label: "Notas" },
          ]}
          defaults={{ source: "", monthly_amount: 0, notes: "" }} />;

      case "retIncome":
        return <CrudPage title="Ingresos en Retiro" subtitle="Fuentes de ingreso una vez retirados" table="retirement_income" items={data.retIncome} mob={mob} reload={reloadRetIncome} totalLabel="TOTAL MENSUAL" totalKey="monthly_amount"
          columns={[
            { label: "Fuente", key: "source", bold: true },
            { label: "Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
            { label: "Anual", key: "annual_amount", align: "right", mono: true, render: r => r.annual_amount ? fmt(Number(r.annual_amount)) : "—" },
            { label: "Notas", key: "notes", color: () => C.textDim },
          ]}
          formFields={[
            { key: "source", label: "Fuente de Ingreso" },
            { key: "monthly_amount", label: "Monto Mensual", type: "number" },
            { key: "annual_amount", label: "Monto Anual", type: "number" },
            { key: "notes", label: "Notas" },
          ]}
          defaults={{ source: "", monthly_amount: 0, annual_amount: 0, notes: "" }} />;

      case "expenses":
        return <ExpensesPage expenses={data.expenses} categories={data.expenseCategories} mob={mob} reload={reloadExpenses} />;

      case "patrimony":
        return <PatrimonyPage assets={data.assets} debts={data.debts} mob={mob} reload={reloadPatrimony} />;

      case "projection":
        return <ProjectionPage profiles={data.profiles} assumptions={data.assumptions} mob={mob} />;

      case "checklist":
        return <ChecklistPage checklist={data.checklist} onToggle={toggleChecklist} mob={mob} />;

      case "daily":
        return <DailyExpensesPage dailyExpenses={data.dailyExpenses} onAdd={addDailyExpense} mob={mob} reload={reloadDailyExpenses} />;

      case "docs":
        return <DocumentsPage documents={data.documents} mob={mob} reload={reloadDocuments} drive={drive} />;

      case "inspections":
        return <InspectionsPage mob={mob} drive={drive} />;

      default:
        return <DashboardPage key={dashKey} data={data} mob={mob} drive={drive} goToPage={(p) => { setPage(p); if (mob) setSidebarOpen(false); }} />;
    }
  };

  // ─── Layout ───

  // Full-screen Drive connection prompt (first thing user sees)
  if (!drive.token) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
        <style>{baseStyles}</style>
        <div style={{ margin: "auto", textAlign: "center", padding: 40, maxWidth: 400 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 32, fontWeight: 700, color: C.accent, letterSpacing: 3, marginBottom: 8 }}>APMEW</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginBottom: 40 }}>{todayStr()}</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "40px 32px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Conectar Google Drive</h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 28, lineHeight: 1.5 }}>Para ver documentos, fotos de inspecciones y archivos de las propiedades.</p>
            <button onClick={drive.signIn} disabled={!drive.gisLoaded} style={{
              fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
              color: "#fff", background: C.accent,
              border: "none", borderRadius: 10, padding: "12px 32px",
              cursor: drive.gisLoaded ? "pointer" : "default",
              opacity: drive.gisLoaded ? 1 : 0.5,
              width: "100%",
            }}>{drive.gisLoaded ? "🔗 Iniciar sesión con Google" : "Cargando..."}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
      <style>{baseStyles}</style>

      {/* Mobile top bar */}
      {mob && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", height: 56 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4, display: "flex" }}>
            {sidebarOpen ? I.close : I.menu}
          </button>
          <button onClick={goHome} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>APMEW</button>
          <div style={{ width: 32 }} />
        </div>
      )}

      {/* Mobile overlay */}
      {mob && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 290 }} />
      )}

      {/* Sidebar */}
      <nav style={{
        width: mob ? 260 : 190, background: C.surface,
        borderRight: `1px solid ${C.border}`,
        padding: mob ? "68px 12px 20px" : "20px 12px",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300,
        transform: mob && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
        transition: "transform 0.3s ease",
      }}>
        {!mob && (
          <div style={{ padding: "8px 16px 24px", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
            <button onClick={goHome} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700,
              color: C.accent, letterSpacing: 2, padding: 0, textAlign: "left",
              transition: "opacity 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >APMEW</button>
            <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginTop: 4 }}>{todayStr()}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {navItems.map(item => (
            <NavItem key={item.id} {...item} active={page === item.id} onClick={() => handleNav(item.id)} />
          ))}
        </div>

        <div style={{ padding: "14px 16px", background: C.surface2, borderRadius: 10, marginTop: 16 }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Conectado</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.green }}>Supabase</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.blue }}>Google Drive</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: mob ? 0 : 190, flex: 1, padding: mob ? "72px 16px 24px" : "32px 40px", maxWidth: 1200, width: "100%" }}>
        {renderPage()}
      </main>
    </div>
  );
}
