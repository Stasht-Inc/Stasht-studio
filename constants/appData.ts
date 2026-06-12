import { Category, Label } from "../components/CategoryNav";

// Dynamic categories data based on actual memory categories
export const categoriesData: Category[] = [
  { name: "Personal", count: 4, isUserCreated: false, admin_id: null },
  { name: "Shared With", count: 7, isUserCreated: false, admin_id: null },
  { name: "Published", count: 6, isUserCreated: false, admin_id: null },
];

// Dynamic labels data based on actual memory labels  
export const labelsData: Label[] = [
  { name: "Mexico", count: 12, isUserCreated: false },
  { name: "Family", count: 8, isUserCreated: false },
  { name: "Corporate", count: 5, isUserCreated: false },
  { name: "Travel", count: 15, isUserCreated: false },
  { name: "Events", count: 7, isUserCreated: false },
];

// Existing collaborators/contacts in the platform
export const existingCollaboratorsData = [
  { 
    id: "1",
    name: "Sarah Johnson", 
    email: "sarah.johnson@email.com", 
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b332c8a1?w=32&h=32&fit=crop&crop=face",
    isFrequent: true,
    lastCollaborated: "2024-01-15"
  },
  { 
    id: "2",
    name: "Mike Chen", 
    email: "mike.chen@email.com", 
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face",
    isFrequent: true,
    lastCollaborated: "2024-01-10"
  },
  { 
    id: "3",
    name: "Emily Rodriguez", 
    email: "emily.rodriguez@email.com", 
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
    isFrequent: true,
    lastCollaborated: "2024-01-08"
  },
  { 
    id: "4",
    name: "David Thompson", 
    email: "david.thompson@email.com", 
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face",
    isFrequent: false,
    lastCollaborated: "2023-12-20"
  },
  { 
    id: "5",
    name: "Lisa Park", 
    email: "lisa.park@email.com", 
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=32&h=32&fit=crop&crop=face",
    isFrequent: false,
    lastCollaborated: "2023-12-15"
  },
  { 
    id: "6",
    name: "Alex Kumar", 
    email: "alex.kumar@email.com", 
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=32&h=32&fit=crop&crop=face",
    isFrequent: false,
    lastCollaborated: "2023-11-30"
  }
];