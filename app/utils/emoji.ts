// ─── Recently Used (module-level so it survives across panel open/close) ─────

export let recentEmojis: string[] = [];
export function addToRecent(emoji: string) {
  recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
}
