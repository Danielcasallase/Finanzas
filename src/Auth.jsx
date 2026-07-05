import { useState } from "react";
import { supabase } from "./supabaseClient";

const COLOR = {
  bg: "#0C0F14",
  surface: "#12161D",
  surfaceAlt: "#171C24",
  hairline: "#232A34",
  textPrimary: "#E9ECF1",
  textMuted: "#7C8698",
  mint: "#8FBFA6",
  coral: "#C99089",
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
      options: { emailRedirectTo: window.location.origin },
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
      style={{ background: COLOR.bg, minHeight: "100vh", fontFamily: FONT_BODY, color: COLOR.textPrimary }}
      className="w-full flex items-center justify-center px-5"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      <div
        className="w-full max-w-sm rounded-xl p-6"
        style={{ background: COLOR.surface, border: `1px solid ${COLOR.hairline}` }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontStyle: "italic" }}>Raíz</div>
        <p style={{ color: COLOR.textMuted, fontSize: 13.5, marginTop: 6, marginBottom: 20 }}>
          Entra con tu correo. Te enviamos un enlace de acceso, sin contraseñas.
        </p>

        {estado === "enviado" ? (
          <div style={{ fontSize: 14, color: COLOR.mint }}>
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
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: COLOR.surfaceAlt, border: `1px solid ${COLOR.hairline}`, color: COLOR.textPrimary }}
            />
            <button
              type="submit"
              disabled={estado === "enviando"}
              className="rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{ background: COLOR.mint, color: "#08130E", opacity: estado === "enviando" ? 0.7 : 1 }}
            >
              {estado === "enviando" ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
            {estado === "error" && (
              <div style={{ fontSize: 12.5, color: COLOR.coral }}>{errorMsg}</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
