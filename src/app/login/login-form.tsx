"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="stack" role="status">
        <h2>Check your email</h2>
        <p className="muted">If that address can sign in, a link is on its way. It expires in one hour.</p>
      </div>
    );
  }

  return (
    <form action={action} className="stack" noValidate>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" name="email" autoComplete="email" required inputMode="email" />
      </label>
      {state.status === "invalid" && <p className="form-error" role="alert">Enter a valid email address.</p>}
      {state.status === "error" && <p className="form-error" role="alert">Could not send the link. Try again in a minute.</p>}
      {initialError && state.status === "idle" && (
        <p className="form-error" role="alert">That sign-in link is invalid or expired. Request a new one.</p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
