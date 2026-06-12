import { Lock, FolderOpen, Users, Globe } from "lucide-react";
import { ExistingMemory } from "../types/mediaTypes";
import { getPersistentCategoryColor } from "../utils/categoryColorManager";

// Predefined color palette for categories
const categoryColors = [
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
];

// Category color mapping using persistent color system
export const getCategoryColor = (category: string, categories?: any[]): string => {
  // Use persistent color manager for consistent colors across refreshes
  return getPersistentCategoryColor(category);
};

// Category icon mapping
export const getCategoryIcon = (category: string) => {
  const iconMap: { [key: string]: any } = {
    'Personal': Lock,
    'Shared With': Users,
    'Published': Globe,
  };
  
  return iconMap[category] || FolderOpen;
};

// Label color mapping for consistent styling - all labels use yellow to match Stasht UI kit
export const getLabelColor = (label: string): string => {
  // All labels use consistent yellow color to match Stasht UI kit
  return '#EAB308'; // Yellow-500 - consistent yellow for all labels
};

// Sample existing memories organized by category with thumbnails
export const existingMemories: ExistingMemory[] = [
  // Personal memories
  { 
    id: "mem_1", 
    title: "Family Vacation 2024", 
    category: "Personal", 
    mediaCount: 12, 
    createdDate: "2024-07-15", 
    description: "Summer family trip to Europe",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_2", 
    title: "Birthday Celebration", 
    category: "Personal", 
    mediaCount: 8, 
    createdDate: "2024-08-01", 
    description: "Dad's 60th birthday party",
    thumbnail: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_6", 
    title: "Wedding Anniversary", 
    category: "Personal", 
    mediaCount: 15, 
    createdDate: "2024-06-20", 
    description: "20th wedding anniversary celebration",
    thumbnail: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_10", 
    title: "Kids' School Events", 
    category: "Personal", 
    mediaCount: 6, 
    createdDate: "2024-05-10", 
    description: "Spring school performances",
    thumbnail: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop"
  },
  
  // Shared With memories
  { 
    id: "mem_4", 
    title: "Corporate Team Meeting", 
    category: "Shared With", 
    mediaCount: 5, 
    createdDate: "2024-07-25", 
    description: "Q3 planning session",
    thumbnail: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_13", 
    title: "Client Presentation", 
    category: "Shared With", 
    mediaCount: 8, 
    createdDate: "2024-07-30", 
    description: "Product demo for enterprise client",
    thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_14", 
    title: "Team Building Day", 
    category: "Shared With", 
    mediaCount: 20, 
    createdDate: "2024-06-15", 
    description: "Annual company retreat",
    thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_15", 
    title: "Conference Highlights", 
    category: "Shared With", 
    mediaCount: 12, 
    createdDate: "2024-08-05", 
    description: "Tech conference presentations",
    thumbnail: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=400&fit=crop"
  },
  
  // Published memories
  { 
    id: "mem_5", 
    title: "London Architecture Study", 
    category: "Published", 
    mediaCount: 30, 
    createdDate: "2024-06-30", 
    description: "Modern and historic architecture comparison",
    thumbnail: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_16", 
    title: "Travel Photography Series", 
    category: "Published", 
    mediaCount: 40, 
    createdDate: "2024-07-20", 
    description: "European cities photo collection",
    thumbnail: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=400&fit=crop"
  },
  { 
    id: "mem_17", 
    title: "Nature Documentation", 
    category: "Published", 
    mediaCount: 28, 
    createdDate: "2024-05-25", 
    description: "Local wildlife and landscapes",
    thumbnail: "https://images.unsplash.com/photo-1464822759844-d150baec0494?w=400&h=400&fit=crop"
  },
];