import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Receipt, Wallet, PieChart as PieChartIcon, Target,
  Plus, TrendingUp, Trash2, CreditCard, Pencil, Search, AlertTriangle,
  Sparkles, ArrowDownRight, ArrowUpRight, Download, Check, X, Calendar,
} from "lucide-react";

// ---------- Design tokens ----------
const COLOR = {
  bg: "#0A0C10",
  surface: "#12161D",
  surfaceAlt: "#171C24",
  hairline: "#232A34",
  textPrimary: "#E9ECF1",
  textMuted: "#7C8698",
  mint: "#8FBFA6",
  mintSoft: "rgba(143,191,166,0.10)",
  coral: "#C99089",
  coralSoft: "rgba(201,144,137,0.10)",
  peri: "#8C9BC7",
  periSoft: "rgba(140,155,199,0.10)",
};

const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

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

const DONUT_COLORS = ["#8FBFA6", "#8C9BC7", "#C99089", "#B9A98C", "#7FA6A0", "#9C8FBF"];

// ---------- UI atoms ----------
function Card({ children, style, className = "" }) {
  return (
    <div
      className={`rounded-2xl p-5 transition-transform duration-200 ${className}`}
      style={{
        background: COLOR.surface,
        border: `1px solid ${COLOR.hairline}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.35), 0 16px 32px -18px rgba(0,0,0,0.6)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 py-2 px-3.5 text-sm whitespace-nowrap rounded-full transition-all duration-150"
      style={{
        color: active ? COLOR.bg : COLOR.textMuted,
        background: active ? COLOR.mint : "transparent",
        fontFamily: FONT_BODY,
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" style={{ fontFamily: FONT_BODY }}>
      <span style={{ color: COLOR.textMuted, fontSize: 12, letterSpacing: 0.3 }}>{label}</span>
      {children}
    </label>
  );
}

function ProgressBar({ pct, color }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{ height: 6, borderRadius: 4, background: COLOR.surfaceAlt, overflow: "hidden" }}>
      <div style={{ width: `${clamped}%`, height: "100%", background: color, transition: "width 0.3s" }} />
    </div>
  );
}

// Icon-button with a built-in "click again to confirm" step, used anywhere a
// destructive action needs a lightweight guard without a full modal.
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
      className={`transition-colors ${className}`}
      style={{ color: armed ? COLOR.coral : COLOR.textMuted }}
    >
      {armed ? <ConfirmIcon size={size} /> : <Icon size={size} />}
    </button>
  );
}

const inputStyle = {
  background: COLOR.surfaceAlt,
  border: `1px solid ${COLOR.hairline}`,
  color: COLOR.textPrimary,
  fontFamily: FONT_BODY,
};

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
        <span style={{ color: COLOR.textMuted, fontFamily: FONT_BODY }}>Cargando…</span>
      </div>
    );
  }

  return (
<div
      style={{
        background: `radial-gradient(1200px 500px at 50% -10%, rgba(143,191,166,0.06), transparent 60%), ${COLOR.bg}`,
        minHeight: 480, fontFamily: FONT_BODY, color: COLOR.textPrimary,
      }}
      className="w-full"
    >      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${COLOR.hairline}; border-radius: 4px; }
        input:focus, select:focus, button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px ${COLOR.periSoft}, 0 0 0 1px ${COLOR.peri};
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="px-5 pt-7 pb-4 flex items-center justify-between">
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontStyle: "italic", letterSpacing: 0.2 }}>Raíz</div>
        <div className="flex items-center gap-3">
          <ConfirmIconButtonText
            onConfirm={async () => {
              setCuentas([]); setMovimientos([]); setPresupuestos([]); setMetas([]);
              try {
                await supabase.from("raiz_data").upsert({ user_id: user.id, payload: {} });
              } catch (e) { console.error(e); }
            }}
          />
          <button onClick={onSignOut} className="text-xs" style={{ color: COLOR.textMuted }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3">
        <div
          className="flex gap-1 overflow-x-auto p-1.5 rounded-2xl w-fit"
          style={{ background: COLOR.surface, border: `1px solid ${COLOR.hairline}` }}
        >
          <Pill active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard} label="Dashboard" />
          <Pill active={tab === "movimientos"} onClick={() => setTab("movimientos")} icon={Receipt} label="Movimientos" />
          <Pill active={tab === "cuentas"} onClick={() => setTab("cuentas")} icon={Wallet} label="Cuentas" />
          <Pill active={tab === "metas"} onClick={() => setTab("metas")} icon={Target} label="Metas" />
          <Pill active={tab === "reportes"} onClick={() => setTab("reportes")} icon={PieChartIcon} label="Reportes" />
        </div>
      </div>
      <div className="p-5 max-w-3xl mx-auto">
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
    </div>
  );
}

// Small text-based confirm control used only for the header "Restablecer" action.
function ConfirmIconButtonText({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (armed) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => { clearTimeout(timer.current); setArmed(false); }} className="text-xs" style={{ color: COLOR.textMuted }}>Cancelar</button>
        <button
          onClick={() => { clearTimeout(timer.current); setArmed(false); onConfirm(); }}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: COLOR.coralSoft, color: COLOR.coral, border: `1px solid ${COLOR.hairline}` }}
        >
          ¿Seguro? Borrar todo
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => { setArmed(true); timer.current = setTimeout(() => setArmed(false), 4000); }}
      className="text-xs"
      style={{ color: COLOR.textMuted }}
    >
      Restablecer
    </button>
  );
}

// ---------- Dashboard ----------
function Dashboard({ cuentas, totales, serie, catBreak, deltaPct, ahorroPct, mesActual, alertas, onIrCuentas, onIrMovs, onIrMetas }) {
  if (cuentas.length === 0) {
    return (
      <Card className="text-center py-10">
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontStyle: "italic" }}>Tu panorama financiero empieza aquí</div>
        <p style={{ color: COLOR.textMuted, fontSize: 14, marginTop: 8, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Raíz no guarda saldos: calcula todo a partir de tus movimientos. Empieza agregando la primera cuenta donde vive tu dinero.
        </p>
        <button onClick={onIrCuentas} className="mt-5 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: COLOR.mint, color: "#08130E" }}>
          Agregar primera cuenta
        </button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {alertas.length > 0 && (
        <button onClick={onIrMetas} className="flex items-center gap-2 px-4 py-3 rounded-xl text-left text-sm"
          style={{ background: COLOR.coralSoft, border: `1px solid ${COLOR.hairline}`, color: COLOR.coral }}>
          <AlertTriangle size={15} />
          {alertas.length} presupuesto{alertas.length > 1 ? "s" : ""} superado{alertas.length > 1 ? "s" : ""} este mes — revisar
        </button>
      )}

      <Card>
        <div style={{ color: COLOR.textMuted, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>Patrimonio neto</div>
        <div className="flex items-end gap-3 mt-1">
          <div style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 500 }}>{fmtCOP(totales.patrimonio)}</div>
          {serie.length > 1 && (
            <div className="flex items-center gap-1 mb-1.5 text-xs" style={{ color: deltaPct >= 0 ? COLOR.mint : COLOR.coral }}>
              {deltaPct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(deltaPct).toFixed(1)}% vs mes pasado
            </div>
          )}
        </div>
        <div style={{ height: 70, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="patrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.mint} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLOR.mint} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="patrimonio" stroke={COLOR.mint} strokeWidth={2} fill="url(#patrGrad)" />
              <Tooltip contentStyle={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v) => fmtCOP(v)} labelFormatter={() => ""} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <div className="flex items-center gap-1.5" style={{ color: COLOR.textMuted, fontSize: 11 }}><Wallet size={12} /> Disponible</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 16, marginTop: 6 }}>{fmtCOP(totales.liquido)}</div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-1.5" style={{ color: COLOR.textMuted, fontSize: 11 }}><TrendingUp size={12} /> Invertido</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 16, marginTop: 6 }}>{fmtCOP(totales.inversion)}</div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-center gap-1.5" style={{ color: COLOR.textMuted, fontSize: 11 }}><Sparkles size={12} /> Ahorro del mes</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 16, marginTop: 6, color: ahorroPct >= 0 ? COLOR.mint : COLOR.coral }}>{ahorroPct.toFixed(0)}%</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 8 }}>Ingresos vs. gastos · últimos 6 meses</div>
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={COLOR.hairline} strokeDasharray="3 4" />
              <XAxis dataKey="mes" tick={{ fill: COLOR.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtCOP(v)} />
              <Bar dataKey="ingresos" fill={COLOR.mint} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill={COLOR.coral} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {mesActual.ingresos === 0 && mesActual.gastos === 0 && (
        <button onClick={onIrMovs} className="text-sm underline text-center" style={{ color: COLOR.peri }}>
          Registra tu primer movimiento del mes →
        </button>
      )}

      {catBreak.length > 0 && (
        <Card>
          <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 8 }}>Gastos por categoría · este mes</div>
          <DonutBreakdown data={catBreak} />
        </Card>
      )}
    </div>
  );
}

function DonutBreakdown({ data }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div style={{ width: 120, height: 120, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="monto" nameKey="categoria" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtCOP(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-[160px] flex flex-col gap-1.5">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.categoria} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5" style={{ color: COLOR.textMuted }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: DONUT_COLORS[i % DONUT_COLORS.length], display: "inline-block" }} />
              {d.categoria}
            </span>
            <span style={{ fontFamily: FONT_MONO }}>{d.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Movimientos ----------
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
        <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)} className="text-sm rounded-lg px-3 py-2" style={inputStyle}>
          <option value="todas">Todas las cuentas</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 flex-1 min-w-[140px]" style={inputStyle}>
          <Search size={14} color={COLOR.textMuted} />
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…"
            className="bg-transparent outline-none text-sm flex-1" style={{ color: COLOR.textPrimary, fontFamily: FONT_BODY }} />
        </div>
        <button onClick={() => setShowFiltros((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
          style={{ background: (desde || hasta) ? COLOR.periSoft : "transparent", color: (desde || hasta) ? COLOR.peri : COLOR.textMuted, border: `1px solid ${(desde || hasta) ? "rgba(140,155,199,0.35)" : COLOR.hairline}` }}>
          <Calendar size={14} strokeWidth={1.75} /> Fechas
        </button>
        <button onClick={abrirNuevo} disabled={cuentas.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm"
          style={{ background: "transparent", color: cuentas.length ? COLOR.textPrimary : COLOR.textMuted, border: `1px solid ${COLOR.hairline}` }}>
          <Plus size={14} strokeWidth={1.75} /> Nuevo
        </button>
      </div>

      {showFiltros && (
        <Card className="!p-3">
          <div className="flex items-end gap-3 flex-wrap">
            <Field label="Desde">
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            <Field label="Hasta">
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
            </Field>
            {(desde || hasta) && (
              <button onClick={() => { setDesde(""); setHasta(""); }} className="text-xs pb-2.5" style={{ color: COLOR.textMuted }}>Quitar rango</button>
            )}
          </div>
        </Card>
      )}

      {cuentas.length === 0 && (
        <Card><div style={{ color: COLOR.textMuted, fontSize: 14 }}>Primero crea una cuenta en la pestaña Cuentas para poder registrar movimientos.</div></Card>
      )}

      {showForm && <MovForm cuentas={cuentas} presupuestos={presupuestos} movimientos={movimientos} initial={editingMov} onCancel={cerrarForm} onGuardar={guardar} />}

      {movimientos.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div style={{ fontSize: 12, color: COLOR.textMuted }}>
            {filtrados.length} movimiento{filtrados.length !== 1 ? "s" : ""}
            {hayFiltrosActivos && (
              <>
                {" · "}<span style={{ fontFamily: FONT_MONO, color: totalFiltrado >= 0 ? COLOR.mint : COLOR.coral }}>{fmtCOP(totalFiltrado)}</span> neto
                {" · "}<button onClick={limpiarFiltros} className="underline" style={{ color: COLOR.peri }}>limpiar filtros</button>
              </>
            )}
          </div>
          <button onClick={exportarCSV} disabled={filtrados.length === 0}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
            style={{ border: `1px solid ${COLOR.hairline}`, color: filtrados.length ? COLOR.textPrimary : COLOR.textMuted }}>
            <Download size={12} strokeWidth={1.75} /> Exportar CSV
          </button>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-6 text-center" style={{ color: COLOR.textMuted, fontSize: 14 }}>
            {hayFiltrosActivos ? "Sin resultados para este filtro." : "Aún no hay movimientos registrados."}
          </div>
        ) : (
          filtrados.map((m, i) => {
            const cuenta = cuentas.find((c) => c.id === m.cuenta);
            const positivo = m.signo === "entrada";
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 group"
                style={{ borderTop: i === 0 ? "none" : `1px dashed ${COLOR.hairline}` }}>
                <div className="flex flex-col min-w-0">
                  <span style={{ fontSize: 13.5 }}>{m.descripcion || m.tipo}</span>
                  <span style={{ fontSize: 11, color: COLOR.textMuted }}>
                    {new Date(m.fecha + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · {cuenta?.nombre || "—"} · {m.categoria}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {conSaldo && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLOR.textMuted }}>{fmtCOP(conSaldo[m.id])}</span>}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: positivo ? COLOR.mint : COLOR.coral }}>
                    {positivo ? "+" : "−"}{fmtCOP(m.monto).replace("-", "")}
                  </span>
                  <button onClick={() => abrirEditar(m)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: COLOR.textMuted }}>
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
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cuenta">
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => handleTipo(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Monto">
          <input type="number" min="0" step="1" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </Field>
        <Field label="Movimiento">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLOR.hairline}` }}>
            <button onClick={() => setSigno("entrada")} className="flex-1 py-2 text-sm" style={{ background: signo === "entrada" ? COLOR.mintSoft : "transparent", color: signo === "entrada" ? COLOR.mint : COLOR.textMuted }}>Entrada</button>
            <button onClick={() => setSigno("salida")} className="flex-1 py-2 text-sm" style={{ background: signo === "salida" ? COLOR.coralSoft : "transparent", color: signo === "salida" ? COLOR.coral : COLOR.textMuted }}>Salida</button>
          </div>
        </Field>
        <Field label="Categoría">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Mercado, salario…" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option>Completado</option>
            <option>Pendiente</option>
          </select>
        </Field>
      </div>

      {tipo === "Gasto" && presupuesto && (
        <div style={{ fontSize: 11.5, color: gastadoConEste > presupuesto.limiteMensual ? COLOR.coral : COLOR.textMuted, marginTop: 10 }}>
          {gastadoConEste > presupuesto.limiteMensual ? "Este movimiento supera" : "Llevarías"} {fmtCOP(gastadoConEste)} de {fmtCOP(presupuesto.limiteMensual)} en {categoria} este mes.
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: COLOR.coral, marginTop: 10 }}>{error}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3.5 py-2 rounded-lg text-sm" style={{ color: COLOR.textMuted }}>Cancelar</button>
        <button onClick={submit} className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: COLOR.mint, color: "#08130E" }}>
          {initial ? "Guardar cambios" : "Guardar movimiento"}
        </button>
      </div>
    </Card>
  );
}

// ---------- Cuentas ----------
function Cuentas({ cuentas, movimientos, showForm, setShowForm, onAgregar, onEliminar }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm" style={{ background: "transparent", color: COLOR.textPrimary, border: `1px solid ${COLOR.hairline}` }}>
          <Plus size={14} strokeWidth={1.75} /> Agregar cuenta
        </button>
      </div>

      {showForm && <CuentaForm onCancel={() => setShowForm(false)} onGuardar={onAgregar} />}

      {cuentas.length === 0 ? (
        <Card><div style={{ color: COLOR.textMuted, fontSize: 14 }}>No tienes cuentas registradas todavía.</div></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cuentas.map((c) => {
            const meta = CUENTA_TIPOS.find((t) => t.value === c.tipo);
            const Icon = meta?.icon || Wallet;
            const saldo = saldoCuenta(c.id, movimientos);
            const esDeuda = c.tipo === "deuda";
            const numMovs = movimientos.filter((m) => m.cuenta === c.id).length;
            return (
              <Card key={c.id} className="!p-4 relative group">
                <div className="flex items-center gap-2" style={{ color: COLOR.textMuted, fontSize: 11 }}>
                  <Icon size={13} /> {meta?.label}
                </div>
                <div style={{ fontSize: 14.5, marginTop: 6 }}>{c.nombre}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 17, marginTop: 4, color: esDeuda ? COLOR.coral : COLOR.textPrimary }}>
                  {esDeuda ? "−" : ""}{fmtCOP(Math.abs(saldo))}
                </div>
                {numMovs > 0 && <div style={{ fontSize: 10.5, color: COLOR.textMuted, marginTop: 2 }}>{numMovs} movimiento{numMovs > 1 ? "s" : ""}</div>}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ConfirmIconButton onConfirm={() => onEliminar(c.id)} icon={Trash2} title="Eliminar cuenta (y sus movimientos y metas)" />
                </div>
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
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bancolombia, Nu, Efectivo…" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </Field>
        <Field label="Tipo de cuenta">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {CUENTA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label={tipo === "deuda" ? "Monto que debes hoy (opcional)" : "Saldo inicial (opcional)"}>
          <input type="number" min="0" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} placeholder="0" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </Field>
      </div>
      {error && <div style={{ fontSize: 12, color: COLOR.coral, marginTop: 10 }}>{error}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3.5 py-2 rounded-lg text-sm" style={{ color: COLOR.textMuted }}>Cancelar</button>
        <button onClick={submit} className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: COLOR.mint, color: "#08130E" }}>Guardar cuenta</button>
      </div>
    </Card>
  );
}

// ---------- Metas (Presupuestos + Metas de ahorro/inversión) ----------
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
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 14 }}>Presupuestos mensuales</div>
        <button onClick={() => setShowForm((s) => !s)} disabled={disponibles.length === 0}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ border: `1px solid ${COLOR.hairline}`, color: disponibles.length ? COLOR.textPrimary : COLOR.textMuted }}>
          <Plus size={13} strokeWidth={1.75} /> Agregar
        </button>
      </div>

      {showForm && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {disponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="0" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Límite mensual" className="rounded-lg px-3 py-2 text-sm flex-1" style={{ ...inputStyle, minWidth: 120 }} />
          <button onClick={submit} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: COLOR.mint, color: "#08130E" }}>Guardar</button>
        </div>
      )}

      {presupuestos.length === 0 ? (
        <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Sin presupuestos definidos todavía.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {presupuestos.map((p) => {
            const gastado = gastadoMesCategoria(p.categoria, movimientos);
            const pct = p.limiteMensual ? (gastado / p.limiteMensual) * 100 : 0;
            const excedido = gastado > p.limiteMensual;
            const editing = editingId === p.id;
            return (
              <div key={p.id} className="group">
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <span>{p.categoria}</span>
                  {editing ? (
                    <span className="flex items-center gap-1.5">
                      <input autoFocus type="number" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && guardarEdicion(p)}
                        className="rounded-lg px-2 py-1 text-xs w-24" style={inputStyle} />
                      <button onClick={() => guardarEdicion(p)} style={{ color: COLOR.mint }}><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} style={{ color: COLOR.textMuted }}><X size={14} /></button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span style={{ fontFamily: FONT_MONO, color: excedido ? COLOR.coral : COLOR.textMuted }}>{fmtCOP(gastado)} / {fmtCOP(p.limiteMensual)}</span>
                      <button onClick={() => abrirEdicion(p)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: COLOR.textMuted }}><Pencil size={12} /></button>
                      <ConfirmIconButton onConfirm={() => onEliminar(p.id)} icon={Trash2} size={13} className="opacity-0 group-hover:opacity-100" />
                    </span>
                  )}
                </div>
                <ProgressBar pct={pct} color={excedido ? COLOR.coral : COLOR.mint} />
                {excedido && <div style={{ fontSize: 11, color: COLOR.coral, marginTop: 4 }}>Superado por {fmtCOP(gastado - p.limiteMensual)}</div>}
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
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 14 }}>Metas de ahorro e inversión</div>
        <button onClick={() => setShowForm((s) => !s)} disabled={cuentas.length === 0}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ border: `1px solid ${COLOR.hairline}`, color: cuentas.length ? COLOR.textPrimary : COLOR.textMuted }}>
          <Plus size={13} strokeWidth={1.75} /> Nueva meta
        </button>
      </div>

      {cuentas.length === 0 && <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Crea primero una cuenta para vincular una meta.</div>}

      {showForm && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Fondo de emergencia" className="rounded-lg px-3 py-2 text-sm col-span-2" style={inputStyle} />
          <input type="number" min="0" value={montoObjetivo} onChange={(e) => setMontoObjetivo(e.target.value)} placeholder="Monto objetivo" className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <input type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="rounded-lg px-3 py-2 text-sm col-span-2" style={inputStyle}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button onClick={submit} className="col-span-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: COLOR.mint, color: "#08130E" }}>Guardar meta</button>
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
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    {meta.nombre}{cuenta ? ` · ${cuenta.nombre}` : ""}
                    {cumplida && <Check size={12} style={{ color: COLOR.mint }} />}
                  </span>
                  <ConfirmIconButton onConfirm={() => onEliminar(meta.id)} icon={Trash2} size={13} className="opacity-0 group-hover:opacity-100" />
                </div>
                <ProgressBar pct={pct} color={cumplida ? COLOR.mint : COLOR.peri} />
                <div className="flex items-center justify-between mt-1" style={{ fontSize: 11, color: COLOR.textMuted }}>
                  <span style={{ fontFamily: FONT_MONO }}>{fmtCOP(saldo)} / {fmtCOP(meta.montoObjetivo)} · {Math.min(100, pct).toFixed(0)}%</span>
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
    <div className="flex flex-col gap-4">
      <PresupuestosSection presupuestos={presupuestos} movimientos={movimientos} onAgregar={onAgregarPresupuesto} onEliminar={onEliminarPresupuesto} />
      <MetasSection cuentas={cuentas} movimientos={movimientos} metas={metas} onAgregar={onAgregarMeta} onEliminar={onEliminarMeta} />
    </div>
  );
}

// ---------- Reportes ----------
function Reportes({ cuentas, movimientos, serie, catBreak, periodo, setPeriodo }) {
  const [rangoMeses, setRangoMeses] = useState(6);
  const serieExtendida = useMemo(() => serieMensual(cuentas, movimientos, rangoMeses), [cuentas, movimientos, rangoMeses]);
  const totalGastos = catBreak.reduce((a, b) => a + b.monto, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto">
        {[["mes", "Mes"], ["trimestre", "Trimestre"], ["semestre", "Semestre"], ["año", "Año"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriodo(v)} className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: periodo === v ? COLOR.periSoft : "transparent", color: periodo === v ? COLOR.peri : COLOR.textMuted, border: `1px solid ${periodo === v ? "rgba(140,155,199,0.35)" : COLOR.hairline}` }}>
            {l}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <div style={{ fontSize: 13, color: COLOR.textMuted }}>Evolución del patrimonio</div>
          <div className="flex gap-1">
            {[6, 12].map((n) => (
              <button key={n} onClick={() => setRangoMeses(n)} className="px-2 py-1 rounded-md text-[11px]"
                style={{ background: rangoMeses === n ? COLOR.periSoft : "transparent", color: rangoMeses === n ? COLOR.peri : COLOR.textMuted }}>
                {n}m
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieExtendida}>
              <CartesianGrid vertical={false} stroke={COLOR.hairline} strokeDasharray="3 4" />
              <XAxis dataKey="mes" tick={{ fill: COLOR.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <defs>
                <linearGradient id="patrGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.peri} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLOR.peri} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="patrimonio" stroke={COLOR.peri} strokeWidth={2} fill="url(#patrGrad2)" />
              <Tooltip contentStyle={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtCOP(v)} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between" style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 8 }}>
          <span>Gastos por categoría</span>
          <span style={{ fontFamily: FONT_MONO, color: COLOR.textPrimary }}>{fmtCOP(totalGastos)}</span>
        </div>
        {catBreak.length === 0 ? (
          <div style={{ color: COLOR.textMuted, fontSize: 13 }}>Sin gastos registrados en este período.</div>
        ) : <DonutBreakdown data={catBreak} />}
      </Card>

      <button
        onClick={() => {
          const header = ["Mes", "Patrimonio", "Ingresos", "Gastos"];
          const rows = serieExtendida.map((s) => [s.mes, s.patrimonio, s.ingresos, s.gastos]);
          descargarCSV(`raiz-reporte-${todayStr()}.csv`, [header, ...rows]);
        }}
        className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg self-start"
        style={{ border: `1px solid ${COLOR.hairline}`, color: COLOR.textPrimary }}
      >
        <Download size={12} strokeWidth={1.75} /> Exportar serie mensual (CSV)
      </button>
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
        <span style={{ color: COLOR.textMuted, fontFamily: FONT_BODY }}>Cargando…</span>
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
