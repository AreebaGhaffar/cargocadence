"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 outline-none focus:border-blue-500";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-wide text-blue-500">CARGOCADENCE</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-neutral-400">Log in to manage your bookings.</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-neutral-300">Email</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-neutral-300">Password</label>
            <input id="password" name="password" type="password" placeholder="Your password" required className={inputClass} />
          </div>
          <button
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {pending ? "Logging in..." : "Log in"}
          </button>
        </form>

        {state?.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{state.error}</p>}

        <p className="mt-6 text-center text-sm text-neutral-400">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-blue-500 hover:underline">Register</Link>
        </p>
      </div>
    </main>
  );
}