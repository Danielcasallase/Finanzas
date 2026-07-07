import { useState } from "react";
import { supabase } from "./supabaseClient";
import GlobalStyles from "./GlobalStyles";
import { COLOR, FONT_DISPLAY, FONT_BODY, FONT_MONO, RADIUS, SHADOW, inputStyle } from "./theme";
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

// ---------- Auth ----------
// Puerta de acceso sin contraseña: un solo campo de correo. El objetivo del
// rediseño es que la primera impresión de la app ya transmita "producto
// financiero premium" antes incluso de entrar al dashboard.
export default function Auth() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | enviando | enviado | error
  const [errorMsg, setErrorMsg] = useState("");

  async function enviarEnlace(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setEstado("enviando");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setEstado("error");
      setErrorMsg(error.message);
    } else {
      setEstado("enviado");
    }
  }

  return (
    <div
      style={{
        background: `
          radial-gradient(900px 480px at 15% -10%, ${COLOR.meshPeri}, transparent 60%),
          radial-gradient(700px 420px at 100% 10%, ${COLOR.meshMint}, transparent 55%),
          ${COLOR.bg}
        `,
        minHeight: "100vh",
        fontFamily: FONT_BODY,
        color: COLOR.textPrimary,
      }}
      className="w-full flex items-center justify-center px-5 py-10 relative overflow-hidden"
    >
      <GlobalStyles />

      {/* Motivo decorativo de raíces — marca de agua sutil, coherente con el logotipo */}
      <svg
        aria-hidden="true"
        width="520" height="520" viewBox="0 0 420 420"
        style={{ position: "absolute", bottom: -120, left: "50%", transform: "translateX(-50%)", opacity: 0.05, pointerEvents: "none" }}
      >
        <path
          d="M210 40 V180 M210 180 C 150 210, 130 260, 90 320 M210 180 C 270 210, 290 260, 330 320 M210 180 C 180 220, 170 250, 150 300 M210 180 C 240 220, 250 250, 270 300"
          stroke={COLOR.peri} strokeWidth="2" fill="none" strokeLinecap="round"
        />
      </svg>

      <div className="w-full flex flex-col items-center gap-6 animate-slide-up" style={{ maxWidth: 384 }}>
        {/* Wordmark */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: RADIUS.md, background: COLOR.periSoft, border: `1px solid ${COLOR.periBorder}` }}
          >
            <Sparkles size={14} strokeWidth={2} color={COLOR.peri} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontStyle: "italic", letterSpacing: 0.2 }}>Ledger</div>
        </div>

        <div
          className="w-full relative animate-scale-in"
          style={{
            background: COLOR.surface,
            border: `1px solid ${COLOR.hairline}`,
            borderRadius: RADIUS.xxl,
            boxShadow: SHADOW.lg,
            padding: "34px 30px",
          }}
        >
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 27, fontWeight: 500, letterSpacing: -0.2, lineHeight: 1.15 }}>
            Tu panorama financiero, en un solo lugar
          </div>
          <p style={{ color: COLOR.textMuted, fontSize: 13.5, marginTop: 10, marginBottom: 26, lineHeight: 1.55 }}>
            Entra con tu correo. Te enviamos un enlace de acceso — sin contraseñas que recordar.
          </p>

          {estado === "enviado" ? (
            <div
              className="flex items-start gap-2.5 animate-fade-in"
              style={{ borderRadius: RADIUS.lg, padding: 16, background: COLOR.mintSoft, border: `1px solid ${COLOR.mintBorder}` }}
            >
              <CheckCircle2 size={17} style={{ color: COLOR.mint, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13.5, color: COLOR.textPrimary, lineHeight: 1.55 }}>
                Listo. Revisa <span style={{ fontFamily: FONT_MONO, color: COLOR.mint }}>{email}</span> y haz clic en el enlace para entrar.
              </div>
            </div>
          ) : (
            <form onSubmit={enviarEnlace} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span style={{ fontSize: 11.5, color: COLOR.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Correo electrónico</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ ...inputStyle, borderRadius: RADIUS.lg }}
                />
              </label>

              <button
                type="submit"
                disabled={estado === "enviando"}
                className="raiz-press flex items-center justify-center gap-1.5 text-sm font-medium mt-1"
                style={{
                  background: COLOR.peri,
                  color: COLOR.onAccent,
                  borderRadius: RADIUS.lg,
                  padding: "13px 16px",
                  opacity: estado === "enviando" ? 0.7 : 1,
                  boxShadow: estado === "enviando" ? "none" : SHADOW.glowPeri,
                  cursor: estado === "enviando" ? "default" : "pointer",
                }}
              >
                {estado === "enviando" ? "Enviando…" : (
                  <>Enviar enlace de acceso <ArrowRight size={15} /></>
                )}
              </button>

              {estado === "error" && (
                <div
                  className="flex items-start gap-2 animate-fade-in"
                  style={{ borderRadius: RADIUS.md, padding: 12, background: COLOR.coralSoft, border: `1px solid ${COLOR.coralBorder}` }}
                >
                  <AlertCircle size={15} style={{ color: COLOR.coral, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12.5, color: COLOR.coral, lineHeight: 1.5 }}>{errorMsg}</div>
                </div>
              )}
            </form>
          )}
        </div>

        <p style={{ fontSize: 12, color: COLOR.textMuted, textAlign: "center", lineHeight: 1.6 }}>
          Tus datos viven en tu propia cuenta, protegidos por Supabase.
        </p>
      </div>
    </div>
  );
}
