// ═══════════════════════════════════════════
// Archivo: src/App.jsx
// Versión: 3
// Fecha: 2026-03-04
// Cambios: Integración Supabase Auth (Google OAuth)
//   - Pantalla de login unificada: autentica Supabase + Drive en un clic
//   - App no carga datos hasta que hay sesión válida
//   - Botón de logout en el sidebar
// ═══════════════════════════════════════════

import { useState, useEffect, useCallback, lazy, Suspense } from "react";

// ─── Lib ───
import { C, baseStyles } from "./lib/theme";
import { fmt, useIsMobile } from "./lib/helpers";
import { I } from "./lib/icons";
import { supabase, supaFetch, supaUpdate, supaInsert } from "./lib/supabase";
import { useGoogleDrive } from "./lib/useGoogleDrive";

// ─── Components ───
import { Loading, NavItem } from "./components/UI";
import { useToast } from "./components/Toast";

// ─── Pages: lazy-loaded ───
const DashboardPage     = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const DailyExpensesPage = lazy(() => import("./pages/DailyExpensesPage").then(m => ({ default: m.DailyExpensesPage })));
const DocumentsPage     = lazy(() => import("./pages/DocumentsPage").then(m => ({ default: m.DocumentsPage })));
const InspectionsPage   = lazy(() => import("./pages/InspectionsPage").then(m => ({ default: m.InspectionsPage })));
const ExpensesPage      = lazy(() => import("./pages/ExpensesPage").then(m => ({ default: m.ExpensesPage })));
const PatrimonyPage     = lazy(() => import("./pages/PatrimonyPage").then(m => ({ default: m.PatrimonyPage })));

// ─── Pages: ligeras ───
import { CrudPage }       from "./pages/CrudPage";
import { ChecklistPage }  from "./pages/ChecklistPage";
import { ProjectionPage } from "./pages/ProjectionPage";

// ─── Date helper ───
const todayStr = () => {
  const d = new Date();
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [page, setPage]               = useState("dashboard");
  const [loading, setLoading]         = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashKey, setDashKey]         = useState(0);
  const [session, setSession]         = useState(undefined); // undefined = cargando, null = sin sesión
  const [authLoading, setAuthLoading] = useState(false);

  const mob   = useIsMobile();
  const drive = useGoogleDrive();
  const toast = useToast();

  const [data, setData] = useState({
    profiles: [], assumptions: [], income: [], retIncome: [],
    expenses: [], expenseCategories: [], assets: [], debts: [],
    checklist: [], documents: [], dailyExpenses: [],
  });

  // ─── Auth: escuchar cambios de sesión ───────────────────────────────────
  useEffect(() => {
    // Sesión inicial (persistida en localStorage por el SDK)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // Escuchar cambios futuros (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Login con Google via Supabase Auth ──────────────────────────────────
  const handleSignIn = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Redirige de vuelta a la app tras el login
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error("Error al iniciar sesión con Google");
      setAuthLoading(false);
    }
    // Si no hay error, el navegador redirige → no hace falta setAuthLoading(false)
  };

  // ─── Logout ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    drive.signOut?.();
    setData({ profiles: [], assumptions: [], income: [], retIncome: [], expenses: [], expenseCategories: [], assets: [], debts: [], checklist: [], documents: [], dailyExpenses: [] });
    setPage("dashboard");
  };

  // ─── Carga inicial de datos (solo cuando hay sesión) ─────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        profiles, assumptions, income, retIncome,
        expenses, expenseCategories, assets, debts,
        checklist, documents, dailyExpenses,
      ] = await Promise.all([
        supaFetch("profiles",             { order: "name" }),
        supaFetch("financial_assumptions", { order: "key" }),
        supaFetch("current_income",       { order: "sort_order" }),
        supaFetch("retirement_income",    { order: "sort_order" }),
        supaFetch("retirement_expenses",  { order: "sort_order" }),
        supaFetch("expense_categories",   { order: "sort_order" }),
        supaFetch("assets",              { order: "sort_order" }),
        supaFetch("debts",               { order: "sort_order" }),
        supaFetch("checklist_items",     { order: "sort_order" }),
        supaFetch("documents",           { order: "folder_path,title" }),
        supaFetch("daily_expenses",      { order: "expense_date.desc,created_at.desc", limit: 10000 }),
      ]);
      setData({ profiles, assumptions, income, retIncome, expenses, expenseCategories, assets, debts, checklist, documents, dailyExpenses });
    } catch (err) {
      console.error("Error cargando datos:", err);
      toast.error("Error cargando datos de Supabase. Revisa tu conexión.");
    }
    setLoading(false);
  }, []);

  // Cargar datos solo cuando hay sesión activa
  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  // ─── Recargas selectivas ──────────────────────────────────────────────────
  const reloadTable = useCallback(async (key, table, options) => {
    try {
      const rows = await supaFetch(table, options);
      setData(prev => ({ ...prev, [key]: rows }));
    } catch (err) {
      console.error(`Error recargando ${table}:`, err);
      toast.error(`Error recargando ${table}`);
    }
  }, []);

  const reloadChecklist     = () => reloadTable("checklist",     "checklist_items",     { order: "sort_order" });
  const reloadDailyExpenses = () => reloadTable("dailyExpenses", "daily_expenses",      { order: "expense_date.desc,created_at.desc", limit: 10000 });
  const reloadIncome        = () => reloadTable("income",        "current_income",      { order: "sort_order" });
  const reloadRetIncome     = () => reloadTable("retIncome",     "retirement_income",   { order: "sort_order" });
  const reloadExpenses      = () => reloadTable("expenses",      "retirement_expenses", { order: "sort_order" });
  const reloadAssets        = () => reloadTable("assets",        "assets",              { order: "sort_order" });
  const reloadDebts         = () => reloadTable("debts",         "debts",               { order: "sort_order" });
  const reloadDocuments     = () => reloadTable("documents",     "documents",           { order: "folder_path,title" });
  const reloadPatrimony     = () => Promise.all([reloadAssets(), reloadDebts()]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const toggleChecklist = async (item) => {
    try {
      await supaUpdate("checklist_items", item.id, {
        is_completed: !item.is_completed,
        completed_date: !item.is_completed ? new Date().toISOString().split("T")[0] : null,
      });
      reloadChecklist();
    } catch (err) {
      toast.error("Error actualizando checklist");
    }
  };

  const addDailyExpense = async (expense) => {
    try {
      await supaInsert("daily_expenses", expense);
      reloadDailyExpenses();
      toast.success("Gasto guardado");
    } catch (err) {
      toast.error("Error guardando gasto");
    }
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  const navItems = [
    { id: "income",      label: "Ingresos Actuales",  icon: I.income },
    { id: "retIncome",   label: "Ingresos Retiro",    icon: I.income },
    { id: "expenses",    label: "Gastos Retiro",       icon: I.expenses },
    { id: "patrimony",   label: "Patrimonio",          icon: I.patrimony },
    { id: "projection",  label: "Proyección 30 Años",  icon: I.projection },
    { id: "checklist",   label: "Checklist",            icon: I.checklist },
    { id: "daily",       label: "Gastos Diarios",      icon: I.daily },
    { id: "docs",        label: "Documentos",           icon: I.docs },
    { id: "inspections", label: "Inspecciones",         icon: I.inspection },
  ];

  const goHome    = () => { setPage("dashboard"); setDashKey(k => k + 1); if (mob) setSidebarOpen(false); };
  const handleNav = (id) => { setPage(id); if (mob) setSidebarOpen(false); };

  // ─── Page Router ──────────────────────────────────────────────────────────
  const renderPage = () => {
    if (loading) return <Loading />;

    const content = (() => {
      switch (page) {
        case "dashboard":
          return (
            <DashboardPage
              key={dashKey} data={data} mob={mob} drive={drive}
              goToPage={(p) => { setPage(p); if (mob) setSidebarOpen(false); }}
            />
          );
        case "income":
          return (
            <CrudPage
              title="Ingresos Actuales" subtitle="Últimos ingresos antes de retirarse"
              table="current_income" items={data.income} mob={mob} reload={reloadIncome}
              totalLabel="TOTAL MENSUAL" totalKey="monthly_amount"
              columns={[
                { label: "Fuente", key: "source", bold: true },
                { label: "Monto Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
                { label: "Notas", key: "notes", color: () => C.textDim },
              ]}
              formFields={[
                { key: "source",         label: "Fuente de Ingreso" },
                { key: "monthly_amount", label: "Monto Mensual", type: "number" },
                { key: "notes",          label: "Notas" },
              ]}
              defaults={{ source: "", monthly_amount: 0, notes: "" }}
            />
          );
        case "retIncome":
          return (
            <CrudPage
              title="Ingresos en Retiro" subtitle="Fuentes de ingreso una vez retirados"
              table="retirement_income" items={data.retIncome} mob={mob} reload={reloadRetIncome}
              totalLabel="TOTAL MENSUAL" totalKey="monthly_amount"
              columns={[
                { label: "Fuente", key: "source", bold: true },
                { label: "Mensual", key: "monthly_amount", align: "right", mono: true, render: r => fmt(Number(r.monthly_amount)) },
                { label: "Anual", key: "annual_amount", align: "right", mono: true, render: r => r.annual_amount ? fmt(Number(r.annual_amount)) : "—" },
                { label: "Notas", key: "notes", color: () => C.textDim },
              ]}
              formFields={[
                { key: "source",         label: "Fuente de Ingreso" },
                { key: "monthly_amount", label: "Monto Mensual", type: "number" },
                { key: "annual_amount",  label: "Monto Anual",   type: "number" },
                { key: "notes",          label: "Notas" },
              ]}
              defaults={{ source: "", monthly_amount: 0, annual_amount: 0, notes: "" }}
            />
          );
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
          return (
            <DashboardPage
              key={dashKey} data={data} mob={mob} drive={drive}
              goToPage={(p) => { setPage(p); if (mob) setSidebarOpen(false); }}
            />
          );
      }
    })();

    return <Suspense fallback={<Loading />}>{content}</Suspense>;
  };

  // ─── ESTADO: cargando sesión inicial ──────────────────────────────────────
  if (session === undefined) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: C.bg, alignItems: "center", justifyContent: "center" }}>
        <style>{baseStyles}</style>
        <Loading />
      </div>
    );
  }

  // ─── ESTADO: sin sesión → pantalla de login ───────────────────────────────
  if (!session) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
        <style>{baseStyles}</style>
        <div style={{ margin: "auto", textAlign: "center", padding: 40, maxWidth: 400 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 32, fontWeight: 700, color: C.accent, letterSpacing: 3, marginBottom: 8 }}>APMEW</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginBottom: 40 }}>{todayStr()}</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "40px 32px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Iniciar sesión</h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 28, lineHeight: 1.5 }}>
              Acceso restringido a miembros de la familia.
            </p>
            <button
              onClick={handleSignIn}
              disabled={authLoading}
              style={{
                fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
                color: "#fff", background: C.accent,
                border: "none", borderRadius: 10, padding: "12px 32px",
                cursor: authLoading ? "default" : "pointer",
                opacity: authLoading ? 0.6 : 1,
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {authLoading ? "Redirigiendo..." : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ESTADO: autenticado, pero Drive aún no conectado ─────────────────────
  if (!drive.token) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
        <style>{baseStyles}</style>
        <div style={{ margin: "auto", textAlign: "center", padding: 40, maxWidth: 400 }}>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: 32, fontWeight: 700, color: C.accent, letterSpacing: 3, marginBottom: 8 }}>APMEW</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textMuted, marginBottom: 40 }}>{todayStr()}</div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "40px 32px" }}>
            {/* Avatar del usuario autenticado */}
            {session.user?.user_metadata?.avatar_url && (
              <img
                src={session.user.user_metadata.avatar_url}
                alt="avatar"
                style={{ width: 48, height: 48, borderRadius: "50%", marginBottom: 16 }}
              />
            )}
            <div style={{ fontFamily: "DM Sans", fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>
              {session.user?.user_metadata?.full_name ?? session.user?.email}
            </div>
            <div style={{ fontFamily: "DM Sans", fontSize: 12, color: C.textMuted, marginBottom: 28 }}>
              ✓ Sesión activa
            </div>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
            <h2 style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Conectar Google Drive</h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: C.textDim, marginBottom: 28, lineHeight: 1.5 }}>
              Para ver documentos, fotos de inspecciones y archivos de las propiedades.
            </p>
            <button
              onClick={drive.signIn}
              disabled={!drive.gisLoaded}
              style={{
                fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
                color: "#fff", background: C.accent,
                border: "none", borderRadius: 10, padding: "12px 32px",
                cursor: drive.gisLoaded ? "pointer" : "default",
                opacity: drive.gisLoaded ? 1 : 0.5,
                width: "100%",
              }}
            >
              {drive.gisLoaded ? "🔗 Conectar Google Drive" : "Cargando..."}
            </button>
            <button
              onClick={handleSignOut}
              style={{
                fontFamily: "DM Sans", fontSize: 12, color: C.textDim,
                background: "none", border: "none", cursor: "pointer",
                marginTop: 16, textDecoration: "underline",
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Layout principal ──────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "DM Sans" }}>
      <style>{baseStyles}</style>

      {/* Mobile top bar */}
      {mob && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", height: 56,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 4, display: "flex" }}>
            {sidebarOpen ? I.close : I.menu}
          </button>
          <button onClick={goHome} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, color: C.accent, letterSpacing: 2 }}>
            APMEW
          </button>
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

        {/* Status + usuario + logout */}
        <div style={{ padding: "14px 16px", background: C.surface2, borderRadius: 10, marginTop: 16 }}>
          {/* Avatar y nombre */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
            {session.user?.user_metadata?.avatar_url
              ? <img src={session.user.user_metadata.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
              : <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>
                  {(session.user?.email?.[0] ?? "?").toUpperCase()}
                </div>
            }
            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {session.user?.user_metadata?.given_name ?? session.user?.email}
            </span>
          </div>

          {/* Estado de conexiones */}
          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Conectado</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.green }}>Supabase</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue }} />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.blue }}>Google Drive</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "DM Sans", fontSize: 11, color: C.textDim,
              background: "none", border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "5px 10px", cursor: "pointer",
              width: "100%", textAlign: "center",
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.textDim}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        marginLeft: mob ? 0 : 190, flex: 1,
        padding: mob ? "72px 16px 24px" : "32px 40px",
        maxWidth: 1200, width: "100%",
      }}>
        {renderPage()}
      </main>
    </div>
  );
}
