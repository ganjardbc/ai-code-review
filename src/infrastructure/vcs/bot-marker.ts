export const BOT_COMMENT_MARKER = '<!-- ai-code-review:bot -->';

export function withBotMarker(body: string): string {
  return `${body}\n${BOT_COMMENT_MARKER}`;
}

export function hasBotMarker(body: string): boolean {
  return body.includes(BOT_COMMENT_MARKER);
}
