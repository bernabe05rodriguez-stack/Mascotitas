'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { PawPrint, Loader2 } from 'lucide-react';
import { loginAction, type ActionResult } from '../actions';

const initial: ActionResult = { ok: false };

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <PawPrint className="h-7 w-7 text-accent" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-navy">Panel Mascotitas</h1>
        </div>

        <form action={formAction} className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-card">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">
              Usuario
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-navy focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-navy focus:border-accent focus:outline-none"
            />
          </div>

          {state.error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Entrar
    </button>
  );
}
