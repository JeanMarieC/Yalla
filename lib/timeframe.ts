// Phase 11 — Deterministic timeframe resolution (REAL systems, not the LLM).
// The model only CLASSIFIES the phrase ("July", "this weekend", "now") into a
// RawTimeframe; this turns that into concrete ISO dates. Date math stays here.

export interface RawTimeframe {
  kind: "none" | "now" | "today" | "weekend" | "month" | "date_range" | "relative";
  text: string;
  month?: string | null; // e.g. "July"
  startDate?: string | null; // ISO if the model extracted explicit dates
  endDate?: string | null;
}

export interface ResolvedTimeframe {
  label: string; // human-friendly, e.g. "this weekend" or "Jul 2026"
  start: string | null; // ISO datetime (inclusive)
  end: string | null; // ISO datetime (inclusive-ish, end of day)
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

export function resolveTimeframe(
  raw: RawTimeframe | null | undefined,
  now = new Date(),
): ResolvedTimeframe {
  if (!raw || raw.kind === "none") {
    return { label: "", start: null, end: null };
  }

  switch (raw.kind) {
    case "now":
    case "today":
      return {
        label: raw.text || "today",
        start: startOfDay(now).toISOString(),
        end: endOfDay(now).toISOString(),
      };

    case "weekend": {
      // Upcoming Sat–Sun (or this one if it's already the weekend).
      const day = now.getDay(); // 0 Sun … 6 Sat
      const daysUntilSat = day === 0 ? 6 : day === 6 ? 0 : 6 - day;
      const sat = startOfDay(new Date(now));
      sat.setDate(now.getDate() + daysUntilSat);
      const sun = endOfDay(new Date(sat));
      sun.setDate(sat.getDate() + 1);
      return { label: "this weekend", start: sat.toISOString(), end: sun.toISOString() };
    }

    case "month": {
      const idx = MONTHS.indexOf((raw.month ?? "").trim().toLowerCase());
      if (idx === -1) return { label: raw.text, start: null, end: null };
      // This year if the month hasn't fully passed, else next year.
      const year = idx < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      const start = new Date(year, idx, 1, 0, 0, 0);
      const end = new Date(year, idx + 1, 0, 23, 59, 59); // last day of month
      const label = `${MONTHS[idx][0].toUpperCase()}${MONTHS[idx].slice(1)} ${year}`;
      return { label, start: start.toISOString(), end: end.toISOString() };
    }

    case "date_range":
      return {
        label: raw.text,
        start: raw.startDate ?? null,
        end: raw.endDate ?? null,
      };

    case "relative":
    default:
      // Best effort: keep the human label, leave dates open.
      return { label: raw.text, start: null, end: null };
  }
}
