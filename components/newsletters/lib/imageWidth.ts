// An Image section's picture is drawn the card's full width (598 px), unless it is narrower than that: then it keeps its
// own width, centred, and is never stretched (review, 6 Nov). Studio measures the natural width when a picture is chosen
// (uploaded or pasted) and saves it as `width` only below 598; a picture saved without it (every older one) stays
// full-bleed. Same rule as the API (NewsletterContent::smallImageWidth). Pure.

/** The card's inner width (600 − 2 × 1 px border). */
export const IMAGE_FULL_WIDTH = 598;

/** A whole number of px from 1 to 597, else undefined (full-bleed). */
export function smallImageWidth(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value < IMAGE_FULL_WIDTH ? value : undefined;
}
