"use client";

import { useActionState } from "react";
import { approveBooking, cancelBooking } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500";

export function BookingActions({
  id,
  status,
  estimatedTotal,
}: {
  id: string;
  status: string;
  estimatedTotal: number | null;
}) {
  const [state, formAction, pending] = useActionState(approveBooking, undefined);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4">
      {status === "pending_approval" && (
        <form action={formAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="id" value={id} />
          <label className="text-sm text-gray-700">
            Final total ($)
            <input
              name="finalTotal"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={estimatedTotal ?? ""}
              required
              className={inputClass}
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Note for the customer (optional)
            <input name="adminNotes" maxLength={500} className={inputClass} />
          </label>
          <button
            disabled={pending}
            className="rounded-lg bg-green-600 py-2 font-semibold text-white hover:bg-green-500 disabled:opacity-50 md:col-span-3"
          >
            {pending ? "Approving..." : "Approve deal"}
          </button>
          {state?.error && (
            <p className="rounded-lg bg-red-500/10 p-2 text-sm text-red-600 md:col-span-3">
              {state.error}
            </p>
          )}
        </form>
      )}

      {["quoted", "pending_approval", "confirmed"].includes(status) && (
        <form
          action={cancelBooking}
          onSubmit={(e) => {
            if (!confirm("Cancel this booking?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button className="rounded-lg ">
            Cancel booking
          </button>
        </form>
      )}
    </div>
  );
}