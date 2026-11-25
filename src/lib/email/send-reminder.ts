import "server-only";
import { Resend } from "resend";

export type ReminderBooking = {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string;
  pickup_timezone: string | null;
  cargo_description: string;
  cargo_weight_lbs: number | null;
  status: string;
  final_total: number | string | null;
  estimated_total: number | string | null;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_NOTIFY_EMAIL);
}

// Customer text goes into HTML email, so it must be escaped
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

function formatTime(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...TIME_FORMAT,
      timeZone: timeZone || "UTC",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...TIME_FORMAT, timeZone: "UTC" }).format(date);
  }
}

function formatMoney(b: ReminderBooking): string {
  const n = Number(b.final_total ?? b.estimated_total);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export async function sendReminderEmail(bookings: ReminderBooking[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("Email is not configured");
  }
  const from = process.env.RESEND_FROM_EMAIL || "CargoCadence <onboarding@resend.dev>";

  const count = bookings.length;
  const subject = `Pickup reminder: ${count} upcoming pickup${count === 1 ? "" : "s"}`;

  const textBlocks = bookings.map(
    (b) =>
      [
        `${b.pickup_location} -> ${b.dropoff_location}`,
        `Pickup: ${formatTime(b.pickup_at, b.pickup_timezone)}`,
        `Cargo: ${b.cargo_description}${b.cargo_weight_lbs ? ` (${b.cargo_weight_lbs} lbs)` : ""}`,
        `Status: ${b.status} | Total: ${formatMoney(b)}`,
        `Booking ID: ${b.id}`,
      ].join("\n")
  );

  const htmlBlocks = bookings.map(
    (b) => `
      <div style="margin:0 0 16px;padding:12px;border:1px solid #ddd;border-radius:6px">
        <p style="margin:0 0 4px"><strong>${escapeHtml(b.pickup_location)} &rarr; ${escapeHtml(b.dropoff_location)}</strong></p>
        <p style="margin:0">Pickup: ${escapeHtml(formatTime(b.pickup_at, b.pickup_timezone))}</p>
        <p style="margin:0">Cargo: ${escapeHtml(b.cargo_description)}${b.cargo_weight_lbs ? ` (${b.cargo_weight_lbs} lbs)` : ""}</p>
        <p style="margin:0">Status: ${escapeHtml(b.status)} &middot; Total: ${escapeHtml(formatMoney(b))}</p>
        <p style="margin:0;color:#666;font-size:12px">Booking ID: ${escapeHtml(b.id)}</p>
      </div>`
  );

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    text: `Upcoming pickups:\n\n${textBlocks.join("\n\n")}`,
    html: `<div style="font-family:Arial,sans-serif"><h2>Upcoming pickups</h2>${htmlBlocks.join("")}</div>`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}