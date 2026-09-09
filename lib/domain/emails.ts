/** За одну отправку — не больше, чем успевает уйти в пределах запроса. */
export const MAX_INVITES_PER_BATCH = 20;

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(raw: string) {
  const parts = raw
    .split(/[\n,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    if (!LOOKS_LIKE_EMAIL.test(part)) {
      if (!invalid.includes(part)) invalid.push(part);
    } else if (!emails.includes(part)) {
      emails.push(part);
    }
  }
  return { emails, invalid };
}
