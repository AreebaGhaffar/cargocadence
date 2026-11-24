import "server-only";

const ORS_BASE = "https://api.openrouteservice.org";
const METERS_PER_MILE = 1609.344;

function authHeaders() {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error("ORS_API_KEY is not set");
  return { Authorization: key, "Content-Type": "application/json" };
}

async function geocode(address: string): Promise<[number, number]> {
  const text = address.trim().slice(0, 200);
  if (text.length < 3) throw new Error("Address is too short");

  const url = new URL(`${ORS_BASE}/geocode/search`);
  url.searchParams.set("text", text);
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("size", "1");

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const data = await res.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) throw new Error(`Could not find location: ${text}`);
  return [coords[0], coords[1]];
}

export async function getRoadMiles(pickup: string, dropoff: string) {
  const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);

  const res = await fetch(`${ORS_BASE}/v2/directions/driving-hgv`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ coordinates: [from, to] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);

  const data = await res.json();
  const meters = data.routes?.[0]?.summary?.distance;
  if (typeof meters !== "number") throw new Error("No route found");

  return {
    miles: Math.round((meters / METERS_PER_MILE) * 10) / 10,
    from,
    to,
  };
}