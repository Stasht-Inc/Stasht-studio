export interface MemoryDetails {
  id: string;
  title: string;
  category: string;
  description: string;
  thumbnail: string;
  mediaCount: number;
  totalImages?: number;
  createdDate: string;
  lastModified: string;
  dateRange?: string;
  author: {
    name: string;
    avatar: string;
    email: string;
  };
  location: {
    primary: string;
    all: string[];
  };
  tags: string[];
  isPublic: boolean;
  views: number;
  likes: number;
  shares: number;
  collaborators: Array<{
    id: string;
    name: string;
    avatar: string;
    email: string;
    role: string;
    joinedDate: string;
    lastActive: string;
  }>;
  analytics: {
    totalViews: number;
    uniqueViewers: number;
    averageViewTime: string;
    topLocations: Array<{
      country: string;
      views: number;
    }>;
    dailyViews: Array<{
      date: string;
      views: number;
    }>;
    peakViewingTime: string;
    engagementRate: string;
  };
}

const featuredMemories: { [key: string]: MemoryDetails } = {
  "mem_1": {
    id: "mem_1",
    title: "Cancun - Mexico",
    category: "Personal", 
    description: "Perfect beach vacation in Cancun, Mexico. Crystal clear waters, amazing food, and unforgettable memories with family and friends. The resort was incredible and the weather was perfect for our stay from February 12-28, 2025.",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
    mediaCount: 67,
    totalImages: 142,
    createdDate: "2025-02-12T08:00:00Z",
    lastModified: "2025-02-28T18:30:00Z",
    dateRange: "Feb 12- Feb 28/25",
    author: {
      name: "Samantha Smith",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1a9?w=100&h=100&fit=crop",
      email: "samantha.smith@email.com"
    },
    location: {
      primary: "Cancun, Mexico",
      all: ["Cancun, Mexico", "Playa del Carmen, Mexico", "Tulum, Mexico"]
    },
    tags: ["Mexico", "Beach", "Family", "Vacation"],
    isPublic: false,
    views: 187,
    likes: 34,
    shares: 12,
    collaborators: [
      {
        id: "user_1",
        name: "John Doe",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
        email: "john.doe@email.com",
        role: "Editor",
        joinedDate: "2025-02-12T08:00:00Z",
        lastActive: "2025-02-28T18:00:00Z"
      },
      {
        id: "user_2",
        name: "Alex Johnson",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
        email: "alex.johnson@email.com",
        role: "Editor",
        joinedDate: "2025-02-12T08:00:00Z",
        lastActive: "2025-02-28T16:45:00Z"
      },
      {
        id: "user_3", 
        name: "Maria Garcia",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1a9?w=100&h=100&fit=crop",
        email: "maria.garcia@email.com",
        role: "Editor",
        joinedDate: "2025-02-12T08:00:00Z",
        lastActive: "2025-02-27T11:30:00Z"
      },
      {
        id: "user_4",
        name: "David Smith",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        email: "david.smith@email.com",
        role: "Viewer",
        joinedDate: "2025-02-13T10:30:00Z",
        lastActive: "2025-02-26T14:20:00Z"
      },
      {
        id: "user_5",
        name: "Emma Wilson",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
        email: "emma.wilson@email.com",
        role: "Viewer",
        joinedDate: "2025-02-14T09:15:00Z",
        lastActive: "2025-02-25T13:30:00Z"
      },
      {
        id: "user_6",
        name: "Mike Chen",
        avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
        email: "mike.chen@email.com",
        role: "Viewer",
        joinedDate: "2025-02-15T11:20:00Z",
        lastActive: "2025-02-24T16:45:00Z"
      }
    ],
    analytics: {
      totalViews: 187,
      uniqueViewers: 142,
      averageViewTime: "3m 42s",
      topLocations: [
        { country: "United States", views: 89 },
        { country: "Canada", views: 45 },
        { country: "Mexico", views: 32 },
        { country: "United Kingdom", views: 21 }
      ],
      dailyViews: [
        { date: "2025-02-25", views: 12 },
        { date: "2025-02-26", views: 18 },
        { date: "2025-02-27", views: 25 },
        { date: "2025-02-28", views: 31 },
        { date: "2025-03-01", views: 22 },
        { date: "2025-03-02", views: 15 },
        { date: "2025-03-03", views: 19 }
      ],
      peakViewingTime: "8:30 PM",
      engagementRate: "82%"
    }
  },
  "mem_2": {
    id: "mem_2",
    title: "Friends are Forever",
    category: "Shared with",
    description: "Amazing friendship getaway in Vancouver! We explored the city, tried amazing local restaurants, and created memories that will last a lifetime. The cherry blossoms were in full bloom and made everything magical during March 15-22, 2025.",
    thumbnail: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop",
    mediaCount: 42,
    totalImages: 85,
    createdDate: "2025-03-15T09:00:00Z",
    lastModified: "2025-03-22T17:15:00Z",
    dateRange: "Mar 15- Mar 22/25",
    author: {
      name: "Samantha Smith",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1a9?w=100&h=100&fit=crop",
      email: "samantha.smith@email.com"
    },
    location: {
      primary: "Vancouver, Canada",
      all: ["Vancouver, Canada", "Stanley Park, Canada", "Granville Island, Canada"]
    },
    tags: ["Family", "Friends", "Vancouver", "Spring"],
    isPublic: false,
    views: 156,
    likes: 28,
    shares: 9,
    collaborators: [
      {
        id: "user_5",
        name: "Lisa Brown",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
        email: "lisa.brown@email.com",
        role: "Editor",
        joinedDate: "2025-03-15T09:00:00Z",
        lastActive: "2025-03-21T14:30:00Z"
      },
      {
        id: "user_6",
        name: "John Doe",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
        email: "john.doe@email.com",
        role: "Viewer",
        joinedDate: "2025-03-16T11:20:00Z",
        lastActive: "2025-03-20T09:45:00Z"
      },
      {
        id: "user_7",
        name: "Anna Smith",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
        email: "anna.smith@email.com",
        role: "Viewer",
        joinedDate: "2025-03-17T14:30:00Z",
        lastActive: "2025-03-19T18:15:00Z"
      }
    ],
    analytics: {
      totalViews: 156,
      uniqueViewers: 98,
      averageViewTime: "2m 58s",
      topLocations: [
        { country: "Canada", views: 78 },
        { country: "United States", views: 45 },
        { country: "United Kingdom", views: 22 },
        { country: "Australia", views: 11 }
      ],
      dailyViews: [
        { date: "2025-03-18", views: 8 },
        { date: "2025-03-19", views: 15 },
        { date: "2025-03-20", views: 23 },
        { date: "2025-03-21", views: 29 },
        { date: "2025-03-22", views: 18 },
        { date: "2025-03-23", views: 12 },
        { date: "2025-03-24", views: 16 }
      ],
      peakViewingTime: "7:45 PM",
      engagementRate: "76%"
    }
  },
  "mem_3": {
    id: "mem_3",
    title: "Desert Sunset",
    category: "Personal",
    description: "Epic golf trip to Phoenix, Arizona featuring rounds at some of the most beautiful desert courses. Perfect weather, incredible sunset views, and unforgettable moments with fellow golf enthusiasts during May 10-14, 2025.",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    mediaCount: 35,
    totalImages: 78,
    createdDate: "2025-05-10T08:00:00Z",
    lastModified: "2025-05-14T19:45:00Z",
    dateRange: "May 10- May 14/25",
    author: {
      name: "Samantha Smith",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1a9?w=100&h=100&fit=crop",
      email: "samantha.smith@email.com"
    },
    location: {
      primary: "Phoenix, Arizona",
      all: ["Phoenix, Arizona", "Scottsdale, Arizona", "Sedona, Arizona"]
    },
    tags: ["Golf", "Travel", "Desert", "Sunset"],
    isPublic: true,
    views: 342,
    likes: 67,
    shares: 24,
    collaborators: [
      {
        id: "user_1",
        name: "John Doe",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
        email: "john.doe@email.com",
        role: "Editor",
        joinedDate: "2025-05-10T08:00:00Z",
        lastActive: "2025-05-14T18:00:00Z"
      },
      {
        id: "user_7",
        name: "Robert Smith",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        email: "robert.smith@email.com",
        role: "Editor",
        joinedDate: "2025-05-10T08:00:00Z",
        lastActive: "2025-05-14T16:20:00Z"
      },
      {
        id: "user_8",
        name: "David Wilson",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop",
        email: "david.wilson@email.com",
        role: "Viewer",
        joinedDate: "2025-05-11T12:30:00Z",
        lastActive: "2025-05-13T10:15:00Z"
      }
    ],
    analytics: {
      totalViews: 342,
      uniqueViewers: 278,
      averageViewTime: "4m 12s",
      topLocations: [
        { country: "United States", views: 225 },
        { country: "Canada", views: 67 },
        { country: "United Kingdom", views: 34 },
        { country: "Australia", views: 16 }
      ],
      dailyViews: [
        { date: "2025-05-12", views: 18 },
        { date: "2025-05-13", views: 25 },
        { date: "2025-05-14", views: 32 },
        { date: "2025-05-15", views: 41 },
        { date: "2025-05-16", views: 29 },
        { date: "2025-05-17", views: 22 },
        { date: "2025-05-18", views: 35 }
      ],
      peakViewingTime: "8:15 PM",
      engagementRate: "85%"
    }
  },
  "mem_5": {
    id: "mem_5",
    title: "City Exploration",
    category: "Published",
    description: "Urban adventure through Toronto's vibrant neighborhoods. From the CN Tower to the Distillery District, we captured the essence of this amazing city and all its hidden gems during April 1-5, 2025.",
    thumbnail: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop",
    mediaCount: 28,
    totalImages: 63,
    createdDate: "2025-04-01T10:00:00Z",
    lastModified: "2025-04-05T16:20:00Z",
    dateRange: "Apr 01- Apr 05/25",
    author: {
      name: "John Doe",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      email: "john.doe@email.com"
    },
    location: {
      primary: "Toronto, Canada",
      all: ["Toronto, Canada", "Distillery District, Canada", "CN Tower, Canada"]
    },
    tags: ["Corporate", "City", "Urban", "Toronto"],
    isPublic: true,
    views: 298,
    likes: 45,
    shares: 18,
    collaborators: [
      {
        id: "user_9",
        name: "Tom Wilson",
        avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
        email: "tom.wilson@email.com",
        role: "Editor",
        joinedDate: "2025-04-01T10:00:00Z",
        lastActive: "2025-04-05T14:15:00Z"
      },
      {
        id: "user_10",
        name: "Rachel Davis",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
        email: "rachel.davis@email.com",
        role: "Viewer",
        joinedDate: "2025-04-02T09:30:00Z",
        lastActive: "2025-04-04T11:45:00Z"
      }
    ],
    analytics: {
      totalViews: 298,
      uniqueViewers: 234,
      averageViewTime: "3m 28s",
      topLocations: [
        { country: "Canada", views: 156 },
        { country: "United States", views: 89 },
        { country: "United Kingdom", views: 32 },
        { country: "Australia", views: 21 }
      ],
      dailyViews: [
        { date: "2025-04-03", views: 15 },
        { date: "2025-04-04", views: 22 },
        { date: "2025-04-05", views: 28 },
        { date: "2025-04-06", views: 34 },
        { date: "2025-04-07", views: 26 },
        { date: "2025-04-08", views: 19 },
        { date: "2025-04-09", views: 24 }
      ],
      peakViewingTime: "9:00 PM",
      engagementRate: "79%"
    }
  }
};

const additionalMemories: { [key: string]: MemoryDetails } = {
  "mem_4": {
    id: "mem_4",
    title: "Summer Family Vacation - Vancouver Island",
    category: "Personal",
    description: "Amazing family getaway to Vancouver Island. Beautiful beaches, hiking trails, and quality time together exploring the natural wonders of British Columbia from July 15-28, 2024.",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    mediaCount: 35,
    totalImages: 70,
    createdDate: "2024-07-15T08:00:00Z",
    lastModified: "2024-07-28T18:00:00Z",
    dateRange: "Jul 15/24 - Jul 28/24",
    author: {
      name: "Sarah Johnson",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1a9?w=100&h=100&fit=crop",
      email: "sarah.johnson@email.com"
    },
    location: {
      primary: "Vancouver Island, BC",
      all: ["Vancouver Island, BC", "Victoria, BC", "Tofino, BC"]
    },
    tags: ["Family", "Vacation", "Nature", "BC"],
    isPublic: false,
    views: 124,
    likes: 22,
    shares: 6,
    collaborators: [],
    analytics: {
      totalViews: 124,
      uniqueViewers: 89,
      averageViewTime: "3m 12s",
      topLocations: [
        { country: "Canada", views: 98 },
        { country: "United States", views: 26 }
      ],
      dailyViews: [
        { date: "2024-07-25", views: 8 },
        { date: "2024-07-26", views: 12 },
        { date: "2024-07-27", views: 15 },
        { date: "2024-07-28", views: 18 },
        { date: "2024-07-29", views: 14 },
        { date: "2024-07-30", views: 9 }
      ],
      peakViewingTime: "7:30 PM",
      engagementRate: "74%"
    }
  },
  "mem_6": {
    id: "mem_6",
    title: "Corporate Team Building - Toronto Office",
    category: "Published",
    description: "Successful team building event at our Toronto office. Great activities, team bonding, and strategic planning sessions that brought everyone together from September 10-12, 2024.",
    thumbnail: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=600&fit=crop",
    mediaCount: 42,
    totalImages: 84,
    createdDate: "2024-09-10T08:00:00Z",
    lastModified: "2024-09-12T17:00:00Z",
    dateRange: "Sep 10/24 - Sep 12/24",
    author: {
      name: "Mike Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      email: "mike.chen@email.com"
    },
    location: {
      primary: "Toronto, Ontario",
      all: ["Toronto, Ontario", "CN Tower, Ontario", "Harbourfront, Ontario"]
    },
    tags: ["Corporate", "Team Building", "Toronto", "Professional"],
    isPublic: true,
    views: 198,
    likes: 31,
    shares: 12,
    collaborators: [],
    analytics: {
      totalViews: 198,
      uniqueViewers: 145,
      averageViewTime: "2m 45s",
      topLocations: [
        { country: "Canada", views: 142 },
        { country: "United States", views: 56 }
      ],
      dailyViews: [
        { date: "2024-09-10", views: 12 },
        { date: "2024-09-11", views: 18 },
        { date: "2024-09-12", views: 24 },
        { date: "2024-09-13", views: 19 },
        { date: "2024-09-14", views: 15 }
      ],
      peakViewingTime: "2:30 PM",
      engagementRate: "69%"
    }
  },
  "mem_7": {
    id: "mem_7",
    title: "Whistler Skiing Adventure",
    category: "Personal",
    description: "Epic skiing weekend in Whistler! Fresh powder, perfect weather, and amazing runs down the mountain. A winter adventure we'll never forget from February 5-12, 2024.",
    thumbnail: "https://images.unsplash.com/photo-1551524164-d526b0f3b3a9?w=800&h=600&fit=crop",
    mediaCount: 18,
    totalImages: 36,
    createdDate: "2024-02-05T08:00:00Z",
    lastModified: "2024-02-12T19:00:00Z",
    dateRange: "Feb 05/24 - Feb 12/24",
    author: {
      name: "Emma Wilson",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      email: "emma.wilson@email.com"
    },
    location: {
      primary: "Whistler, BC",
      all: ["Whistler, BC", "Blackcomb Mountain, BC", "Whistler Village, BC"]
    },
    tags: ["Travel", "Skiing", "Winter", "Adventure"],
    isPublic: false,
    views: 87,
    likes: 19,
    shares: 5,
    collaborators: [],
    analytics: {
      totalViews: 87,
      uniqueViewers: 63,
      averageViewTime: "3m 28s",
      topLocations: [
        { country: "Canada", views: 72 },
        { country: "United States", views: 15 }
      ],
      dailyViews: [
        { date: "2024-02-10", views: 6 },
        { date: "2024-02-11", views: 9 },
        { date: "2024-02-12", views: 13 },
        { date: "2024-02-13", views: 11 },
        { date: "2024-02-14", views: 8 }
      ],
      peakViewingTime: "6:45 PM",
      engagementRate: "81%"
    }
  },
  "mem_8": {
    id: "mem_8",
    title: "Calgary Stampede Experience",
    category: "Published",
    description: "Incredible experience at the Calgary Stampede! Rodeo events, amazing food, live music, and the true spirit of Alberta. A celebration of western culture from July 8-17, 2024.",
    thumbnail: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5e?w=800&h=600&fit=crop",
    mediaCount: 31,
    totalImages: 62,
    createdDate: "2024-07-08T08:00:00Z",
    lastModified: "2024-07-17T20:00:00Z",
    dateRange: "Jul 08/24 - Jul 17/24",
    author: {
      name: "David Smith",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      email: "david.smith@email.com"
    },
    location: {
      primary: "Calgary, Alberta",
      all: ["Calgary, Alberta", "Stampede Park, Alberta", "Olympic Plaza, Alberta"]
    },
    tags: ["Events", "Stampede", "Culture", "Western"],
    isPublic: true,
    views: 156,
    likes: 28,
    shares: 9,
    collaborators: [],
    analytics: {
      totalViews: 156,
      uniqueViewers: 118,
      averageViewTime: "4m 05s",
      topLocations: [
        { country: "Canada", views: 134 },
        { country: "United States", views: 22 }
      ],
      dailyViews: [
        { date: "2024-07-15", views: 11 },
        { date: "2024-07-16", views: 16 },
        { date: "2024-07-17", views: 21 },
        { date: "2024-07-18", views: 18 },
        { date: "2024-07-19", views: 13 }
      ],
      peakViewingTime: "8:15 PM",
      engagementRate: "77%"
    }
  },
  "mem_9": {
    id: "mem_9",
    title: "Niagara Falls Family Trip",
    category: "Personal",
    description: "Spectacular family trip to Niagara Falls! The power and beauty of the falls was breathtaking. Boat tours, scenic walks, and unforgettable memories from May 20-23, 2024.",
    thumbnail: "https://images.unsplash.com/photo-1484821250742-a93a2b518469?w=800&h=600&fit=crop",
    mediaCount: 22,
    totalImages: 44,
    createdDate: "2024-05-20T08:00:00Z",
    lastModified: "2024-05-23T18:00:00Z",
    dateRange: "May 20/24 - May 23/24",
    author: {
      name: "Lisa Brown",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
      email: "lisa.brown@email.com"
    },
    location: {
      primary: "Niagara Falls, Ontario",
      all: ["Niagara Falls, Ontario", "Maid of the Mist, Ontario", "Rainbow Bridge, Ontario"]
    },
    tags: ["Family", "Nature", "Tourism", "Waterfalls"],
    isPublic: false,
    views: 93,
    likes: 17,
    shares: 4,
    collaborators: [],
    analytics: {
      totalViews: 93,
      uniqueViewers: 71,
      averageViewTime: "3m 15s",
      topLocations: [
        { country: "Canada", views: 78 },
        { country: "United States", views: 15 }
      ],
      dailyViews: [
        { date: "2024-05-21", views: 7 },
        { date: "2024-05-22", views: 11 },
        { date: "2024-05-23", views: 15 },
        { date: "2024-05-24", views: 12 },
        { date: "2024-05-25", views: 9 }
      ],
      peakViewingTime: "7:20 PM",
      engagementRate: "73%"
    }
  },
  "mem_10": {
    id: "mem_10",
    title: "Bridlewood - Glenmore Christian Academy",
    category: "Personal",
    description: "Community engagement program at Glenmore Christian Academy in Bridlewood. Building relationships and creating meaningful connections through educational outreach.",
    thumbnail: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=600&fit=crop",
    mediaCount: 27,
    createdDate: "2024-12-12T08:30:00Z",
    lastModified: "2025-01-06T17:45:00Z",
    author: {
      name: "PedalHeads",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      email: "pedalheads@email.com"
    },
    location: {
      primary: "Calgary, Alberta",
      all: ["Calgary, Alberta", "Bridlewood, Alberta"]
    },
    tags: ["Mexico", "Community", "Education", "Academy"],
    isPublic: false,
    views: 76,
    likes: 12,
    shares: 3,
    collaborators: [],
    analytics: {
      totalViews: 76,
      uniqueViewers: 58,
      averageViewTime: "2m 28s",
      topLocations: [
        { country: "Canada", views: 69 },
        { country: "United States", views: 7 }
      ],
      dailyViews: [
        { date: "2025-01-01", views: 4 },
        { date: "2025-01-02", views: 7 },
        { date: "2025-01-03", views: 11 },
        { date: "2025-01-04", views: 14 },
        { date: "2025-01-05", views: 10 },
        { date: "2025-01-06", views: 6 }
      ],
      peakViewingTime: "5:45 PM",
      engagementRate: "70%"
    }
  },
  "mem_11": {
    id: "mem_11",
    title: "Additional Community Memory",
    category: "Personal", 
    description: "Additional community program memory for table navigation.",
    thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
    mediaCount: 15,
    createdDate: "2024-11-15T09:00:00Z",
    lastModified: "2024-12-01T16:00:00Z",
    author: {
      name: "Community Team",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      email: "team@email.com"
    },
    location: {
      primary: "Alberta, Canada",
      all: ["Alberta, Canada"]
    },
    tags: ["Community", "Program", "Outreach"],
    isPublic: false,
    views: 45,
    likes: 8,
    shares: 2,
    collaborators: [],
    analytics: {
      totalViews: 45,
      uniqueViewers: 32,
      averageViewTime: "1m 45s",
      topLocations: [
        { country: "Canada", views: 42 },
        { country: "United States", views: 3 }
      ],
      dailyViews: [
        { date: "2024-11-28", views: 3 },
        { date: "2024-11-29", views: 5 },
        { date: "2024-11-30", views: 7 },
        { date: "2024-12-01", views: 6 }
      ],
      peakViewingTime: "4:30 PM",
      engagementRate: "65%"
    }
  }
};

export const getMemoryDetails = (id: string): MemoryDetails | null => {
  const allMemories = { ...featuredMemories, ...additionalMemories };
  return allMemories[id] || null;
};