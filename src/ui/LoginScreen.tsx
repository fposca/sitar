// src/ui/LoginScreen.tsx
import React from "react";
import { useAuth } from "../auth/AuthProvider";
import neonboyLogo from "../assets/neonboy.png";

const LoginScreen: React.FC = () => {
  const { loginWithGoogle } = useAuth();

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      alert("Error al iniciar sesión con Google");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 40% 20%, #1e1b4b 0%, #0f172a 40%, #020617 80%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(10, 14, 34, 0.92)",
          padding: "2rem 1.7rem",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
        }}
      >
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: "1.3rem" }}>
          <img
            src={neonboyLogo}
            alt="NeonBoy"
            style={{
              width: "70%",
              filter: "drop-shadow(0 0 12px #ff00ff88)",
            }}
          />
        </div>

        {/* TITULO */}
        <h1
          style={{
            fontSize: "1.6rem",
            textAlign: "center",
            marginBottom: "0.5rem",
            color: "#f472b6",
            textShadow: "0 0 12px #db2777aa",
          }}
        >
          Welcome to NEON SITAR LAB
        </h1>

        {/* SUBTITULO */}
        <p
          style={{
            fontSize: "0.85rem",
            textAlign: "center",
            marginBottom: "1.5rem",
            color: "#9ca3af",
          }}
        >
          Ingresá con tu cuenta de Google para acceder al pedal místico Neon Sitar.
        </p>

        {/* BOTON LOGIN */}
        <button
          type="button"
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "0.7rem 1rem",
            borderRadius: 999,
            border: "none",
            background: "#f97316",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            boxShadow: "0 0 18px rgba(249,115,22,0.7)",
          }}
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            style={{ width: 18, height: 18 }}
          />
          Entrar con Google
        </button>

        {/* LEYENDA */}
        <p
          style={{
            marginTop: "1.4rem",
            fontSize: "0.7rem",
            color: "#6b7280",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          No almacenamos contraseñas.  
          Solo se valida tu identidad mediante Google de forma segura.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
