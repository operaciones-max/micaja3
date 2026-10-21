"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";

export function LoginForm({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(error ? "Correo o PIN incorrecto" : null);
  const [loading, setLoading] = useState(false);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        pin: pin.trim(),
        redirect: false,
        callbackUrl: "/",
      });
      if (!res || res.error) {
        setLoginError("Correo o PIN incorrecto");
        return;
      }
      window.location.assign(res.url ?? "/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-sm p-8">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo size={48} />
          <span className="text-2xl font-bold tracking-wide text-foreground">Bia</span>
        </div>

        <h1 className="mb-1 text-center text-xl font-semibold text-foreground">MiCaja</h1>
        <p className="mb-6 text-center text-sm text-bia-gray-light">BIA Energy SAS ESP</p>

        {loginError ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-danger">⚠️ {loginError}</p>
          </div>
        ) : null}

        <form onSubmit={handlePinSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-bia-gray-light">
              Correo electrónico
            </Label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@bia.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-1 w-full rounded-xl border border-bia-gray/50 bg-bia-blue px-4 py-3 text-foreground placeholder:text-bia-gray focus:border-bia-aqua focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin" className="text-bia-gray-light">
              PIN
            </Label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="4 dígitos"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-xl border border-bia-gray/50 bg-bia-blue px-4 py-3 tracking-[0.25em] text-foreground placeholder:text-bia-gray focus:border-bia-aqua focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-bia-aqua py-3 font-bold text-bia-blue shadow-[0_8px_20px_rgba(0,0,0,0.22)] transition-all hover:bg-bia-aqua/90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Validando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
