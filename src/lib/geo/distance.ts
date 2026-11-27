import "server-only";

// HeiGIT moved the API from api.openrouteservice.org (shut down in Nov 2026)
// to api.heigit.org. The same API key works on the new address.
const GEOCODE_URL = "https://api.heigit.org/pelias/v1/search";
const DIRECTIONS_URL =
  "https://api.heigit.org/openrouteservice/v2/directions/driving-hgv";
const METERS_PER_MILE = 1609.344;

function apiKey() {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new Error("ORS_API_KEY is not set");
  return key;
}

async function geocode(address: string): Promise<[number, number]> {
  const text = address.trim().slice(0, 200);
  if (text.length < 3) throw new Error("Address is too short");

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("text", text);
  url.searchParams.set("boundary.country", "US");
  url.searchParams.set("size", "1");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const data = await res.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) throw new Error(`Could not find location: ${text}`);
  return [coords[0], coords[1]];
}

export async function getRoadMiles(pickup: string, dropoff: string) {
  const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);

  const res = await fetch(DIRECTIONS_URL, {
    method: "POST",
    headers: { Authorization: apiKey(), "Content-Type": "application/json" },
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