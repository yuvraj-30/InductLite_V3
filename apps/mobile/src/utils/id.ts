export function createEventId(prefix: string): string {
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${ts}-${random}`;
}
