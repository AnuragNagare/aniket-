const TOKEN = /[A-Za-z0-9_-]{43}/;

/** Finds the invite token in a pasted link, a forwarded message or a bare token. */
export function extractInviteToken(text: string): string | null {
  const fromLink = /invite\/([A-Za-z0-9_-]{43})/.exec(text)?.[1];
  if (fromLink) return fromLink;
  const bare = text.trim();
  return bare.length === 43 && TOKEN.test(bare) ? bare : null;
}
