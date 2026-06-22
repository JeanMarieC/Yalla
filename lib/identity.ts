// Deterministic avatar identity from a user id / email. Keeps avatars stable
// and meaningful without exposing the auth.users table to the client.

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function identityFor(userId: string, email?: string | null) {
  const initial = (email?.trim()?.[0] ?? userId[0] ?? "?").toUpperCase();
  return { initial, color: COLORS[hash(userId) % COLORS.length] };
}
