// ============================================================================
// Ledger — Design tokens
// ----------------------------------------------------------------------------
// Fuente única de verdad para color, tipografía, radios, sombras y
// transiciones. Todo componente de la app (Auth, Dashboard, Movimientos,
// Cuentas, Metas, Reportes) importa desde aquí — así se elimina cualquier
// inconsistencia visual entre pantallas.
// ============================================================================

export const COLOR = {
  // Superficies — escala de elevación sobre negro casi puro
  bg: "#08090C",
  bgElevated: "#0B0D11",
  surface: "#101216",
  surfaceAlt: "#171A20",
  surfaceRaised: "#1E222A",

  // Bordes — deliberadamente sutiles, la profundidad la da la sombra, no la línea
  hairline: "rgba(255,255,255,0.07)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  hairlineHover: "rgba(255,255,255,0.24)",

  // Overlays estructurales — scrim de modales y fondo de la barra de navegación glass
  scrim: "rgba(5,6,9,0.65)",
  glassNav: "rgba(8,9,12,0.72)",

  // Texto
  textPrimary: "#F3F4F6",
  textSecondary: "#9AA1AE",
  textMuted: "#676D79",

  // Acento primario / marca — índigo-periwinkle (Linear-esque)
  peri: "#8C99F7",
  periSoft: "rgba(140,153,247,0.14)",
  periBorder: "rgba(140,153,247,0.32)",

  // Semántico positivo — ingresos, crecimiento, patrimonio al alza
  mint: "#6FDDA6",
  mintSoft: "rgba(111,221,166,0.12)",
  mintBorder: "rgba(111,221,166,0.30)",

  // Semántico negativo — gastos, deuda, alertas
  coral: "#F0847A",
  coralSoft: "rgba(240,132,122,0.12)",
  coralBorder: "rgba(240,132,122,0.30)",

  // Acento terciario — metas, pendientes, disponibilidad
  gold: "#E7B75F",
  goldSoft: "rgba(231,183,95,0.12)",
  goldBorder: "rgba(231,183,95,0.30)",

  // Texto sobre superficies de acento sólido (botones primarios, pastillas activas)
  onAccent: "#0A0B14",

  // Degradados de fondo decorativos ("mesh") — misma opacidad en Auth,
  // shell principal y hero de patrimonio para que ninguna pantalla se
  // sienta más o menos saturada que otra
  meshPeri: "rgba(140,153,247,0.10)",
  meshMint: "rgba(111,221,166,0.08)",
  meshCoral: "rgba(240,132,122,0.08)",
};

export const FONT_DISPLAY = "'Fraunces', Georgia, serif";
export const FONT_BODY = "'Inter', ui-sans-serif, system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const SHADOW = {
  xs: "0 1px 2px rgba(0,0,0,0.40)",
  sm: "0 1px 2px rgba(0,0,0,0.30), 0 6px 14px -8px rgba(0,0,0,0.50)",
  md: "0 2px 6px rgba(0,0,0,0.32), 0 16px 32px -14px rgba(0,0,0,0.58)",
  lg: "0 4px 10px rgba(0,0,0,0.36), 0 32px 64px -20px rgba(0,0,0,0.65)",
  glowPeri: "0 0 0 1px rgba(140,153,247,0.30), 0 10px 28px -10px rgba(140,153,247,0.45)",
  glowMint: "0 0 0 1px rgba(111,221,166,0.28), 0 10px 28px -10px rgba(111,221,166,0.40)",
  glowCoral: "0 0 0 1px rgba(240,132,122,0.28), 0 10px 28px -10px rgba(240,132,122,0.40)",
};

export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
export const EASE_SPRING = "cubic-bezier(0.16, 1, 0.3, 1)";

export const TRANSITION = {
  fast: `150ms ${EASE}`,
  base: `200ms ${EASE}`,
  slow: `320ms ${EASE_SPRING}`,
};

// Paleta categórica para donuts / gráficos de distribución
export const DONUT_COLORS = ["#6FDDA6", "#8C99F7", "#F0847A", "#E7B75F", "#5FB9C9", "#B48CE0"];

// Estilo base compartido por inputs y selects de todos los formularios
export const inputStyle = {
  background: COLOR.surfaceAlt,
  border: `1px solid ${COLOR.hairline}`,
  color: COLOR.textPrimary,
  fontFamily: FONT_BODY,
  transition: `border-color ${TRANSITION.fast}, box-shadow ${TRANSITION.fast}, background ${TRANSITION.fast}`,
};
