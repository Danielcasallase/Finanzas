import { COLOR, EASE, EASE_SPRING } from "./theme";

// Estilos globales de la aplicación completa (Auth + Dashboard + resto de
// pestañas). Vive en un único componente para que ninguna pantalla pueda
// derivar hacia una paleta o una curva de animación distinta.
export default function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; }

      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${COLOR.hairlineStrong}; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: ${COLOR.hairlineHover}; }

      ::selection { background: ${COLOR.periSoft}; color: ${COLOR.textPrimary}; }

      input:focus, select:focus, textarea:focus, button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px ${COLOR.periSoft}, 0 0 0 1px ${COLOR.peri};
      }

      @keyframes raizFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes raizSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes raizScaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      @keyframes raizPulseRing { 0% { box-shadow: 0 0 0 0 ${COLOR.coralBorder}; } 100% { box-shadow: 0 0 0 8px transparent; } }

      .animate-fade-in { animation: raizFadeIn 200ms ${EASE} both; }
      .animate-slide-up { animation: raizSlideUp 260ms ${EASE_SPRING} both; }
      .animate-scale-in { animation: raizScaleIn 180ms ${EASE_SPRING} both; }

      .raiz-lift { transition: transform 200ms ${EASE}, box-shadow 200ms ${EASE}, border-color 200ms ${EASE}, background 200ms ${EASE}; }
      .raiz-lift:hover { transform: translateY(-2px); }

      .raiz-press { transition: transform 150ms ${EASE}, opacity 150ms ${EASE}, background 150ms ${EASE}, color 150ms ${EASE}, border-color 150ms ${EASE}; }
      .raiz-press:active { transform: scale(0.97); }

      .raiz-scrollbar-x { scrollbar-width: thin; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
    `}</style>
  );
}
