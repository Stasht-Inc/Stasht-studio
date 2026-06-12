// Local storage utility for managing invited memories
// This is a dummy category that doesn't save to database

export interface InvitedMemory {
  id: string;
  title: string;
  location?: string;
  dateRange: string;
  thumbnail?: string;
  imagesCount: number;
  inviter: {
    name: string;
    avatar?: string;
  };
  invitedAt: string;
  notificationId?: string; // Link to original notification
}

const STORAGE_KEY = 'stash_invited_memories';

class InvitedMemoriesStorage {
  // Get all invited memories from localStorage
  getInvitedMemories(): InvitedMemory[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading invited memories from localStorage:', error);
      return [];
    }
  }

  // Add a new invited memory
  addInvitedMemory(memory: InvitedMemory): void {
    try {
      const memories = this.getInvitedMemories();
      // Check if memory already exists
      const existingIndex = memories.findIndex(m => m.id === memory.id);
      
      if (existingIndex === -1) {
        memories.push(memory);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
        console.log('Added invited memory to localStorage:', memory.title);
      }
    } catch (error) {
      console.error('Error adding invited memory to localStorage:', error);
    }
  }

  // Remove an invited memory (when accepted/rejected)
  removeInvitedMemory(memoryId: string): void {
    try {
      const memories = this.getInvitedMemories();
      const filteredMemories = memories.filter(m => m.id !== memoryId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredMemories));
      console.log('Removed invited memory from localStorage:', memoryId);
    } catch (error) {
      console.error('Error removing invited memory from localStorage:', error);
    }
  }

  // Remove by notification ID (when notification is handled)
  removeByNotificationId(notificationId: string): void {
    try {
      const memories = this.getInvitedMemories();
      const filteredMemories = memories.filter(m => m.notificationId !== notificationId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredMemories));
      console.log('Removed invited memory by notification ID:', notificationId);
    } catch (error) {
      console.error('Error removing invited memory by notification ID:', error);
    }
  }

  // Get count of invited memories
  getInvitedMemoriesCount(): number {
    return this.getInvitedMemories().length;
  }

  // Check if there are any invited memories
  hasInvitedMemories(): boolean {
    return this.getInvitedMemoriesCount() > 0;
  }

  // Clear all invited memories (for testing or cleanup)
  clearAllInvitedMemories(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('Cleared all invited memories from localStorage');
    } catch (error) {
      console.error('Error clearing invited memories from localStorage:', error);
    }
  }

  // Create a sample invited memory (for testing)
  createSampleInvitedMemory(): InvitedMemory {
    const sampleId = `invited_${Date.now()}`;
    return {
      id: sampleId,
      title: 'Cancun - Mexico',
      location: 'Cancun, Mexico',
      dateRange: 'Feb 12 - Feb 28/25',
      thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      imagesCount: 142,
      inviter: {
        name: 'Sarah Johnson',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=50&h=50&fit=crop&crop=face'
      },
      invitedAt: new Date().toISOString(),
      notificationId: `notification_${Date.now()}`
    };
  }

  // Add sample data for testing
  addSampleData(): void {
    const sample1 = this.createSampleInvitedMemory();
    const sample2 = {
      ...this.createSampleInvitedMemory(),
      id: `invited_${Date.now() + 1}`,
      title: 'Paris Wedding',
      location: 'Paris, France',
      dateRange: 'June 15-20, 2024',
      imagesCount: 89,
      inviter: {
        name: 'Mike Chen',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face'
      }
    };

    this.addInvitedMemory(sample1);
    this.addInvitedMemory(sample2);
  }
}

export const invitedMemoriesStorage = new InvitedMemoriesStorage();