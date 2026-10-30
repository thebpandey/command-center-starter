import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Assistant" };

async function Form({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const sp = await searchParams;
  return <LoginForm initialError={sp.error !== undefined} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  return (
    <main className="login-wrap">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-top">
          <div className="brand">
            <span className="brand-mark">A</span>
            <span className="brand-name">Assistant</span>
          </div>
          <ThemeToggle />
        </div>
        <div>
          <h1 id="login-title">Sign in</h1>
          <p className="muted">Command center</p>
        </div>
        <Suspense fallback={<div className="skeleton" style={{ height: 120 }} />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}
