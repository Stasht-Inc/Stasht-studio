// A car's `category` comes straight from the inventory import ("preowned", "hybrid", …).
// Label it the way the Studio sidebar and the app's Campaigns screen do — "Preowned",
// "Hybrid" — so the same category never has two spellings.
export function formatCarCategory(raw: string): string {
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
