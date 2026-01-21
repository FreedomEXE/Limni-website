"use client";

import { useSearchParams } from "next/navigation";

type LoginFormProps = {
  handleLogin: (formData: FormData) => void;
};

export default function LoginForm({ handleLogin }: LoginFormProps) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="w-full max-w-md rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)]/95 p-8 shadow-xl">
      <div className="mb-8 text-center">
        <img
          src="/limni-logo.svg"
          alt="Limni"
          className="mx-auto h-20 w-auto"
        />
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Navigating Markets with Intelligence
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Invalid username or password
        </div>
      )}

      <form action={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)]">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            required
            autoComplete="username"
            className="mt-1 block w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)]">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
