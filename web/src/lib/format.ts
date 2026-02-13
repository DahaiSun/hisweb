export function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthDay(value: string) {
  const [m, d] = value.split("-").map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(m) || !Number.isFinite(d)) return value;
  const date = new Date(Date.UTC(2000, m - 1, d));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
