"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="rounded border p-2 text-black" />
        <input name="password" type="password" placeholder="Password" required className="rounded border p-2 text-black" />
        <button disabled={pending} className="rounded bg-blue-600 p-2 font-semibold text-white disabled:opacity-50">
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <p className="text-sm">
        No account yet? <Link href="/register" className="underline">Register</Link>
      </p>
    </main>
  );
}