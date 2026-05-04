"use client";

import { FormEvent, useState } from "react";

type Props = {
  onSuccess: () => void;
};

export default function LoginPage({ onSuccess }: Props) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("ops:auth", "1");
        onSuccess();
      } else {
        setError(data.error ?? "Credenciales incorrectas");
      }
    } catch {
      setError("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "2.5rem 2rem",
        width: "100%",
        maxWidth: "360px",
        boxShadow: "0 4px 24px rgba(0,0,0,.08)",
      }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <div style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.5px",
            marginBottom: "0.25rem",
          }}>
            MisPichos
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Dashboard Operaciones
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Usuario
            </label>
            <input
              type="text"
              autoComplete="username"
              value={user}
              onChange={e => setUser(e.target.value)}
              required
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface2)",
                color: "var(--text)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: "0.83rem",
              color: "var(--bad)",
              background: "var(--badBg)",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.25rem",
              padding: "0.65rem",
              borderRadius: "8px",
              border: "none",
              background: "var(--info)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 150ms",
            }}
          >
            {loading ? "Verificando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
