// Category Color Management System with localStorage persistence

// Predefined color palette for categories
const CATEGORY_COLOR_PALETTE = [
  '#6C60FF', // Purple (brand color) - for Personal
  '#10B981', // Green  
  '#3B82F6', // Blue - for Shared with
  '#047857', // Teal - for Published
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#F59E0B', // Yellow
  '#EC4899', // Pink
  '#14B8A6', // Teal-500
  '#A855F7', // Purple-500
  '#059669', // Emerald-600
];

// Shopify brand green. Single source of truth: the sidebar catalog box and the memories-page
// card badges both resolve to this, so they can never drift apart.
export const SHOPIFY_COLOR = '#95BF47';

// Cars catalog box accent color. Same single-source-of-truth reasoning as SHOPIFY_COLOR above.
export const CARS_COLOR = '#0EA5E9';

// Fixed colors for system categories
const SYSTEM_CATEGORY_COLORS: { [key: string]: string } = {
  'Unassigned': '#9CA3AF',   // Gray - for unassigned content
  'Personal': '#6C60FF',     // Purple (brand color)
  'Shared With': '#DC2626',  // Red - for Shared With
  'Published': '#9333EA',    // Emerald - for Published
  'Invites': '#EC4899',      // Pink - for Invites
  'Suggested': '#9CA3AF',    // Grey - for Suggested
  // Shopify is connector-owned, not user-created, so it gets a fixed brand colour rather than
  // a palette slot. Listed here (checked before localStorage) so it also overrides any colour
  // already auto-assigned and persisted for "Shopify" on existing installs.
  'Shopify': SHOPIFY_COLOR,
  // Cars is a read-only inventory feed, not a user-created category — same reasoning as Shopify.
  'Cars': CARS_COLOR,
};

// LocalStorage key for storing category colors
const CATEGORY_COLORS_KEY = 'stasht_category_colors';

// Interface for stored color data
interface StoredCategoryColors {
  [categoryName: string]: string;
}

/**
 * Get stored category colors from localStorage
 */
function getStoredColors(): StoredCategoryColors {
  try {
    const stored = localStorage.getItem(CATEGORY_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to parse stored category colors:', error);
    return {};
  }
}

/**
 * Save category colors to localStorage
 */
function saveColors(colors: StoredCategoryColors): void {
  try {
    localStorage.setItem(CATEGORY_COLORS_KEY, JSON.stringify(colors));
    console.log('💾 Saved category colors to localStorage:', colors);
  } catch (error) {
    console.error('Failed to save category colors to localStorage:', error);
  }
}

/**
 * Get next available color from palette, avoiding already used colors
 */
function getNextAvailableColor(usedColors: Set<string>): string {
  // Find first color from palette that's not used
  const availableColor = CATEGORY_COLOR_PALETTE.find(color => !usedColors.has(color));
  
  // If all colors are used, cycle back to start (shouldn't happen with 15 colors)
  return availableColor || CATEGORY_COLOR_PALETTE[0];
}

/**
 * Main function to get persistent category color
 */
export function getPersistentCategoryColor(categoryName: string): string {
  // Return system color if it exists
  if (SYSTEM_CATEGORY_COLORS[categoryName]) {
    return SYSTEM_CATEGORY_COLORS[categoryName];
  }

  // Get stored colors
  const storedColors = getStoredColors();
  
  // If category already has a stored color, return it
  if (storedColors[categoryName]) {
    console.log(`🎨 Using stored color for "${categoryName}":`, storedColors[categoryName]);
    return storedColors[categoryName];
  }

  // Assign new color for this category
  const usedColors = new Set([
    ...Object.values(SYSTEM_CATEGORY_COLORS),
    ...Object.values(storedColors)
  ]);
  
  const newColor = getNextAvailableColor(usedColors);
  
  // Save the new color
  storedColors[categoryName] = newColor;
  saveColors(storedColors);
  
  console.log(`🆕 Assigned new color to "${categoryName}":`, newColor);
  return newColor;
}

/**
 * Initialize colors for multiple categories at once
 * This is useful when loading categories from API
 */
export function initializeCategoryColors(categories: Array<{ name: string; color?: string }>): void {
  const storedColors = getStoredColors();
  let hasNewColors = false;
  
  const usedColors = new Set([
    ...Object.values(SYSTEM_CATEGORY_COLORS),
    ...Object.values(storedColors)
  ]);

  categories.forEach(category => {
    // Skip system categories
    if (SYSTEM_CATEGORY_COLORS[category.name]) {
      return;
    }

    // Skip if already has stored color
    if (storedColors[category.name]) {
      return;
    }

    // Use color from API if available
    if (category.color) {
      storedColors[category.name] = category.color;
      usedColors.add(category.color);
      hasNewColors = true;
      console.log(`🎨 Using API color for "${category.name}":`, category.color);
      return;
    }

    // Assign new color
    const newColor = getNextAvailableColor(usedColors);
    storedColors[category.name] = newColor;
    usedColors.add(newColor);
    hasNewColors = true;
    console.log(`🆕 Assigned new color to "${category.name}":`, newColor);
  });

  // Save all new colors at once
  if (hasNewColors) {
    saveColors(storedColors);
  }
}

/**
 * Get all stored category colors (for debugging)
 */
export function getAllStoredColors(): StoredCategoryColors {
  return { ...SYSTEM_CATEGORY_COLORS, ...getStoredColors() };
}

/**
 * Clear all stored colors (for testing/reset)
 */
export function clearStoredColors(): void {
  try {
    localStorage.removeItem(CATEGORY_COLORS_KEY);
    console.log('🗑️ Cleared all stored category colors');
  } catch (error) {
    console.error('Failed to clear stored category colors:', error);
  }
}

/**
 * Update existing category color (for category rename)
 */
export function updateCategoryColor(oldName: string, newName: string): void {
  // Don't update system categories
  if (SYSTEM_CATEGORY_COLORS[oldName] || SYSTEM_CATEGORY_COLORS[newName]) {
    return;
  }

  const storedColors = getStoredColors();
  
  if (storedColors[oldName]) {
    storedColors[newName] = storedColors[oldName];
    delete storedColors[oldName];
    saveColors(storedColors);
    console.log(`🔄 Updated category color from "${oldName}" to "${newName}":`, storedColors[newName]);
  }
}