// A count with its noun, as English reads it: "1 property", "2 properties", "1,234 users" (Chris, 1 Nov 2026: the
// Users page said "1 properties"). `many` defaults to `one` + "s".
export function countLabel(n: unknown, one: string, many: string = `${one}s`): string {
  const value = Number(n);
  const count = Number.isFinite(value) ? value : 0;
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}
