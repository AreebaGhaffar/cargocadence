export type PricedTruck = {
  name: string;
  base_fee: number;
  rate_per_mile: number;
};

export type PricedSurcharge = {
  name: string;
  kind: "flat" | "percent";
  amount: number;
};

export type EstimateLine = { label: string; amount: number };
export type Estimate = { lines: EstimateLine[]; total: number };

// All math is done in whole cents to avoid floating point errors
const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => cents / 100;

export function calculateEstimate(input: {
  truck: PricedTruck;
  miles: number;
  surcharges: PricedSurcharge[];
}): Estimate {
  const { truck, miles, surcharges } = input;

  const baseCents = toCents(truck.base_fee);
  const mileageCents = Math.round(miles * toCents(truck.rate_per_mile));
  const subtotalCents = baseCents + mileageCents;

  const lines: { label: string; cents: number }[] = [
    { label: `${truck.name} base fee`, cents: baseCents },
    {
      label: `Mileage (${miles} mi at $${truck.rate_per_mile.toFixed(2)}/mi)`,
      cents: mileageCents,
    },
  ];

  let totalCents = subtotalCents;
  for (const s of surcharges) {
    const cents =
      s.kind === "percent"
        ? Math.round((subtotalCents * s.amount) / 100)
        : toCents(s.amount);
    lines.push({
      label: s.kind === "percent" ? `${s.name} (${s.amount}%)` : s.name,
      cents,
    });
    totalCents += cents;
  }

  return {
    lines: lines.map((l) => ({ label: l.label, amount: toDollars(l.cents) })),
    total: toDollars(totalCents),
  };
}