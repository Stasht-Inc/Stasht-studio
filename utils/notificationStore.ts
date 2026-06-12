// Global store to share notification data between components
let globalNotifications: any[] = [];
let subscribers: ((notifications: any[]) => void)[] = [];

export const notificationStore = {
  // Set notifications (called by NotificationDropdown)
  setNotifications: (notifications: any[]) => {
    globalNotifications = notifications;
    // Notify all subscribers
    subscribers.forEach(callback => callback(notifications));
  },

  // Get notifications
  getNotifications: () => globalNotifications,

  // Subscribe to notification changes
  subscribe: (callback: (notifications: any[]) => void) => {
    subscribers.push(callback);
    // Return unsubscribe function
    return () => {
      subscribers = subscribers.filter(sub => sub !== callback);
    };
  },

  // Find notification by memory title
  findNotificationByMemoryTitle: (memoryTitle: string): any | null => {
    return globalNotifications.find(notification => {
      // Check if the notification description contains the memory title
      const description = notification.description?.toLowerCase() || '';
      const title = memoryTitle.toLowerCase();
      return description.includes(title);
    }) || null;
  },

  // Find notification ID for a memory invitation
  findNotificationIdForMemory: (memoryId: string | number, memoryTitle?: string): string | null => {
    // First try to find by memory ID in notification type (for integer types)
    const notificationByMemoryId = globalNotifications.find(notification => {
      const isInvitationType = !isNaN(Number(notification.type)) && Number.isInteger(Number(notification.type));
      return isInvitationType && notification.type?.toString() === memoryId.toString();
    });

    if (notificationByMemoryId) {
      return notificationByMemoryId.id?.toString() || null;
    }

    // Fallback: try to find by memory title in description
    if (memoryTitle) {
      const notificationByTitle = notificationStore.findNotificationByMemoryTitle(memoryTitle);
      if (notificationByTitle) {
        return notificationByTitle.id?.toString() || null;
      }
    }

    return null;
  }
};