const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(raw: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw);

  if (!match) {
    throw new Error(`Invalid duration: ${raw}`);
  }

  const valueRaw = match[1];
  const unit = match[2];

  if (valueRaw === undefined || unit === undefined) {
    throw new Error(`Invalid duration: ${raw}`);
  }

  const factor = UNIT_MS[unit];

  if (factor === undefined) {
    throw new Error(`Invalid duration: ${raw}`);
  }

  return Number(valueRaw) * factor;
}
