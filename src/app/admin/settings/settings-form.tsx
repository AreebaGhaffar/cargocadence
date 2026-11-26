"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "./actions";

export type SettingsValues = {
  company_name: string;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  support_hours: string | null;
  office_address: string | null;
};

const INITIAL_STATE: SettingsState = { ok: false, message: "", errors: {} };

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400";

export default function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, formAction, pending] = useActionState(updateSettings, INITIAL_STATE);

  function Field({
    name,
    label,
    defaultValue,
    placeholder,
    multiline,
  }: {
    name: keyof SettingsValues;
    label: string;
    defaultValue: string | null;
    placeholder?: string;
    multiline?: boolean;
  }) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-700">{label}</span>
        {multiline ? (
          <textarea
            name={name}
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            rows={3}
            className={inputClass}
          />
        ) : (
          <input
            name={name}
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            className={inputClass}
          />
        )}
        {state.errors[name] ? (
          <span className="text-sm text-red-600">{state.errors[name]}</span>
        ) : null}
      </label>
    );
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field name="company_name" label="Company name" defaultValue={values.company_name} />
      <Field
        name="support_email"
        label="Support email"
        defaultValue={values.support_email}
        placeholder="support@yourcompany.com"
      />
      <Field
        name="support_phone"
        label="Support phone"
        defaultValue={values.support_phone}
        placeholder="+1 555 123 4567"
      />
      <Field
        name="whatsapp_number"
        label="WhatsApp number"
        defaultValue={values.whatsapp_number}
        placeholder="+1 555 123 4567"
      />
      <Field
        name="support_hours"
        label="Support hours"
        defaultValue={values.support_hours}
        placeholder="Mon-Fri, 8am-6pm CST"
      />
      <Field
        name="office_address"
        label="Office address"
        defaultValue={values.office_address}
        multiline
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save settings"}
        </button>
        {state.message ? (
          <span className={state.ok ? "text-green-700" : "text-red-600"}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}