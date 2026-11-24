"use client";

import { useActionState } from "react";
import { createSurcharge, updateSurcharge } from "./actions";

type Surcharge = {
  id: string;
  name: string;
  kind: "flat" | "percent";
  amount: number;
  active: boolean;
  applies_when: "always" | "weekend" | "manual";
};

const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-blue-500";

export function SurchargeForm({ surcharge }: { surcharge?: Surcharge }) {
  const [state, formAction, pending] = useActionState(
    surcharge ? updateSurcharge : createSurcharge,
    undefined
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 md:grid-cols-4"
    >
      {surcharge && <input type="hidden" name="id" value={surcharge.id} />}

      <label className="col-span-2 text-sm text-neutral-300">
        Name
        <input name="name" defaultValue={surcharge?.name} required className={inputClass} />
      </label>
      <label className="text-sm text-neutral-300">
        Type
        <select name="kind" defaultValue={surcharge?.kind ?? "flat"} className={inputClass}>
          <option value="flat">Flat ($)</option>
          <option value="percent">Percent (%)</option>
        </select>
      </label>
      <label className="text-sm text-neutral-300">
        Amount
        <input name="amount" type="number" step="0.01" min="0" defaultValue={surcharge?.amount} required className={inputClass} />
      </label>
      <label className="col-span-2 text-sm text-neutral-300">
        Applies when
        <select name="appliesWhen" defaultValue={surcharge?.applies_when ?? "manual"} className={inputClass}>
          <option value="always">Always (every booking)</option>
          <option value="weekend">Weekend pickup</option>
          <option value="manual">Manual (admin adds it)</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input name="active" type="checkbox" defaultChecked={surcharge ? surcharge.active : true} />
        Active
      </label>
      <button
        disabled={pending}
        className="col-span-2 rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? "Saving..." : surcharge ? "Save changes" : "Add surcharge"}
      </button>

      {state?.error && (
        <p className="col-span-full rounded-lg bg-red-500/10 p-2 text-sm text-red-400">{state.error}</p>
      )}
      {state?.ok && (
        <p className="col-span-full rounded-lg bg-green-500/10 p-2 text-sm text-green-400">Saved</p>
      )}
    </form>
  );
}