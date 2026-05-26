"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import assembleMindLogo from "@/assets/logo-assemblemind.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginFeatures = [
  {
    title: "Versioned mask edits",
    description: "Track every committed mask version without overwriting model predictions.",
  },
  {
    title: "Core handoff compatible",
    description: "Open correction handoffs from SaPen Core with scoped context.",
  },
  {
    title: "Audit-ready corrections",
    description: "Keep prediction, expert refinement, and review state clearly separated.",
  },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nextUrl = params.get("next") ?? "/app";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, next: nextUrl }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Login failed");
        setIsLoading(false);
        return;
      }

      router.replace(typeof data?.redirectTo === "string" ? data.redirectTo : "/app");
      router.refresh();
    } catch {
      setError("Network error");
      setIsLoading(false);
    }
  }

  return (
    <div className="dark flex min-h-dvh flex-col bg-[var(--app-background)] text-[var(--text-primary)]">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--shell-topbar-bg)] px-4 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--brand)] text-sm font-semibold text-[var(--brand-contrast)]"
          >
            S
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
              SaPen Annotate
            </div>
            <div className="truncate text-xs text-[var(--text-muted)]">
              Ground-truth workspace
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 md:px-6">
        <section
          aria-labelledby="login-title"
          className="grid w-full max-w-[840px] overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--workspace-surface)] shadow-[var(--shadow-login-panel)] md:grid-cols-[1fr_0.96fr]"
        >
          <div className="border-b border-[var(--divider-subtle)] bg-[var(--workspace-subtle)] p-6 md:border-b-0 md:border-r md:p-8">
            <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
              SaPen Annotate
            </p>
            <h1
              id="login-title"
              className="mt-5 text-3xl font-semibold leading-tight text-[var(--text-primary)]"
            >
              Workspace Access
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Expert correction and annotation workspace for segmentation masks.
            </p>

            <div className="mt-8 space-y-5">
              {loginFeatures.map((feature) => (
                <div key={feature.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 shrink-0 rounded-full bg-[var(--accent-primary)]"
                  />
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      {feature.title}
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--workspace-surface-strong)] p-6 md:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                Secure sign in
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Use your assigned SaPen account.
              </p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-[var(--text-secondary)]">
                  Email
                </Label>
                <Input
                  id="login-email"
                  name="email"
                  className="h-10 rounded-sm border-[var(--border-default)] bg-[var(--workspace-input-background)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="login-password" className="text-[var(--text-secondary)]">
                    Password
                  </Label>
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-[var(--text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    onClick={() => {
                      setError(null);
                      setNotice("Password reset is not available yet.");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  name="password"
                  className="h-10 rounded-sm border-[var(--border-default)] bg-[var(--workspace-input-background)] text-[var(--text-primary)] focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-sm border border-[var(--border-warning)] bg-[var(--warning-surface)] px-3 py-2 text-sm text-[var(--warning-text)]"
                >
                  {error}
                </div>
              ) : null}

              {notice ? (
                <div
                  role="status"
                  className="rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  {notice}
                </div>
              ) : null}

              <Button
                className="h-10 w-full rounded-sm border border-[var(--border-default)] bg-[var(--accent-primary)] text-[var(--brand-contrast)] hover:bg-[var(--accent-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </section>
      </main>

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-4 border-t border-[var(--border-subtle)] bg-[var(--shell-topbar-bg)] px-4 py-2 text-xs text-[var(--text-muted)] md:px-5">
        <span>© 2026 SaPen Systems.</span>
        <span className="inline-flex items-center gap-2">
          <span>powered by</span>
          <Image
            src={assembleMindLogo}
            alt="assembleMIND"
            width={86}
            height={20}
            className="h-4 w-auto opacity-75 invert"
          />
        </span>
      </footer>
    </div>
  );
}
