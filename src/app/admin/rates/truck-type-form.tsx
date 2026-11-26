"use client";

import { useActionState } from "react";
import { createTruckType, updateTruckType } from "./actions";

type Truck = {
  id: string;
  name: string;
  base_fee: number;
  rate_per_mile: number;
  max_weight_lbs: number | null;
  active: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500";

export function TruckTypeForm({ truck }: { truck?: Truck }) {
  const [state, formAction, pending] = useActionState(
    truck ? updateTruckType : createTruckType,
    undefined
  );

  return (
    <form
      action={formAction}
      className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4"
    >
      {truck && <input type="hidden" name="id" value={truck.id} />}

      <label className="col-span-2 text-sm text-gray-700">
        Name
        <input name="name" defaultValue={truck?.name} required className={inputClass} />
      </label>
      <label className="text-sm text-gray-700">
        Base fee ($)
        <input name="baseFee" type="number" step="0.01" min="0" defaultValue={truck?.base_fee ?? 0} required className={inputClass} />
      </label>
      <label className="text-sm text-gray-700">
        Rate per mile ($)
        <input name="ratePerMile" type="number" step="0.01" min="0" defaultValue={truck?.rate_per_mile} required className={inputClass} />
      </label>
      <label className="text-sm text-gray-700">
        Max weight (lbs)
        <input name="maxWeightLbs" type="number" min="1" defaultValue={truck?.max_weight_lbs ?? ""} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input name="active" type="checkbox" defaultChecked={truck ? truck.active : true} />
        Active
      </label>
      <button
        disabled={pending}
        className="col-span-2 rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? "Saving..." : truck ? "Save changes" : "Add truck type"}
      </button>

      {state?.error && (
        <p className="col-span-full rounded-lg bg-red-500/10 p-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="col-span-full rounded-lg bg-green-500/10 p-2 text-sm text-green-700">Saved</p>
      )}
    </form>
  );
}