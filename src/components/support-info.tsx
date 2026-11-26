import { createClient } from "@/lib/supabase/server";

type Settings = {
  company_name: string;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  support_hours: string | null;
  office_address: string | null;
};

function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

function whatsappHref(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function SupportInfo({
  variant,
}: {
  variant: "card" | "footer";
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select(
      "company_name, support_email, support_phone, whatsapp_number, support_hours, office_address"
    )
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;
  const s = data as Settings;

  const whatsapp = s.whatsapp_number ? whatsappHref(s.whatsapp_number) : null;

  const hasContact = Boolean(
    s.support_email ||
      s.support_phone ||
      s.whatsapp_number ||
      s.support_hours ||
      s.office_address
  );

  const items = (
    <ul className="flex flex-col gap-1 text-sm">
      {s.support_email ? (
        <li>
          Email:{" "}
          <a className="text-blue-600 hover:underline" href={`mailto:${s.support_email}`}>
            {s.support_email}
          </a>
        </li>
      ) : null}
      {s.support_phone ? (
        <li>
          Phone:{" "}
          <a className="text-blue-600 hover:underline" href={phoneHref(s.support_phone)}>
            {s.support_phone}
          </a>
        </li>
      ) : null}
      {s.whatsapp_number ? (
        <li>
          WhatsApp:{" "}
          {whatsapp ? (
            <a
              className="text-blue-600 hover:underline"
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.whatsapp_number}
            </a>
          ) : (
            s.whatsapp_number
          )}
        </li>
      ) : null}
      {s.support_hours ? <li>Hours: {s.support_hours}</li> : null}
      {s.office_address ? <li className="whitespace-pre-line">Address: {s.office_address}</li> : null}
    </ul>
  );

  if (variant === "card") {
    if (!hasContact) return null;
    return (
      <section className="rounded-lg border border-gray-300 p-4">
        <h2 className="mb-2 text-lg font-semibold">Need help?</h2>
        {items}
      </section>
    );
  }

  return (
    <footer className="mt-8 border-t border-gray-200 px-6 py-6 text-gray-600">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <p className="font-semibold text-gray-900">{s.company_name}</p>
        {hasContact ? items : null}
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} {s.company_name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}