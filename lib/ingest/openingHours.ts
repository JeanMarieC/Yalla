// Phase 14.2 — opening_hours parser.
//
// OSM stores hours as a compact string ("Mo-Fr 09:00-17:00; Sa 10:00-14:00",
// "24/7", "Tu-Su 12:00-15:00,19:00-23:00"). We normalize the COMMON cases into a
// per-day shape the planner can read, and expose isOpenAt() for scheduling.
//
// This is a pragmatic subset of the full opening_hours spec — enough for real
// café/bar/restaurant data. Anything we can't parse returns null ("unknown"),
// and the planner treats unknown leniently rather than dropping the place.

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Normalized weekly hours. Each day is a list of [open,close] "HH:MM" ranges. */
export interface WeeklyHours {
  mon: [string, string][];
  tue: [string, string][];
  wed: [string, string][];
  thu: [string, string][];
  fri: [string, string][];
  sat: [string, string][];
  sun: [string, string][];
  /** True for 24/7 — every day fully open. */
  alwaysOpen: boolean;
}

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const OSM_DAY: Record<string, number> = {
  Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6,
};

function emptyWeek(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [], alwaysOpen: false };
}

function pad(t: string): string {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

// "Mo-Fr", "Mo,We,Fr", "Sa" -> day indices [0..6]. Handles wrap (Fr-Mo).
function expandDays(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const range = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su)$/);
    if (range) {
      let a = OSM_DAY[range[1]];
      const b = OSM_DAY[range[2]];
      // inclusive, wrapping forward
      while (true) {
        out.add(a);
        if (a === b) break;
        a = (a + 1) % 7;
      }
    } else {
      const single = part.trim();
      if (single in OSM_DAY) out.add(OSM_DAY[single]);
    }
  }
  return [...out];
}

// "09:00-17:00,19:00-23:00" -> [["09:00","17:00"],["19:00","23:00"]]
function parseRanges(s: string): [string, string][] {
  const ranges: [string, string][] = [];
  const re = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    ranges.push([pad(m[1]), pad(m[2])]);
  }
  return ranges;
}

/**
 * Parse an OSM opening_hours string into normalized weekly hours.
 * Returns null when the string is empty or we can't make sense of it.
 */
export function parseOpeningHours(raw: string | null | undefined): WeeklyHours | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const wk = emptyWeek();

  if (/^24\s*\/\s*7$/.test(s) || /^24x7$/i.test(s)) {
    for (const d of DAY_KEYS) wk[d] = [["00:00", "24:00"]];
    wk.alwaysOpen = true;
    return wk;
  }

  let matched = false;
  for (const ruleRaw of s.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;

    // Leading day specifier, if any (else the rule applies to all days).
    const dayMatch = rule.match(
      /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\b/,
    );
    const days = dayMatch ? expandDays(dayMatch[1]) : [0, 1, 2, 3, 4, 5, 6];
    const rest = (dayMatch ? rule.slice(dayMatch[0].length) : rule).trim();

    // Holiday-only rules (PH/SH) — ignore for a normal week.
    if (/^(PH|SH)\b/.test(rest)) continue;

    if (/\b(off|closed)\b/i.test(rest)) {
      for (const d of days) wk[DAY_KEYS[d]] = [];
      matched = true;
      continue;
    }

    const ranges = parseRanges(rest);
    if (ranges.length === 0) continue;
    for (const d of days) wk[DAY_KEYS[d]].push(...ranges);
    matched = true;
  }

  return matched ? wk : null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Is the venue open at (day, "HH:MM")?
 * - Unknown hours (null) => true: we don't penalize places we lack data for.
 * - Handles overnight ranges (e.g. 18:00–02:00) including spill from the
 *   previous day.
 */
export function isOpenAt(
  hours: WeeklyHours | null | undefined,
  day: DayKey,
  hhmm: string,
): boolean {
  if (!hours) return true; // unknown — lenient
  if (hours.alwaysOpen) return true;

  const t = toMinutes(hhmm);
  const idx = DAY_KEYS.indexOf(day);

  // Same-day ranges.
  for (const [open, close] of hours[day]) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c > o) {
      if (t >= o && t < c) return true;
    } else {
      // overnight (close past midnight): open if at/after open OR before close
      if (t >= o || t < c) return true;
    }
  }

  // Spill from the previous day's overnight range.
  const prev = DAY_KEYS[(idx + 6) % 7];
  for (const [open, close] of hours[prev]) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c <= o && t < c) return true; // we're in the early-morning tail
  }

  return false;
}
