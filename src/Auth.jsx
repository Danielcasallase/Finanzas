import { useState } from "react";
import { supabase } from "./supabaseClient";

const COLOR = {
  bg: "#090C14",
  surface: "#12162A",
  surfaceAlt: "#171C33",
  hairline: "#262B47",
  textPrimary: "#EEF1FA",
  textMuted: "#8791AD",
  mint: "#3FBE8A",
  mintSoft: "rgba(63,190,138,0.14)",
  coral: "#E36F63",
  peri: "#6C7CFF",
  periSoft: "rgba(108,124,255,0.16)",
};
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, sans-serif";

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
        background: `radial-gradient(900px 500px at 50% -8%, rgba(108,124,255,0.12), transparent 60%), ${COLOR.bg}`,
        minHeight: "100vh",
        fontFamily: FONT_BODY,
        color: COLOR.textPrimary,
      }}
      className="w-full flex items-center justify-center px-5 relative overflow-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .raiz-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
        .raiz-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(108,124,255,0.55); }
        .raiz-input { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .raiz-input:focus { outline: none; border-color: ${COLOR.peri} !important; box-shadow: 0 0 0 3px ${COLOR.periSoft}; }
      `}</style>

      {/* Motivo decorativo de raíces, muy sutil */}
      <svg
        aria-hidden="true"
        width="420" height="420" viewBox="0 0 420 420"
        style={{ position: "absolute", bottom: -60, left: "50%", transform: "translateX(-50%)", opacity: 0.05, pointerEvents: "none" }}
      >
        <path
          d="M210 40 V180 M210 180 C 150 210, 130 260, 90 320 M210 180 C 270 210, 290 260, 330 320 M210 180 C 180 220, 170 250, 150 300 M210 180 C 240 220, 250 250, 270 300"
          stroke={COLOR.peri} strokeWidth="2" fill="none" strokeLinecap="round"
        />
      </svg>

      <div
        className="w-full max-w-sm rounded-2xl p-7 relative"
        style={{
          background: COLOR.surface,
          border: `1px solid ${COLOR.hairline}`,
          boxShadow: "0 1px 2px rgba(0,0,0,0.4), 0 24px 48px -20px rgba(0,0,0,0.65)",
        }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontStyle: "italic", letterSpacing: 0.2 }}>Ledger</div>
        <p style={{ color: COLOR.textMuted, fontSize: 13.5, marginTop: 8, marginBottom: 24, lineHeight: 1.5 }}>
          Entra con tu correo. Te enviamos un enlace de acceso, sin contraseñas.
        </p>

        {estado === "enviado" ? (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: COLOR.mintSoft, color: COLOR.mint, border: "1px solid rgba(143,191,166,0.25)", lineHeight: 1.5 }}
          >
            Listo. Revisa tu correo <strong>{email}</strong> y haz clic en el enlace para entrar.
          </div>
        ) : (
          <form onSubmit={enviarEnlace} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="raiz-input rounded-xl px-3.5 py-3 text-sm"
              style={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, color: COLOR.textPrimary }}
            />
            <button
              type="submit"
              disabled={estado === "enviando"}
              className="raiz-btn rounded-xl px-3.5 py-3 text-sm font-medium"
              style={{ background: COLOR.peri, color: COLOR.bg, opacity: estado === "enviando" ? 0.7 : 1 }}
            >
              {estado === "enviando" ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
            {estado === "error" && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{ background: "rgba(201,144,137,0.12)", color: COLOR.coral, border: "1px solid rgba(201,144,137,0.25)" }}
              >
                {errorMsg}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}