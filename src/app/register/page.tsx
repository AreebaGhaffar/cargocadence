"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/app/auth/actions";

const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500 outline-none focus:border-blue-500";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-wide text-blue-500">CARGOCADENCE</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">Book trucks in minutes with our AI assistant.</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm text-neutral-300">Full name</label>
            <input id="fullName" name="fullName" placeholder="John Smith" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-neutral-300">Email</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-neutral-300">Password</label>
            <input id="password" name="password" type="password" placeholder="At least 8 characters" required className={inputClass} />
          </div>
          <button
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {pending ? "Creating account..." : "Register"}
          </button>
        </form>

        {state?.error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{state.error}</p>}
        {state?.message && <p className="mt-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">{state.message}</p>}

        <p className="mt-6 text-center text-sm text-neutral-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-500 hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}