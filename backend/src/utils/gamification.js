/** Course level from XP (every 200 XP → +1 level, cap 99). */
export function courseLevelFromXp(xp) {
  const n = Math.floor((xp || 0) / 200) + 1;
  return Math.min(99, Math.max(1, n));
}

const REFILL_MS = 30 * 60 * 1000; // +1 energy every 30 minutes

/**
 * @param {{ energy?: number; max_energy?: number; last_energy_refill_at?: string }} row
 * @returns {{ energy: number; last_energy_refill_at: string }}
 */
export function computeEnergyAfterRefill(row) {
  const max = row.max_energy ?? 5;
  let energy = row.energy ?? max;
  const last = new Date(row.last_energy_refill_at || Date.now()).getTime();
  const now = Date.now();
  let t = last;
  while (energy < max && now - t >= REFILL_MS) {
    energy += 1;
    t += REFILL_MS;
  }
  return { energy, last_energy_refill_at: new Date(t).toISOString() };
}

export function normalizeAnswer(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase();
}

/** expected is often "A"–"D" or the full correct option text */
export function answerMatches(expected, given, options) {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (e && g && e === g) return true;
  if (options && e.length === 1 && /^[A-D]$/i.test(e)) {
    const idx = e.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    if (idx >= 0 && idx < options.length && normalizeAnswer(options[idx]) === g) return true;
  }
  if (options?.length) {
    for (const opt of options) {
      if (normalizeAnswer(opt) === g && normalizeAnswer(opt) === e) return true;
    }
  }
  return false;
}
