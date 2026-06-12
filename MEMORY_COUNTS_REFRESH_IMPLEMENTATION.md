# Memory Counts API Refresh Implementation

## Overview
This document outlines the implementation of proper memory counts API refresh throughout the StashtStudio application. The memory counts API endpoint `http://localhost:5176/api/react/user/memory-counts` will now be automatically refreshed whenever operations that affect memory or media counts occur.

## Implementation Details

### 1. Enhanced useMemoryCounts Hook (`hooks/useMemoryCounts.ts`)
- **Added automatic periodic refresh**: Memory counts refresh every 30 seconds when user is authenticated and the document is visible
- **Centralized memory counts management**: Global state management for memory counts across all components
- **Exported trigger function**: `triggerMemoryCountsRefresh()` for manual refresh from anywhere in the app

### 2. Memory Creation Operations

#### CreateMemory1.tsx
- ✅ **Memory creation**: Triggers refresh after successful memory creation
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

#### CreateMemory.tsx  
- ✅ **Memory creation**: Triggers refresh after successful memory creation
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

### 3. Memory Deletion Operations

#### MemoryActionMenu.tsx
- ✅ **Memory deletion**: Triggers refresh after successful memory deletion
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

#### MemoryDetailsPage.tsx
- ✅ **Memory deletion**: Triggers refresh when memory is deleted from details page
- ✅ **Media item deletion**: Triggers refresh when individual media items are deleted
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

### 4. Media Upload Operations

#### MediaPage.tsx
- ✅ **Media uploads**: Triggers refresh after successful media uploads complete
- ✅ **Media deletion**: Triggers refresh when bulk deleting media items
- ✅ **Memory creation with images**: Triggers refresh when creating memories with selected images
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

#### AddMomentModal.tsx
- ✅ **Adding moments**: Triggers refresh when moments (photos) are successfully added to memories
- ✅ **Import added**: `triggerMemoryCountsRefresh` imported and used

### 5. Dashboard Integration

#### Dashboard.tsx
- ✅ **Uses memory counts**: Dashboard properly consumes memory counts from `useMemoryCounts` hook
- ✅ **Memory limit display**: Shows actual memory counts in limit alerts

#### Sidebar.tsx
- ✅ **Memory creation**: Triggers refresh after memory creation from sidebar
- ✅ **Uses memory counts**: Sidebar properly consumes memory counts data

## API Integration Points

### When Memory Counts Refresh is Triggered:
1. **Memory Creation**: New memory created via any method
2. **Memory Deletion**: Memory deleted via any method
3. **Media Upload**: Files uploaded to the system
4. **Media Deletion**: Media files deleted (individual or bulk)
5. **Moment Addition**: Photos added to existing memories
6. **Periodic Refresh**: Every 30 seconds automatically (when app is active)
7. **Authentication**: When user logs in successfully

### API Endpoint Details:
- **URL**: `http://localhost:5176/api/react/user/memory-counts`
- **Method**: GET
- **Authentication**: Required (Bearer token)
- **Response Structure**:
```json
{
  "success": true,
  "data": {
    "memory_counts": {
      "total_memories": number,
      "total_memory_images": number,
      "published_memories": number
    }
  }
}
```

## Benefits of This Implementation

1. **Real-time Updates**: Memory counts stay synchronized across all components
2. **Automatic Refresh**: No manual intervention needed - counts update automatically
3. **Performance Optimized**: Uses global state to prevent redundant API calls
4. **User Experience**: Users see accurate counts immediately after operations
5. **Centralized Management**: Single source of truth for memory counts data
6. **Background Updates**: Periodic refresh ensures data stays current even during long sessions

## Usage Examples

### Manual Trigger (if needed):
```javascript
import { triggerMemoryCountsRefresh } from '../hooks/useMemoryCounts';

// After any operation that affects memory counts
await triggerMemoryCountsRefresh();
```

### Consuming Memory Counts:
```javascript
import { useMemoryCounts } from '../hooks/useMemoryCounts';

const { memoryCounts, isLoading, error, refreshMemoryCounts } = useMemoryCounts();

// Use memoryCounts.total_memories, memoryCounts.total_memory_images, etc.
```

## Testing

To verify the implementation:
1. Create a new memory → Check dashboard shows updated count
2. Upload media files → Check dashboard shows updated media count  
3. Delete a memory → Check dashboard shows decreased count
4. Add moments to memory → Check counts update
5. Wait 30+ seconds → Check counts refresh automatically
6. Check browser network tab → Verify API calls to `/user/memory-counts`

The memory counts API will now be properly hit after refresh and whenever operations that affect memory or media counts occur throughout the application.