// Shared time formatting for events (stored UTC -> readable local).

export function formatEventWhen(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const day: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString([], day)} · ${start.toLocaleTimeString([], time)}–${end.toLocaleTimeString([], time)}`;
  }
  return `${start.toLocaleDateString([], day)} ${start.toLocaleTimeString([], time)} → ${end.toLocaleDateString([], day)} ${end.toLocaleTimeString([], time)}`;
}
