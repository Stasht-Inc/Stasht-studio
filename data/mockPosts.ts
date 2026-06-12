const samanthaAvatar = 'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=100&h=100&fit=crop';

export interface MockPost {
  id: string;
  title: string;
  author: {
    name: string;
    avatar: string;
    id?: string; // User ID for ownership checking
    email?: string; // User email for ownership checking
  };
  location: string;
  date: string;
  image: string;
  content: string | null;
  comments: number;
  memoryId?: string; // Added memoryId field to link posts to memories
  likes?: number; // Added likes field for consistency with UI
  orientation?: 'portrait' | 'landscape' | 'square'; // Added for better image layout handling
  rotation_angle?: number; // Added for image rotation support
  crop_data?: {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
    imageWidth: number;
    imageHeight: number;
  }; // Crop data from database - synced to localStorage on load
  is_claim?: number; // 1 if post has been claimed, 0 or undefined otherwise
  claim_user_id?: number | string | null; // ID of user who claimed the post
  tags?: Array<string | { id?: number; name: string }>; // Tags associated with this post
}

export const mockPosts: MockPost[] = [
  {
    id: "post_1",
    title: "Cancun Beach Bliss",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Cancun, Mexico",
    date: "Feb 15, 2025",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop",
    orientation: 'landscape',
    content: "Perfect day at the beach with family! The sunset was absolutely breathtaking and the kids had so much fun building sandcastles. Can't wait to come back next summer! 🏖️☀️",
    comments: 12,
    memoryId: "mem_1", // Assigned to Cancun - Mexico memory
    likes: 24,
  },
  {
    id: "post_2", 
    title: "Desert Golf Adventure",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Phoenix, Arizona",
    date: "May 11, 2025",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop",
    orientation: 'portrait',
    content: null,
    comments: 8,
    memoryId: "mem_3", // Assigned to Desert Sunset memory
    likes: 18,
  },
  {
    id: "post_3",
    title: "City Photography Walk",
    author: {
      name: "Emma Davis",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    },
    location: "New York City",
    date: "Aug 10, 2024",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=500&h=500&fit=crop",
    orientation: 'square',
    content: "Spent the afternoon exploring the city with my camera. There's always something new to discover around every corner in NYC! 📸✨",
    comments: 15,
    memoryId: "mem_5", // Assigned to City Exploration memory
    likes: 32,
  },
  {
    id: "post_4",
    title: "Vancouver Morning Coffee",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Granville Island, Vancouver",
    date: "Mar 16, 2025",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop",
    orientation: 'landscape',
    content: null,
    comments: 6,
    memoryId: "mem_2", // Assigned to Friends are Forever memory
    likes: 12,
  },
  {
    id: "post_5",
    title: "Mexican Resort Dining",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Resort Restaurant, Cancun",
    date: "Feb 22, 2025",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
    content: "Amazing dining experience at the resort! The authentic Mexican cuisine was incredible and the oceanfront setting made it even more special. Such a perfect vacation meal! 🌮🌊",
    comments: 23,
    memoryId: "mem_1", // Assigned to Cancun - Mexico memory
    likes: 45,
  },
  {
    id: "post_6",
    title: "Golf Course Clubhouse",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Scottsdale, Arizona", 
    date: "May 13, 2025",
    image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    content: null,
    comments: 9,
    memoryId: "mem_3", // Assigned to Desert Sunset memory
    likes: 16,
  },
  {
    id: "post_7",
    title: "Sunset Beach Walk",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Cancun Beach",
    date: "Feb 20, 2025",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
    content: "The most beautiful sunset I've ever seen! The colors reflecting on the water were absolutely magical. Perfect end to our vacation day.",
    comments: 18,
    memoryId: "mem_1", // Assigned to Cancun - Mexico memory
    likes: 38,
  },
  {
    id: "post_8",
    title: "Tropical Paradise",
    author: {
      name: "John Doe",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    },
    location: "Resort Pool, Cancun",
    date: "Feb 18, 2025",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    content: "Living the dream at this amazing resort! The pool area is like something out of a postcard. Can't believe this is real life! 🌴🏖️",
    comments: 21,
    memoryId: "mem_1", // Assigned to Cancun - Mexico memory
    likes: 42,
  },
  {
    id: "post_9",
    title: "Friendship Goals",
    author: {
      name: "Samantha Smith", 
      avatar: samanthaAvatar,
    },
    location: "Vancouver Waterfront",
    date: "Mar 18, 2025",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop",
    content: "Best friends make every adventure better! Grateful for these amazing people in my life. Vancouver you've been incredible! 💕",
    comments: 25,
    memoryId: "mem_2", // Assigned to Friends are Forever memory
    likes: 56,
  },
  {
    id: "post_10",
    title: "Golf Course Sunrise",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Phoenix Desert Course",
    date: "May 12, 2025",
    image: "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=400&h=300&fit=crop",
    content: "Early morning tee time means catching this incredible sunrise over the desert. Golf doesn't get much better than this! ⛳️🌅",
    comments: 14,
    memoryId: "mem_3", // Assigned to Desert Sunset memory
    likes: 29,
  },
  {
    id: "post_11",
    title: "Urban Exploration",
    author: {
      name: "Tom Wilson",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
    },
    location: "Toronto Streets",
    date: "Apr 3, 2025",
    image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop",
    content: "Toronto's urban landscape never fails to amaze me. Every street corner tells a different story. This city has so much character! 🏙️",
    comments: 11,
    memoryId: "mem_5", // Assigned to City Exploration memory
    likes: 23,
  },
  {
    id: "post_12",
    title: "Cherry Blossoms in Bloom",
    author: {
      name: "Samantha Smith",
      avatar: samanthaAvatar,
    },
    location: "Stanley Park, Vancouver",
    date: "Mar 19, 2025",
    image: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=300&fit=crop",
    content: "Spring in Vancouver is pure magic! The cherry blossoms are in full bloom and creating the most beautiful pink canopy throughout the city.",
    comments: 19,
    memoryId: "mem_2", // Assigned to Friends are Forever memory  
    likes: 41,
  }
];