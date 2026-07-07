import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import GlobalStyles from "./GlobalStyles";
import { COLOR, FONT_DISPLAY, FONT_BODY, FONT_MONO, RADIUS, SHADOW, TRANSITION, DONUT_COLORS, inputStyle } from "./theme";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Receipt, Wallet, PieChart as PieChartIcon, Target,
  Plus, TrendingUp, Trash2, CreditCard, Pencil, Search, AlertTriangle,
  Sparkles, ArrowDownRight, ArrowUpRight, Download, Check, X, Calendar,
  LogOut, RotateCcw, ArrowRight, ShoppingCart, Bus, HeartPulse,
  Home, GraduationCap, Laptop2, Zap, Clapperboard, RefreshCw, PawPrint,
  Shirt, Plane, Landmark, MoreHorizontal,
} from "lucide-react";

// ---------- Constantes de dominio ----------
const CATEGORIAS = [
  "Alimentación", "Transporte", "Salud", "Vivienda", "Educación", "Tecnología",
  "Servicios", "Entretenimiento", "Suscripciones", "Mascotas", "Ropa", "Viajes",
  "Impuestos", "Inversiones", "Otros",
];

const TIPOS = ["Ingreso", "Gasto", "Transferencia", "Inversión", "Pago", "Venta"];
const TIPO_SIGNO_DEFAULT = { Ingreso: "entrada", Gasto: "salida", Transferencia: "salida", "Inversión": "salida", Pago: "salida", Venta: "entrada" };

const CUENTA_TIPOS = [
  { value: "liquido", label: "Líquido", icon: Wallet },
  { value: "inversion", label: "Inversión", icon: TrendingUp },
  { value: "deuda", label: "Deuda", icon: CreditCard },
];

// Mapa puramente presentacional: icono por categoría para dar identidad visual
// a movimientos y desgloses. No participa en ningún cálculo.
const CATEGORIA_ICONOS = {
  "Alimentación": ShoppingCart,
  "Transporte": Bus,
  "Salud": HeartPulse,
  "Vivienda": Home,
  "Educación": GraduationCap,
  "Tecnología": Laptop2,
  "Servicios": Zap,
  "Entretenimiento": Clapperboard,
  "Suscripciones": RefreshCw,
  "Mascotas": PawPrint,
  "Ropa": Shirt,
  "Viajes": Plane,
  "Impuestos": Landmark,
  "Inversiones": TrendingUp,
  "Otros": MoreHorizontal,
};
function iconoCategoria(categoria) {
  return CATEGORIA_ICONOS[categoria] || MoreHorizontal;
}

const fmtCOP = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
const monthKey = (dateStr) => (dateStr || "").slice(0, 7);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- Derived data helpers ----------
function saldoCuenta(cuentaId, movimientos) {
  return movimientos.filter((m) => m.cuenta === cuentaId)
    .reduce((acc, m) => acc + (m.signo === "entrada" ? m.monto : -m.monto), 0);
}

function totalesPatrimonio(cuentas, movimientos) {
  let liquido = 0, inversion = 0, deuda = 0;
  cuentas.forEach((c) => {
    const s = saldoCuenta(c.id, movimientos);
    if (c.tipo === "liquido") liquido += s;
    else if (c.tipo === "inversion") inversion += s;
    else if (c.tipo === "deuda") deuda += s;
  });
  return { liquido, inversion, deuda, patrimonio: liquido + inversion - deuda };
}

function serieMensual(cuentas, movimientos, mesesAtras = 6) {
  const now = new Date();
  const meses = [];
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
      y: d.getFullYear(), m: d.getMonth(),
    });
  }
  return meses.map((mes) => {
    const monthEnd = new Date(mes.y, mes.m + 1, 0, 23, 59, 59);
    const upTo = movimientos.filter((mv) => new Date(mv.fecha) <= monthEnd);
    const { patrimonio } = totalesPatrimonio(cuentas, upTo);
    const ingresos = movimientos.filter((mv) => monthKey(mv.fecha) === mes.key && mv.tipo === "Ingreso" && mv.signo === "entrada").reduce((a, mv) => a + mv.monto, 0);
    const gastos = movimientos.filter((mv) => monthKey(mv.fecha) === mes.key && mv.tipo === "Gasto" && mv.signo === "salida").reduce((a, mv) => a + mv.monto, 0);
    return { mes: mes.label, patrimonio, ingresos, gastos };
  });
}

function rangoPeriodo(periodo) {
  const now = new Date();
  let start;
  if (periodo === "mes") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (periodo === "trimestre") start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  else if (periodo === "semestre") start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  else start = new Date(now.getFullYear(), 0, 1);
  return { start, end: now };
}

function desgloseCategorias(movimientos, periodo) {
  const { start, end } = rangoPeriodo(periodo);
  const gastos = movimientos.filter((mv) => mv.tipo === "Gasto" && mv.signo === "salida" && new Date(mv.fecha) >= start && new Date(mv.fecha) <= end);
  const byCat = {};
  gastos.forEach((mv) => { byCat[mv.categoria] = (byCat[mv.categoria] || 0) + mv.monto; });
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return Object.entries(byCat).map(([categoria, monto]) => ({ categoria, monto, pct: total ? (monto / total) * 100 : 0 })).sort((a, b) => b.monto - a.monto);
}

function gastadoMesCategoria(categoria, movimientos) {
  const { start, end } = rangoPeriodo("mes");
  return movimientos.filter((mv) => mv.tipo === "Gasto" && mv.signo === "salida" && mv.categoria === categoria && new Date(mv.fecha) >= start && new Date(mv.fecha) <= end)
    .reduce((a, mv) => a + mv.monto, 0);
}

function descargarCSV(filename, rows) {
  const escape = (val) => {
    const s = String(val ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((row) => row.map(escape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// UI atoms — vocabulario visual compartido por toda la aplicación
// ============================================================================

// Tarjeta base. variant="flat" quita la sombra/elevación para usos anidados
// (filas dentro de otra tarjeta); variant="hero" agrega el tratamiento de
// mayor jerarquía reservado para el patrimonio neto.
function Card({ children, style, className = "", variant = "default", hoverable = false }) {
  const base = {
    default: {
      background: COLOR.surface,
      border: `1px solid ${COLOR.hairline}`,
      boxShadow: SHADOW.md,
      borderRadius: RADIUS.xl,
    },
    flat: {
      background: COLOR.surfaceAlt,
      border: `1px solid ${COLOR.hairline}`,
      boxShadow: "none",
      borderRadius: RADIUS.lg,
    },
    hero: {
      background: `linear-gradient(165deg, ${COLOR.surfaceRaised} 0%, ${COLOR.surface} 55%)`,
      border: `1px solid ${COLOR.hairline}`,
      boxShadow: SHADOW.lg,
      borderRadius: RADIUS.xxl,
    },
  }[variant];

  return (
    <div
      className={`${hoverable ? "raiz-lift" : ""} p-5 ${className}`}
      style={{ ...base, ...style }}
    >
      {children}
    </div>
  );
}

// Pestaña de navegación superior con estado activo e indicador suave
function Pill({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="raiz-press flex items-center gap-2 py-2 px-3.5 text-sm whitespace-nowrap rounded-full"
      style={{
        color: active ? COLOR.onAccent : COLOR.textSecondary,
        background: active ? COLOR.peri : "transparent",
        fontFamily: FONT_BODY,
        fontWeight: active ? 600 : 500,
        boxShadow: active ? SHADOW.glowPeri : "none",
        transition: `background ${TRANSITION.base}, color ${TRANSITION.base}, box-shadow ${TRANSITION.base}`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = COLOR.surfaceRaised; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={14} strokeWidth={1.9} />
      {label}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" style={{ fontFamily: FONT_BODY }}>
      <span style={{ color: COLOR.textMuted, fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
      {children}
      {hint && <span style={{ color: COLOR.textMuted, fontSize: 11.5 }}>{hint}</span>}
    </label>
  );
}

function ProgressBar({ pct, color }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{ height: 7, borderRadius: RADIUS.full, background: COLOR.surfaceAlt, overflow: "hidden" }}>
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          borderRadius: RADIUS.full,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          transition: `width 420ms ${TRANSITION.base.split(" ")[1] || "ease"}`,
        }}
      />
    </div>
  );
}

// Icon-button con paso de confirmación integrado ("clic de nuevo para
// confirmar"), usado en toda acción destructiva sin recurrir a un modal.
function ConfirmIconButton({ onConfirm, icon: Icon, confirmIcon: ConfirmIcon = Check, title, className = "", size = 14 }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleClick(e) {
    e.stopPropagation();
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 2500);
    } else {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
    }
  }

  return (
    <button
      onClick={handleClick}
      title={armed ? "Clic de nuevo para confirmar" : title}
      className={`raiz-press ${className}`}
      style={{
        color: armed ? COLOR.coral : COLOR.textMuted,
        animation: armed ? "raizPulseRing 1.1s ease-out infinite" : "none",
        borderRadius: RADIUS.full,
        padding: 4,
      }}
    >
      {armed ? <ConfirmIcon size={size} /> : <Icon size={size} />}
    </button>
  );
}

// Insignia circular de icono — unidad visual reutilizada en KPIs, cuentas y
// filas de movimientos para dar identidad de color/categoría de un vistazo.
function IconBadge({ icon: Icon, color, soft, size = 34, iconSize = 15 }) {
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: RADIUS.md, background: soft, color }}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </div>
  );
}

// Botón primario — misma superficie de acento en cada formulario y CTA de la
// app (fondo peri + glow). Antes se repetía como objeto de estilo inline en
// ~8 lugares distintos; ahora vive en un único componente.
function PrimaryButton({ children, onClick, disabled = false, type = "button", className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`raiz-press flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium px-4 py-2.5 ${className}`}
      style={{
        background: disabled ? COLOR.surfaceAlt : COLOR.peri,
        color: disabled ? COLOR.textMuted : COLOR.onAccent,
        boxShadow: disabled ? "none" : SHADOW.glowPeri,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Botón fantasma — cancelar / descartar, usado en todos los formularios
function GhostButton({ children, onClick, className = "" }) {
  return (
    <button onClick={onClick} className={`raiz-press px-4 py-2.5 rounded-lg text-sm ${className}`} style={{ color: COLOR.textMuted }}>
      {children}
    </button>
  );
}

// Chip con borde — acciones secundarias (exportar, alternar filtros)
function OutlineButton({ children, onClick, active = false, disabled = false, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`raiz-press flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${className}`}
      style={{
        border: `1px solid ${active ? COLOR.periBorder : COLOR.hairline}`,
        background: active ? COLOR.periSoft : "transparent",
        color: disabled ? COLOR.textMuted : active ? COLOR.peri : COLOR.textPrimary,
      }}
    >
      {children}
    </button>
  );
}

// Encabezado de sección reutilizado por las tarjetas de contenido (título +
// acción opcional a la derecha), para que todo bloque de la app comparta el
// mismo ritmo tipográfico.
function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div style={{ fontSize: 14.5, fontWeight: 600, color: COLOR.textPrimary, letterSpacing: -0.1 }}>{title}</div>
      {action}
    </div>
  );
}

// Overlay modal ligero: envuelve formularios existentes (Cuenta, Movimiento)
// sin introducir estado nuevo — sigue controlado por el mismo booleano
// showForm/onCancel que ya manejaba cada pantalla.
function Modal({ onClose, children, maxWidth = 480 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      style={{ background: COLOR.scrim, backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full animate-scale-in my-8 sm:my-0" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

// Tooltip de gráficos compartido por Area/Bar/Pie — tipografía y color
// consistentes en lugar del contentStyle inline repetido en cada gráfico.
function ChartTooltip({ active, payload, label, formatter = fmtCOP }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: COLOR.surfaceRaised,
        border: `1px solid ${COLOR.hairlineStrong}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.lg,
        padding: "10px 12px",
        fontFamily: FONT_BODY,
        minWidth: 120,
      }}
    >
      {label && <div style={{ fontSize: 11, color: COLOR.textMuted, marginBottom: 6, textTransform: "capitalize" }}>{label}</div>}
      <div className="flex flex-col gap-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5" style={{ color: COLOR.textSecondary }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: p.color || p.fill, display: "inline-block" }} />
              {p.name}
            </span>
            <span style={{ fontFamily: FONT_MONO, color: COLOR.textPrimary }}>{formatter(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- App principal (una vez autenticado) ----------
function FinanzasApp({ user, onSignOut }) {
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [metas, setMetas] = useState([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [showCuentaForm, setShowCuentaForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [periodo, setPeriodo] = useState("mes");
  const loadedOnce = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("raiz_data")
          .select("payload")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (data && data.payload) {
          const parsed = data.payload;
          setCuentas(parsed.cuentas || []);
          setMovimientos(parsed.movimientos || []);
          setPresupuestos(parsed.presupuestos || []);
          setMetas(parsed.metas || []);
        } else {
          // Primera vez de este usuario: crea la fila vacía
          await supabase.from("raiz_data").upsert({ user_id: user.id, payload: {} });
        }
      } catch (e) { console.error("Error cargando datos de Supabase", e); }
      loadedOnce.current = true;
      setReady(true);
    })();
  }, [user.id]);

  useEffect(() => {
    if (!loadedOnce.current) return;
    const timeout = setTimeout(async () => {
      try {
        const { error } = await supabase.from("raiz_data").upsert({
          user_id: user.id,
          payload: { cuentas, movimientos, presupuestos, metas },
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      } catch (e) { console.error("Error guardando datos en Supabase", e); }
    }, 500); // pequeño debounce para no golpear la base en cada tecla
    return () => clearTimeout(timeout);
  }, [cuentas, movimientos, presupuestos, metas, user.id]);

  const totales = useMemo(() => totalesPatrimonio(cuentas, movimientos), [cuentas, movimientos]);
  const serie = useMemo(() => serieMensual(cuentas, movimientos, 6), [cuentas, movimientos]);
  const catBreak = useMemo(() => desgloseCategorias(movimientos, periodo), [movimientos, periodo]);
  const alertas = useMemo(() => presupuestos.map((p) => ({ ...p, gastado: gastadoMesCategoria(p.categoria, movimientos) })).filter((p) => p.gastado > p.limiteMensual), [presupuestos, movimientos]);

  const patrimonioAnterior = serie.length > 1 ? serie[serie.length - 2].patrimonio : totales.patrimonio;
  const deltaPct = patrimonioAnterior ? ((totales.patrimonio - patrimonioAnterior) / Math.abs(patrimonioAnterior)) * 100 : 0;

  const mesActual = serie[serie.length - 1] || { ingresos: 0, gastos: 0 };
  const ahorroPct = mesActual.ingresos ? ((mesActual.ingresos - mesActual.gastos) / mesActual.ingresos) * 100 : 0;

  function agregarCuenta({ nombre, tipo, saldoInicial }) {
    const cuenta = { id: uid(), nombre, tipo };
    const nuevosMov = [];
    if (saldoInicial && Number(saldoInicial) !== 0) {
      nuevosMov.push({
        id: uid(), fecha: todayStr(), cuenta: cuenta.id,
        tipo: "Ingreso", signo: "entrada", monto: Math.abs(Number(saldoInicial)),
        categoria: "Otros", descripcion: "Saldo inicial", estado: "Completado",
      });
    }
    setCuentas((prev) => [...prev, cuenta]);
    if (nuevosMov.length) setMovimientos((prev) => [...prev, ...nuevosMov]);
    setShowCuentaForm(false);
  }

  function eliminarCuenta(id) {
    setCuentas((prev) => prev.filter((c) => c.id !== id));
    setMovimientos((prev) => prev.filter((m) => m.cuenta !== id));
    setMetas((prev) => prev.filter((m) => m.cuentaId !== id));
    if (filtroCuenta === id) setFiltroCuenta("todas");
  }

  function agregarMovimiento(mov) {
    setMovimientos((prev) => [...prev, { id: uid(), ...mov }]);
  }

  function actualizarMovimiento(id, data) {
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  }

  function eliminarMovimiento(id) {
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
  }

  function agregarPresupuesto({ categoria, limiteMensual }) {
    setPresupuestos((prev) => {
      const existe = prev.find((p) => p.categoria === categoria);
      if (existe) return prev.map((p) => (p.categoria === categoria ? { ...p, limiteMensual } : p));
      return [...prev, { id: uid(), categoria, limiteMensual }];
    });
  }

  function eliminarPresupuesto(id) {
    setPresupuestos((prev) => prev.filter((p) => p.id !== id));
  }

  function agregarMeta(meta) {
    setMetas((prev) => [...prev, { id: uid(), ...meta }]);
  }

  function eliminarMeta(id) {
    setMetas((prev) => prev.filter((m) => m.id !== id));
  }

  if (!ready) {
    return (
      <div style={{ background: COLOR.bg, minHeight: 480 }} className="flex items-center justify-center">
        <GlobalStyles />
        <span style={{ color: COLOR.textMuted, fontFamily: FONT_BODY, fontSize: 13.5 }} className="animate-fade-in">Cargando…</span>
      </div>
    );
  }

  const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "movimientos", label: "Movimientos", icon: Receipt },
    { id: "cuentas", label: "Cuentas", icon: Wallet },
    { id: "metas", label: "Metas", icon: Target },
    { id: "reportes", label: "Reportes", icon: PieChartIcon },
  ];

  return (
    <div
      style={{
        background: `
          radial-gradient(1400px 560px at 50% -12%, ${COLOR.meshPeri}, transparent 60%),
          radial-gradient(900px 480px at 100% 0%, ${COLOR.meshMint}, transparent 55%),
          ${COLOR.bg}
        `,
        minHeight: 480, fontFamily: FONT_BODY, color: COLOR.textPrimary,
      }}
      className="w-full"
    >
      <GlobalStyles />

      {/* ---------- Barra de navegación: glass, sticky, estados activos ---------- */}
      <header className="sticky top-0 z-30" style={{ backdropFilter: "blur(18px) saturate(160%)", WebkitBackdropFilter: "blur(18px) saturate(160%)", background: COLOR.glassNav, borderBottom: `1px solid ${COLOR.hairline}` }}>
        <div className="max-w-app mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: RADIUS.md, background: COLOR.periSoft, border: `1px solid ${COLOR.periBorder}` }}>
              <Sparkles size={13} strokeWidth={2} color={COLOR.peri} />
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontStyle: "italic", letterSpacing: 0.2 }}>Ledger</div>
          </div>

          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full overflow-x-auto" style={{ background: COLOR.surface, border: `1px solid ${COLOR.hairline}` }}>
            {NAV_ITEMS.map((item) => (
              <Pill key={item.id} active={tab === item.id} onClick={() => setTab(item.id)} icon={item.icon} label={item.label} />
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <ConfirmIconButtonText
              onConfirm={async () => {
                setCuentas([]); setMovimientos([]); setPresupuestos([]); setMetas([]);
                try {
                  await supabase.from("raiz_data").upsert({ user_id: user.id, payload: {} });
                } catch (e) { console.error(e); }
              }}
            />
            <div style={{ width: 1, height: 18, background: COLOR.hairlineStrong }} className="hidden sm:block" />
            <button onClick={onSignOut} className="raiz-press flex items-center gap-1.5 text-xs" style={{ color: COLOR.textMuted }}>
              <LogOut size={13} strokeWidth={1.9} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Nav móvil: misma pastilla, scroll horizontal */}
        <div className="md:hidden px-5 pb-3 -mt-1">
          <div className="flex gap-1 overflow-x-auto raiz-scrollbar-x p-1 rounded-full w-fit" style={{ background: COLOR.surface, border: `1px solid ${COLOR.hairline}` }}>
            {NAV_ITEMS.map((item) => (
              <Pill key={item.id} active={tab === item.id} onClick={() => setTab(item.id)} icon={item.icon} label={item.label} />
            ))}
          </div>
        </div>
      </header>

      {/* ---------- Contenido, ancho máximo 1440px ---------- */}
      <main className="max-w-app mx-auto w-full px-5 lg:px-10 py-7 lg:py-9">
        <div key={tab} className="animate-fade-in">
          {tab === "dashboard" && (
            <Dashboard cuentas={cuentas} totales={totales} serie={serie} catBreak={catBreak} deltaPct={deltaPct}
              ahorroPct={ahorroPct} mesActual={mesActual} alertas={alertas}
              onIrCuentas={() => setTab("cuentas")} onIrMovs={() => setTab("movimientos")} onIrMetas={() => setTab("metas")} />
          )}
          {tab === "movimientos" && (
            <Movimientos cuentas={cuentas} movimientos={movimientos} presupuestos={presupuestos}
              filtroCuenta={filtroCuenta} setFiltroCuenta={setFiltroCuenta}
              showForm={showMovForm} setShowForm={setShowMovForm}
              onAgregar={agregarMovimiento} onEditar={actualizarMovimiento} onEliminar={eliminarMovimiento} />
          )}
          {tab === "cuentas" && (
            <Cuentas cuentas={cuentas} movimientos={movimientos} showForm={showCuentaForm} setShowForm={setShowCuentaForm}
              onAgregar={agregarCuenta} onEliminar={eliminarCuenta} />
          )}
          {tab === "metas" && (
            <Metas cuentas={cuentas} movimientos={movimientos} presupuestos={presupuestos} metas={metas}
              onAgregarPresupuesto={agregarPresupuesto} onEliminarPresupuesto={eliminarPresupuesto}
              onAgregarMeta={agregarMeta} onEliminarMeta={eliminarMeta} />
          )}
          {tab === "reportes" && (
            <Reportes cuentas={cuentas} movimientos={movimientos} serie={serie} catBreak={catBreak} periodo={periodo} setPeriodo={setPeriodo} />
          )}
        </div>
      </main>
    </div>
  );
}

// Control de confirmación textual usado solo en la acción "Restablecer" del header.
function ConfirmIconButtonText({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (armed) {
    return (
      <div className="flex items-center gap-2 animate-fade-in">
        <button onClick={() => { clearTimeout(timer.current); setArmed(false); }} className="raiz-press text-xs" style={{ color: COLOR.textMuted }}>Cancelar</button>
        <button
          onClick={() => { clearTimeout(timer.current); setArmed(false); onConfirm(); }}
          className="raiz-press text-xs px-3 py-1.5 rounded-lg"
          style={{ background: COLOR.coralSoft, color: COLOR.coral, border: `1px solid ${COLOR.coralBorder}` }}
        >
          ¿Seguro? Borrar todo
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => { setArmed(true); timer.current = setTimeout(() => setArmed(false), 4000); }}
      className="raiz-press flex items-center gap-1.5 text-xs"
      style={{ color: COLOR.textMuted }}
    >
      <RotateCcw size={12.5} strokeWidth={1.9} />
      <span className="hidden lg:inline">Restablecer</span>
    </button>
  );
}

// ============================================================================
// Dashboard — Hero de patrimonio (elemento dominante) + KPIs + gráficos
// ============================================================================
function Dashboard({ cuentas, totales, serie, catBreak, deltaPct, ahorroPct, mesActual, alertas, onIrCuentas, onIrMovs, onIrMetas }) {
  if (cuentas.length === 0) {
    return (
      <Card variant="hero" className="text-center py-14 px-6">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: RADIUS.xl, background: COLOR.periSoft, border: `1px solid ${COLOR.periBorder}` }}>
            <Sparkles size={22} color={COLOR.peri} strokeWidth={1.8} />
          </div>
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontStyle: "italic" }}>Tu panorama financiero empieza aquí</div>
        <p style={{ color: COLOR.textMuted, fontSize: 14, marginTop: 10, maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          Ledger no guarda saldos: calcula todo a partir de tus movimientos. Empieza agregando la primera cuenta donde vive tu dinero.
        </p>
        <PrimaryButton onClick={onIrCuentas} className="!inline-flex !rounded-xl !px-5 mt-6">
          Agregar primera cuenta <ArrowRight size={15} />
        </PrimaryButton>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {alertas.length > 0 && (
        <button onClick={onIrMetas} className="raiz-press flex items-center gap-2.5 px-4 py-3 rounded-xl text-left text-sm"
          style={{ background: COLOR.coralSoft, border: `1px solid ${COLOR.coralBorder}`, color: COLOR.coral }}>
          <AlertTriangle size={16} className="shrink-0" />
          {alertas.length} presupuesto{alertas.length > 1 ? "s" : ""} superado{alertas.length > 1 ? "s" : ""} este mes — revisar
          <ArrowRight size={14} className="ml-auto shrink-0" />
        </button>
      )}

      {/* ---------- Hero: patrimonio neto, el elemento dominante ---------- */}
      <Card variant="hero" className="!p-6 lg:!p-9 relative overflow-hidden">
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `radial-gradient(520px 220px at 88% -10%, ${deltaPct >= 0 ? COLOR.meshMint : COLOR.meshCoral}, transparent 65%)`,
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
            <div style={{ color: COLOR.textMuted, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 600 }}>Patrimonio neto</div>
            <div className="flex items-end gap-3 mt-2 flex-wrap">
              <div className="tabular-nums" style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(34px, 5vw, 56px)", fontWeight: 500, letterSpacing: -0.5, lineHeight: 1 }}>
                {fmtCOP(totales.patrimonio)}
              </div>
              {serie.length > 1 && (
                <div className="flex items-center gap-1 mb-1.5 text-xs font-medium px-2 py-1 rounded-full"
                  style={{ color: deltaPct >= 0 ? COLOR.mint : COLOR.coral, background: deltaPct >= 0 ? COLOR.mintSoft : COLOR.coralSoft }}>
                  {deltaPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {Math.abs(deltaPct).toFixed(1)}% vs. mes pasado
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5 lg:gap-6 shrink-0">
            <div>
              <div style={{ color: COLOR.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Disponible</div>
              <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 15, marginTop: 3, color: COLOR.textSecondary }}>{fmtCOP(totales.liquido)}</div>
            </div>
            <div style={{ width: 1, height: 28, background: COLOR.hairlineStrong }} />
            <div>
              <div style={{ color: COLOR.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Invertido</div>
              <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 15, marginTop: 3, color: COLOR.textSecondary }}>{fmtCOP(totales.inversion)}</div>
            </div>
            {totales.deuda > 0 && (
              <>
                <div style={{ width: 1, height: 28, background: COLOR.hairlineStrong }} />
                <div>
                  <div style={{ color: COLOR.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Deuda</div>
                  <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 15, marginTop: 3, color: COLOR.coral }}>{fmtCOP(totales.deuda)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative" style={{ height: 120, marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="patrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.mint} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={COLOR.mint} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: COLOR.textMuted, fontSize: 11.5, fontFamily: FONT_BODY }} axisLine={false} tickLine={false} />
              <Area type="monotone" dataKey="patrimonio" stroke={COLOR.mint} strokeWidth={2.25} fill="url(#patrGrad)" activeDot={{ r: 4, strokeWidth: 0 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLOR.hairlineStrong, strokeWidth: 1 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ---------- KPIs secundarios ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card hoverable className="!p-5">
          <div className="flex items-center justify-between">
            <IconBadge icon={Wallet} color={COLOR.peri} soft={COLOR.periSoft} />
            <span style={{ fontSize: 11, color: COLOR.textMuted }}>{cuentas.filter((c) => c.tipo === "liquido").length} cuenta{cuentas.filter((c) => c.tipo === "liquido").length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ color: COLOR.textMuted, fontSize: 12, marginTop: 14 }}>Disponible</div>
          <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 20, marginTop: 2, fontWeight: 500 }}>{fmtCOP(totales.liquido)}</div>
        </Card>

        <Card hoverable className="!p-5">
          <div className="flex items-center justify-between">
            <IconBadge icon={TrendingUp} color={COLOR.gold} soft={COLOR.goldSoft} />
            <span style={{ fontSize: 11, color: COLOR.textMuted }}>{cuentas.filter((c) => c.tipo === "inversion").length} cuenta{cuentas.filter((c) => c.tipo === "inversion").length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ color: COLOR.textMuted, fontSize: 12, marginTop: 14 }}>Invertido</div>
          <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 20, marginTop: 2, fontWeight: 500 }}>{fmtCOP(totales.inversion)}</div>
        </Card>

        <Card hoverable className="!p-5">
          <div className="flex items-center justify-between">
            <IconBadge icon={Sparkles} color={ahorroPct >= 0 ? COLOR.mint : COLOR.coral} soft={ahorroPct >= 0 ? COLOR.mintSoft : COLOR.coralSoft} />
            <span style={{ fontSize: 11, color: COLOR.textMuted }} className="tabular-nums">{fmtCOP(mesActual.ingresos - mesActual.gastos)}</span>
          </div>
          <div style={{ color: COLOR.textMuted, fontSize: 12, marginTop: 14 }}>Ahorro del mes</div>
          <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 20, marginTop: 2, fontWeight: 500, color: ahorroPct >= 0 ? COLOR.mint : COLOR.coral }}>{ahorroPct.toFixed(0)}%</div>
        </Card>
      </div>

      {/* ---------- Gráficos: ingresos/gastos + desglose por categoría ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <SectionHeader title="Ingresos vs. gastos · últimos 6 meses" />
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={6}>
                <CartesianGrid vertical={false} stroke={COLOR.hairline} strokeDasharray="3 5" />
                <XAxis dataKey="mes" tick={{ fill: COLOR.textMuted, fontSize: 11.5 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: COLOR.surfaceAlt }} />
                <Bar dataKey="ingresos" name="Ingresos" fill={COLOR.mint} radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Bar dataKey="gastos" name="Gastos" fill={COLOR.coral} radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Gastos por categoría · este mes" />
          {catBreak.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full py-6" style={{ color: COLOR.textMuted, fontSize: 13 }}>
              Sin gastos registrados este mes.
            </div>
          ) : <DonutBreakdown data={catBreak} compact />}
        </Card>
      </div>

      {mesActual.ingresos === 0 && mesActual.gastos === 0 && (
        <button onClick={onIrMovs} className="raiz-press flex items-center justify-center gap-1.5 text-sm self-center" style={{ color: COLOR.peri }}>
          Registra tu primer movimiento del mes <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function DonutBreakdown({ data, compact = false }) {
  return (
    <div className={`flex ${compact ? "flex-col" : "flex-row flex-wrap"} items-center gap-5`}>
      <div style={{ width: compact ? 140 : 120, height: compact ? 140 : 120, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="monto" nameKey="categoria" innerRadius={compact ? 44 : 38} outerRadius={compact ? 66 : 58} paddingAngle={3} stroke="none" cornerRadius={4}>
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-[160px] w-full flex flex-col gap-2">
        {data.slice(0, 6).map((d, i) => {
          const Icon = iconoCategoria(d.categoria);
          return (
            <div key={d.categoria} className="flex items-center justify-between text-xs gap-2">
              <span className="flex items-center gap-2 min-w-0" style={{ color: COLOR.textSecondary }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: DONUT_COLORS[i % DONUT_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                <Icon size={12.5} style={{ color: COLOR.textMuted, flexShrink: 0 }} />
                <span className="truncate">{d.categoria}</span>
              </span>
              <span style={{ fontFamily: FONT_MONO, color: COLOR.textPrimary, flexShrink: 0 }}>{d.pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Movimientos — filtros, tabla y formulario en modal
// ============================================================================
function Movimientos({ cuentas, movimientos, presupuestos, filtroCuenta, setFiltroCuenta, showForm, setShowForm, onAgregar, onEditar, onEliminar }) {
  const [busqueda, setBusqueda] = useState("");
  const [editingMov, setEditingMov] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  const filtrados = useMemo(() => {
    let list = filtroCuenta === "todas" ? movimientos : movimientos.filter((m) => m.cuenta === filtroCuenta);
    if (desde) list = list.filter((m) => m.fecha >= desde);
    if (hasta) list = list.filter((m) => m.fecha <= hasta);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      list = list.filter((m) => (m.descripcion || "").toLowerCase().includes(q) || (m.categoria || "").toLowerCase().includes(q) || (m.tipo || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, filtroCuenta, busqueda, desde, hasta]);

  const conSaldo = useMemo(() => {
    if (filtroCuenta === "todas") return null;
    const asc = [...movimientos].filter((m) => m.cuenta === filtroCuenta).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const map = {}; let running = 0;
    asc.forEach((m) => { running += m.signo === "entrada" ? m.monto : -m.monto; map[m.id] = running; });
    return map;
  }, [movimientos, filtroCuenta]);

  const totalFiltrado = useMemo(() => filtrados.reduce((a, m) => a + (m.signo === "entrada" ? m.monto : -m.monto), 0), [filtrados]);
  const hayFiltrosActivos = desde || hasta || busqueda.trim();

  // Antes: cada fila de la lista hacía cuentas.find(c => c.id === m.cuenta) ->
  // O(n_movimientos * n_cuentas) en cada render. Con un mapa por id queda en
  // O(n_movimientos + n_cuentas).
  const cuentaPorId = useMemo(() => {
    const map = {};
    cuentas.forEach((c) => { map[c.id] = c; });
    return map;
  }, [cuentas]);

  function abrirNuevo() { setEditingMov(null); setShowForm(true); }
  function abrirEditar(m) { setEditingMov(m); setShowForm(true); }
  function cerrarForm() { setEditingMov(null); setShowForm(false); }
  function guardar(data) {
    if (editingMov) onEditar(editingMov.id, data);
    else onAgregar(data);
    setEditingMov(null);
    setShowForm(false);
  }
  function limpiarFiltros() { setDesde(""); setHasta(""); setBusqueda(""); }

  function exportarCSV() {
    const header = ["Fecha", "Cuenta", "Tipo", "Movimiento", "Categoría", "Monto", "Descripción", "Estado"];
    const rows = filtrados.map((m) => {
      const cuenta = cuentas.find((c) => c.id === m.cuenta);
      return [m.fecha, cuenta?.nombre || "", m.tipo, m.signo === "entrada" ? "Entrada" : "Salida", m.categoria, m.monto, m.descripcion || "", m.estado];
    });
    descargarCSV(`raiz-movimientos-${todayStr()}.csv`, [header, ...rows]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)} className="text-sm rounded-lg px-3 py-2.5" style={inputStyle}>
          <option value="todas">Todas las cuentas</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 flex-1 min-w-[140px]" style={inputStyle}>
          <Search size={14} color={COLOR.textMuted} />
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: COLOR.textPrimary, fontFamily: FONT_BODY }} />
        </div>
        <OutlineButton onClick={() => setShowFiltros((s) => !s)} active={!!(desde || hasta)} className="!text-sm !px-3 !py-2.5">
          <Calendar size={14} strokeWidth={1.9} /> Fechas
        </OutlineButton>
        <PrimaryButton onClick={abrirNuevo} disabled={cuentas.length === 0}>
          <Plus size={14} strokeWidth={2} /> Nuevo
        </PrimaryButton>
      </div>

      {showFiltros && (
        <Card className="!p-4 animate-slide-up">
          <div className="flex items-end gap-3 flex-wrap">
            <Field label="Desde">
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Hasta">
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            {(desde || hasta) && (
              <button onClick={() => { setDesde(""); setHasta(""); }} className="raiz-press text-xs pb-2.5" style={{ color: COLOR.textMuted }}>Quitar rango</button>
            )}
          </div>
        </Card>
      )}

      {cuentas.length === 0 && (
        <Card><div style={{ color: COLOR.textMuted, fontSize: 14 }}>Primero crea una cuenta en la pestaña Cuentas para poder registrar movimientos.</div></Card>
      )}

      {showForm && (
        <Modal onClose={cerrarForm} maxWidth={560}>
          <MovForm cuentas={cuentas} presupuestos={presupuestos} movimientos={movimientos} initial={editingMov} onCancel={cerrarForm} onGuardar={guardar} />
        </Modal>
      )}

      {movimientos.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div style={{ fontSize: 12.5, color: COLOR.textMuted }}>
            {filtrados.length} movimiento{filtrados.length !== 1 ? "s" : ""}
            {hayFiltrosActivos && (
              <>
                {" · "}<span className="tabular-nums" style={{ fontFamily: FONT_MONO, color: totalFiltrado >= 0 ? COLOR.mint : COLOR.coral }}>{fmtCOP(totalFiltrado)}</span> neto
                {" · "}<button onClick={limpiarFiltros} className="raiz-press underline underline-offset-2" style={{ color: COLOR.peri }}>limpiar filtros</button>
              </>
            )}
          </div>
          <OutlineButton onClick={exportarCSV} disabled={filtrados.length === 0}>
            <Download size={12} strokeWidth={1.9} /> Exportar CSV
          </OutlineButton>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-8 text-center" style={{ color: COLOR.textMuted, fontSize: 14 }}>
            {hayFiltrosActivos ? "Sin resultados para este filtro." : "Aún no hay movimientos registrados."}
          </div>
        ) : (
          filtrados.map((m, i) => {
            const cuenta = cuentaPorId[m.cuenta];
            const positivo = m.signo === "entrada";
            const Icon = iconoCategoria(m.categoria);
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 group transition-colors"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${COLOR.hairline}` }}
                onMouseEnter={(e) => e.currentTarget.style.background = COLOR.surfaceAlt}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div className="flex items-center gap-3 min-w-0">
                  <IconBadge icon={Icon} color={positivo ? COLOR.mint : COLOR.textSecondary} soft={positivo ? COLOR.mintSoft : COLOR.surfaceAlt} size={32} iconSize={14} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate" style={{ fontSize: 13.5, color: COLOR.textPrimary }}>{m.descripcion || m.tipo}</span>
                    <span className="truncate" style={{ fontSize: 11.5, color: COLOR.textMuted }}>
                      {new Date(m.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · {cuenta?.nombre || "—"} · {m.categoria}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {conSaldo && <span className="hidden sm:inline tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLOR.textMuted }}>{fmtCOP(conSaldo[m.id])}</span>}
                  <span className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 13.5, fontWeight: 500, color: positivo ? COLOR.mint : COLOR.coral }}>
                    {positivo ? "+" : "−"}{fmtCOP(m.monto).replace("-", "")}
                  </span>
                  <button onClick={() => abrirEditar(m)} className="raiz-press opacity-0 group-hover:opacity-100" style={{ color: COLOR.textMuted }}>
                    <Pencil size={13} />
                  </button>
                  <ConfirmIconButton onConfirm={() => onEliminar(m.id)} icon={Trash2} className="opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function MovForm({ cuentas, presupuestos = [], movimientos = [], initial, onCancel, onGuardar }) {
  const [cuenta, setCuenta] = useState(initial?.cuenta || cuentas[0]?.id || "");
  const [tipo, setTipo] = useState(initial?.tipo || "Gasto");
  const [signo, setSigno] = useState(initial?.signo || TIPO_SIGNO_DEFAULT["Gasto"]);
  const [monto, setMonto] = useState(initial ? String(initial.monto) : "");
  const [categoria, setCategoria] = useState(initial?.categoria || "Otros");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");
  const [fecha, setFecha] = useState(initial?.fecha || todayStr());
  const [estado, setEstado] = useState(initial?.estado || "Completado");
  const [error, setError] = useState("");

  function handleTipo(t) { setTipo(t); setSigno(TIPO_SIGNO_DEFAULT[t]); }

  function submit() {
    if (!cuenta) return setError("Selecciona una cuenta.");
    if (!monto || Number(monto) <= 0) return setError("Ingresa un monto mayor a cero.");
    setError("");
    onGuardar({ fecha, cuenta, tipo, signo, monto: Number(monto), categoria, descripcion, estado });
  }

  const presupuesto = presupuestos.find((p) => p.categoria === categoria);
  const gastadoActual = presupuesto ? gastadoMesCategoria(categoria, movimientos) : 0;
  const gastadoConEste = tipo === "Gasto" && signo === "salida" && Number(monto) > 0 ? gastadoActual + Number(monto) : gastadoActual;

  return (
    <Card variant="hero" className="!p-6">
      <SectionHeader title={initial ? "Editar movimiento" : "Nuevo movimiento"} />
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Cuenta">
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => handleTipo(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Monto">
          <input type="number" min="0" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className="rounded-lg px-3 py-2.5 text-sm" style={{ ...inputStyle, fontFamily: FONT_MONO }} />
        </Field>
        <Field label="Movimiento">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLOR.hairline}` }}>
            <button onClick={() => setSigno("entrada")} className="raiz-press flex-1 py-2.5 text-sm" style={{ background: signo === "entrada" ? COLOR.mintSoft : "transparent", color: signo === "entrada" ? COLOR.mint : COLOR.textMuted, fontWeight: signo === "entrada" ? 600 : 400 }}>Entrada</button>
            <button onClick={() => setSigno("salida")} className="raiz-press flex-1 py-2.5 text-sm" style={{ background: signo === "salida" ? COLOR.coralSoft : "transparent", color: signo === "salida" ? COLOR.coral : COLOR.textMuted, fontWeight: signo === "salida" ? 600 : 400 }}>Salida</button>
          </div>
        </Field>
        <Field label="Categoría">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Mercado, salario…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            <option>Completado</option>
            <option>Pendiente</option>
          </select>
        </Field>
      </div>

      {tipo === "Gasto" && presupuesto && (
        <div className="flex items-center gap-1.5 mt-3.5 px-3 py-2 rounded-lg" style={{ fontSize: 11.5, color: gastadoConEste > presupuesto.limiteMensual ? COLOR.coral : COLOR.textMuted, background: gastadoConEste > presupuesto.limiteMensual ? COLOR.coralSoft : COLOR.surfaceAlt }}>
          {gastadoConEste > presupuesto.limiteMensual ? <AlertTriangle size={12.5} className="shrink-0" /> : null}
          {gastadoConEste > presupuesto.limiteMensual ? "Este movimiento supera" : "Llevarías"} {fmtCOP(gastadoConEste)} de {fmtCOP(presupuesto.limiteMensual)} en {categoria} este mes.
        </div>
      )}
      {error && <div className="flex items-center gap-1.5 mt-3.5" style={{ fontSize: 12, color: COLOR.coral }}><AlertTriangle size={12.5} />{error}</div>}

      <div className="flex justify-end gap-2 mt-5">
        <GhostButton onClick={onCancel}>Cancelar</GhostButton>
        <PrimaryButton onClick={submit}>{initial ? "Guardar cambios" : "Guardar movimiento"}</PrimaryButton>
      </div>
    </Card>
  );
}

// ============================================================================
// Cuentas
// ============================================================================
function Cuentas({ cuentas, movimientos, showForm, setShowForm, onAgregar, onEliminar }) {
  // Antes: cada tarjeta llamaba saldoCuenta(...) y movimientos.filter(...).length
  // por separado -> un recorrido completo de `movimientos` por cada cuenta, en
  // cada render (incluido con solo abrir/cerrar el modal). Con muchas cuentas
  // y movimientos eso se nota. Aquí se calcula todo en un único recorrido y
  // se memoiza mientras `cuentas`/`movimientos` no cambien.
  const statsPorCuenta = useMemo(() => {
    const map = {};
    cuentas.forEach((c) => { map[c.id] = { saldo: 0, numMovs: 0 }; });
    movimientos.forEach((m) => {
      const entry = map[m.cuenta];
      if (!entry) return;
      entry.saldo += m.signo === "entrada" ? m.monto : -m.monto;
      entry.numMovs += 1;
    });
    return map;
  }, [cuentas, movimientos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowForm(true)}>
          <Plus size={14} strokeWidth={2} /> Agregar cuenta
        </PrimaryButton>
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <CuentaForm onCancel={() => setShowForm(false)} onGuardar={onAgregar} />
        </Modal>
      )}

      {cuentas.length === 0 ? (
        <Card className="text-center py-10">
          <div style={{ color: COLOR.textMuted, fontSize: 14 }}>No tienes cuentas registradas todavía.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cuentas.map((c) => {
            const meta = CUENTA_TIPOS.find((t) => t.value === c.tipo);
            const Icon = meta?.icon || Wallet;
            const { saldo, numMovs } = statsPorCuenta[c.id] || { saldo: 0, numMovs: 0 };
            const esDeuda = c.tipo === "deuda";
            const semColor = esDeuda ? COLOR.coral : c.tipo === "inversion" ? COLOR.gold : COLOR.peri;
            const semSoft = esDeuda ? COLOR.coralSoft : c.tipo === "inversion" ? COLOR.goldSoft : COLOR.periSoft;
            return (
              <Card key={c.id} hoverable className="!p-5 relative group">
                <div className="flex items-center justify-between">
                  <IconBadge icon={Icon} color={semColor} soft={semSoft} />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ConfirmIconButton onConfirm={() => onEliminar(c.id)} icon={Trash2} title="Eliminar cuenta (y sus movimientos y metas)" />
                  </div>
                </div>
                <div style={{ color: COLOR.textMuted, fontSize: 11, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>{meta?.label}</div>
                <div style={{ fontSize: 15, marginTop: 3, fontWeight: 500 }}>{c.nombre}</div>
                <div className="tabular-nums" style={{ fontFamily: FONT_MONO, fontSize: 19, marginTop: 8, color: esDeuda ? COLOR.coral : COLOR.textPrimary }}>
                  {esDeuda ? "−" : ""}{fmtCOP(Math.abs(saldo))}
                </div>
                {numMovs > 0 && <div style={{ fontSize: 11, color: COLOR.textMuted, marginTop: 4 }}>{numMovs} movimiento{numMovs > 1 ? "s" : ""}</div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CuentaForm({ onCancel, onGuardar }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("liquido");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!nombre.trim()) return setError("Ponle un nombre a la cuenta.");
    setError("");
    onGuardar({ nombre: nombre.trim(), tipo, saldoInicial });
  }

  return (
    <Card variant="hero" className="!p-6">
      <SectionHeader title="Nueva cuenta" />
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Nombre">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bancolombia, Nu, Efectivo…" className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
        </Field>
        <Field label="Tipo de cuenta">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            {CUENTA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label={tipo === "deuda" ? "Monto que debes hoy (opcional)" : "Saldo inicial (opcional)"}>
          <input type="number" min="0" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0" className="rounded-lg px-3 py-2.5 text-sm" style={{ ...inputStyle, fontFamily: FONT_MONO }} />
        </Field>
      </div>
      {error && <div className="flex items-center gap-1.5 mt-3.5" style={{ fontSize: 12, color: COLOR.coral }}><AlertTriangle size={12.5} />{error}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <GhostButton onClick={onCancel}>Cancelar</GhostButton>
        <PrimaryButton onClick={submit}>Guardar cuenta</PrimaryButton>
      </div>
    </Card>
  );
}

// ============================================================================
// Metas (Presupuestos + Metas de ahorro/inversión)
// ============================================================================
function PresupuestosSection({ presupuestos, movimientos, onAgregar, onEliminar }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const disponibles = CATEGORIAS.filter((c) => !presupuestos.some((p) => p.categoria === c));
  const [categoria, setCategoria] = useState(disponibles[0] || "");
  const [limite, setLimite] = useState("");

  function submit() {
    if (!categoria || !limite || Number(limite) <= 0) return;
    onAgregar({ categoria, limiteMensual: Number(limite) });
    setLimite("");
    setShowForm(false);
  }

  function abrirEdicion(p) {
    setEditingId(p.id);
    setEditValue(String(p.limiteMensual));
  }

  function guardarEdicion(p) {
    const v = Number(editValue);
    if (v > 0) onAgregar({ categoria: p.categoria, limiteMensual: v });
    setEditingId(null);
  }

  return (
    <Card>
      <SectionHeader
        title="Presupuestos mensuales"
        action={
          <OutlineButton onClick={() => setShowForm((s) => !s)} disabled={disponibles.length === 0} className="!gap-1">
            <Plus size={13} strokeWidth={1.9} /> Agregar
          </OutlineButton>
        }
      />

      {showForm && (
        <div className="flex gap-2 mb-4 flex-wrap animate-slide-up">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>
            {disponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="0" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Límite mensual" className="rounded-lg px-3 py-2.5 text-sm flex-1" style={{ ...inputStyle, minWidth: 120, fontFamily: FONT_MONO }} />
          <PrimaryButton onClick={submit} className="!px-3.5">Guardar</PrimaryButton>
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Sin presupuestos definidos todavía.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {presupuestos.map((p) => {
            const gastado = gastadoMesCategoria(p.categoria, movimientos);
            const pct = p.limiteMensual ? (gastado / p.limiteMensual) * 100 : 0;
            const excedido = gastado > p.limiteMensual;
            const editing = editingId === p.id;
            const Icon = iconoCategoria(p.categoria);
            return (
              <div key={p.id} className="group">
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <span className="flex items-center gap-1.5" style={{ color: COLOR.textPrimary }}>
                    <Icon size={13} style={{ color: COLOR.textMuted }} /> {p.categoria}
                  </span>
                  {editing ? (
                    <span className="flex items-center gap-1.5">
                      <input autoFocus type="number" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && guardarEdicion(p)}
                        className="rounded-lg px-2 py-1 text-xs w-24" style={{ ...inputStyle, fontFamily: FONT_MONO }} />
                      <button onClick={() => guardarEdicion(p)} className="raiz-press" style={{ color: COLOR.mint }}><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="raiz-press" style={{ color: COLOR.textMuted }}><X size={14} /></button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums" style={{ fontFamily: FONT_MONO, color: excedido ? COLOR.coral : COLOR.textMuted }}>{fmtCOP(gastado)} / {fmtCOP(p.limiteMensual)}</span>
                      <button onClick={() => abrirEdicion(p)} className="raiz-press opacity-0 group-hover:opacity-100" style={{ color: COLOR.textMuted }}><Pencil size={12} /></button>
                      <ConfirmIconButton onConfirm={() => onEliminar(p.id)} icon={Trash2} size={13} className="opacity-0 group-hover:opacity-100" />
                    </span>
                  )}
                </div>
                <ProgressBar pct={pct} color={excedido ? COLOR.coral : COLOR.mint} />
                {excedido && <div className="flex items-center gap-1.5 mt-1.5" style={{ fontSize: 11, color: COLOR.coral }}><AlertTriangle size={11} />Superado por {fmtCOP(gastado - p.limiteMensual)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MetasSection({ cuentas, movimientos, metas, onAgregar, onEliminar }) {
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [montoObjetivo, setMontoObjetivo] = useState("");
  const [fechaObjetivo, setFechaObjetivo] = useState("");
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || "");

  function submit() {
    if (!nombre.trim() || !montoObjetivo || Number(montoObjetivo) <= 0 || !cuentaId) return;
    onAgregar({ nombre: nombre.trim(), montoObjetivo: Number(montoObjetivo), fechaObjetivo, cuentaId });
    setNombre(""); setMontoObjetivo(""); setFechaObjetivo(""); setShowForm(false);
  }

  return (
    <Card>
      <SectionHeader
        title="Metas de ahorro e inversión"
        action={
          <OutlineButton onClick={() => setShowForm((s) => !s)} disabled={cuentas.length === 0} className="!gap-1">
            <Plus size={13} strokeWidth={1.9} /> Nueva meta
          </OutlineButton>
        }
      />

      {cuentas.length === 0 && <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Crea primero una cuenta para vincular una meta.</div>}

      {showForm && (
        <div className="grid grid-cols-2 gap-2 mb-4 animate-slide-up">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Fondo de emergencia" className="rounded-lg px-3 py-2.5 text-sm col-span-2" style={inputStyle} />
          <input type="number" min="0" value={montoObjetivo} onChange={(e) => setMontoObjetivo(e.target.value)} placeholder="Monto objetivo" className="rounded-lg px-3 py-2.5 text-sm" style={{ ...inputStyle, fontFamily: FONT_MONO }} />
          <input type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm" style={inputStyle} />
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm col-span-2" style={inputStyle}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <PrimaryButton onClick={submit} className="col-span-2">Guardar meta</PrimaryButton>
        </div>
      )}

      {metas.length === 0 ? (
        <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Sin metas definidas todavía.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {metas.map((meta) => {
            const cuenta = cuentas.find((c) => c.id === meta.cuentaId);
            const saldo = cuenta ? saldoCuenta(cuenta.id, movimientos) : 0;
            const pct = meta.montoObjetivo ? (saldo / meta.montoObjetivo) * 100 : 0;
            const cumplida = saldo >= meta.montoObjetivo;
            const diasRestantes = meta.fechaObjetivo ? Math.ceil((new Date(meta.fechaObjetivo) - new Date()) / 86400000) : null;
            return (
              <div key={meta.id} className="group">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5" style={{ color: COLOR.textPrimary }}>
                    <Target size={13} style={{ color: cumplida ? COLOR.mint : COLOR.textMuted }} />
                    {meta.nombre}{cuenta ? ` · ${cuenta.nombre}` : ""}
                    {cumplida && <Check size={12} style={{ color: COLOR.mint }} />}
                  </span>
                  <ConfirmIconButton onConfirm={() => onEliminar(meta.id)} icon={Trash2} size={13} className="opacity-0 group-hover:opacity-100" />
                </div>
                <ProgressBar pct={pct} color={cumplida ? COLOR.mint : COLOR.peri} />
                <div className="flex items-center justify-between mt-1.5" style={{ fontSize: 11, color: COLOR.textMuted }}>
                  <span className="tabular-nums" style={{ fontFamily: FONT_MONO }}>{fmtCOP(saldo)} / {fmtCOP(meta.montoObjetivo)} · {Math.min(100, pct).toFixed(0)}%</span>
                  {diasRestantes !== null && <span style={{ color: diasRestantes < 0 && !cumplida ? COLOR.coral : COLOR.textMuted }}>{cumplida ? "meta cumplida" : diasRestantes >= 0 ? `${diasRestantes} días restantes` : "vencida"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Metas({ cuentas, movimientos, presupuestos, metas, onAgregarPresupuesto, onEliminarPresupuesto, onAgregarMeta, onEliminarMeta }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <PresupuestosSection presupuestos={presupuestos} movimientos={movimientos} onAgregar={onAgregarPresupuesto} onEliminar={onEliminarPresupuesto} />
      <MetasSection cuentas={cuentas} movimientos={movimientos} metas={metas} onAgregar={onAgregarMeta} onEliminar={onEliminarMeta} />
    </div>
  );
}

// ============================================================================
// Reportes
// ============================================================================
function Reportes({ cuentas, movimientos, serie, catBreak, periodo, setPeriodo }) {
  const [rangoMeses, setRangoMeses] = useState(6);
  const serieExtendida = useMemo(() => serieMensual(cuentas, movimientos, rangoMeses), [cuentas, movimientos, rangoMeses]);
  const totalGastos = catBreak.reduce((a, b) => a + b.monto, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto raiz-scrollbar-x p-1 rounded-full w-fit" style={{ background: COLOR.surface, border: `1px solid ${COLOR.hairline}` }}>
        {[["mes", "Mes"], ["trimestre", "Trimestre"], ["semestre", "Semestre"], ["año", "Año"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriodo(v)} className="raiz-press px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap"
            style={{ background: periodo === v ? COLOR.peri : "transparent", color: periodo === v ? COLOR.onAccent : COLOR.textMuted, fontWeight: periodo === v ? 600 : 500 }}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 14.5, fontWeight: 600, color: COLOR.textPrimary }}>Evolución del patrimonio</div>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: COLOR.surfaceAlt }}>
              {[6, 12].map((n) => (
                <button key={n} onClick={() => setRangoMeses(n)} className="raiz-press px-2.5 py-1 rounded-md text-[11px] font-medium"
                  style={{ background: rangoMeses === n ? COLOR.peri : "transparent", color: rangoMeses === n ? COLOR.onAccent : COLOR.textMuted }}>
                  {n}m
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieExtendida}>
                <CartesianGrid vertical={false} stroke={COLOR.hairline} strokeDasharray="3 5" />
                <XAxis dataKey="mes" tick={{ fill: COLOR.textMuted, fontSize: 11.5 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <defs>
                  <linearGradient id="patrGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR.peri} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={COLOR.peri} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="patrimonio" name="Patrimonio" stroke={COLOR.peri} strokeWidth={2.25} fill="url(#patrGrad2)" activeDot={{ r: 4, strokeWidth: 0 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLOR.hairlineStrong, strokeWidth: 1 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 14.5, fontWeight: 600, color: COLOR.textPrimary }}>Gastos por categoría</div>
            <span className="tabular-nums" style={{ fontFamily: FONT_MONO, color: COLOR.textPrimary, fontSize: 13 }}>{fmtCOP(totalGastos)}</span>
          </div>
          {catBreak.length === 0 ? (
            <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Sin gastos registrados en este período.</div>
          ) : <DonutBreakdown data={catBreak} compact />}
        </Card>
      </div>

      <OutlineButton
        onClick={() => {
          const header = ["Mes", "Patrimonio", "Ingresos", "Gastos"];
          const rows = serieExtendida.map((s) => [s.mes, s.patrimonio, s.ingresos, s.gastos]);
          descargarCSV(`raiz-reporte-${todayStr()}.csv`, [header, ...rows]);
        }}
        className="!px-3.5 self-start"
      >
        <Download size={12} strokeWidth={1.9} /> Exportar serie mensual (CSV)
      </OutlineButton>
    </div>
  );
}

// ---------- Gate de autenticación ----------
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ background: COLOR.bg, minHeight: 480 }} className="flex items-center justify-center">
        <GlobalStyles />
        <span style={{ color: COLOR.textMuted, fontFamily: FONT_BODY, fontSize: 13.5 }} className="animate-fade-in">Cargando…</span>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <FinanzasApp
      user={session.user}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}
