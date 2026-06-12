# AI Memory Wizard - Complete Documentation

## Overview
The AI Memory Wizard is a feature that helps users organize their photos in a memory using artificial intelligence. It analyzes photos and creates organized memories based on detected faces, moments, or objects.

---

## User Flow

### Step 1: Initiate AI Wizard
**Location:** Memory Details Page

**User Action:**
- Clicks the "AI Memory Wizard" button

**System Validation:**
- Checks if another memory is currently being processed
- Validates minimum photo count (3 photos required)
- Shows error toast if validation fails
- If validation passes, shows AI Results Modal immediately

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 6081-6100

```typescript
onClick={() => {
  // Check if another memory is being processed
  if (aiProcessingData?.status === 'processing' && aiProcessingData?.memoryId !== memoryId) {
    toast.info('Please wait for the current AI analysis to complete before starting a new one.');
    return;
  }

  // Check if we have enough photos (minimum 3)
  const photoCount = filteredAndSortedMediaItems.length;
  if (photoCount < 3) {
    const remaining = 3 - photoCount;
    toast.error(`Please upload ${remaining} more photo${remaining > 1 ? 's' : ''} to use AI Memory Wizard (minimum 3 photos required)`);
    return;
  }

  // Show results modal with static options - NO API calls yet
  setIsAIResultsModalOpen(true);
}
```

---

### Step 2: AI Results Modal with Static Options (FIRST)
**Display:** Immediately after button click, BEFORE any API calls

**Modal UI:** AI Results Modal showing static cluster type options

**Options Presented (Static Data):**
1. **Faces Detected**
   - Description: "Found different people in your photos"
   - Note: Photo count and groups text removed

2. **Moments Detected**
   - Description: "Detected special moments or occasions"
   - Note: Photo count and groups text removed

3. **Objects Detected**
   - Description: "Found different types of objects"
   - Note: Photo count and groups text removed

**User Action:**
1. Selects one of the three cluster type options (radio button selection)
2. Clicks "Apply" button at bottom of modal

**System Action:**
- Sets `selectedAnalysisOption` to the selected index (0, 1, or 2)
- Maps index to cluster type: 0='faces', 1='moments', 2='objects'
- Closes results modal
- Shows progress modal
- Triggers animation to bottom-left after 800ms
- Starts API calls

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7680-7930 (Results Modal)

```typescript
// Apply Button Handler (lines 7832-7922)
onClick={async () => {
  if (aiActiveTab === 'suggestions') {
    if (selectedAnalysisOption !== null) {
      // Map selected option to cluster type
      const summaryItems = [
        { type: 'faces', title: 'Faces Detected' },
        { type: 'moments', title: 'Moments Detected' },
        { type: 'objects', title: 'Objects Detected' }
      ];

      const selectedTask = summaryItems[selectedAnalysisOption];
      const type = selectedTask.type as 'faces' | 'moments' | 'objects';

      setIsApplyingTask(true);

      // Close results modal
      setIsAIResultsModalOpen(false);

      // Show progress modal in center first
      setIsAIWizardModalOpen(true);
      setAiWizardProgress(0);
      setAiWizardAnimatingOut(false);

      // After 800ms, trigger animation to bottom-left
      setTimeout(() => {
        setAiWizardAnimatingOut(true);
      }, 800);

      // Start progress animation and call APIs...
    }
  }
}
```

---

### Step 3: Progress Modal Animation
**Display:** Shows in center of screen, then animates to bottom-left

**Animation Flow:**
1. **Initial State (0-800ms):**
   - Modal appears in center with backdrop
   - Full size (32rem width)
   - Opacity: 1
   - Shows loading animation and text

2. **After 800ms:**
   - `aiWizardAnimatingOut` set to `true`
   - Modal animates to bottom-left corner
   - Transform: `translate(calc(-50vw + 180px), calc(50vh - 100px)) scale(0.8)`
   - Width: 320px
   - Opacity: 1 (remains fully visible)
   - Backdrop disappears
   - Loading animation and text hide
   - Only progress bar remains visible

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7507-7598

```typescript
{isAIWizardModalOpen && (
  <div
    className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-700 ease-in-out ${
      aiWizardAnimatingOut ? 'bg-transparent' : 'bg-black/50 backdrop-blur-sm'
    }`}
  >
    <div
      className="bg-white rounded-2xl shadow-xl p-6 relative transition-all duration-700 ease-in-out"
      style={{
        maxWidth: aiWizardAnimatingOut ? '320px' : '32rem',
        width: aiWizardAnimatingOut ? '320px' : '100%',
        transform: aiWizardAnimatingOut
          ? 'translate(calc(-50vw + 180px), calc(50vh - 100px)) scale(0.8)'
          : 'translate(0, 0) scale(1)',
        opacity: 1,
      }}
    >
      {/* Content hidden during animation */}
      {!aiWizardAnimatingOut && (
        // Loading animation and text
      )}

      {/* Progress bar always visible */}
      <div className="space-y-2">
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div style={{ width: `${aiWizardProgress}%` }} />
        </div>
        <p>Processing... {aiWizardProgress}%</p>
      </div>
    </div>
  </div>
)}
```

---

### Step 4: First API Call
**Endpoint:** `/ai/analyze/upload`

**Method:** POST

**Trigger:** Called immediately after progress modal appears and animation starts

**Function:** `dashboardAPI.analyzeUploadedPhotos(photoUrls, type)`

**Request Parameters:**
```typescript
{
  photos: string[],           // Array of photo URLs from current memory
  cluster_type: 'faces' | 'moments' | 'objects'  // Selected cluster type from user
}
```

**Request Example:**
```json
{
  "photos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg",
    "https://example.com/photo3.jpg"
  ],
  "cluster_type": "faces"
}
```

**Response Structure:**
```typescript
{
  success: boolean,
  data: {
    summary: {
      faces?: {
        description: string,
        total_groups: number,
        total_images_with_faces: number
      },
      moments?: {
        description: string,
        total_groups: number,
        total_images: number
      },
      objects?: {
        description: string,
        total_groups: number,
        total_images: number
      }
    },
    clusters: {
      faces?: Array<FaceCluster>,
      moments?: Array<MomentCluster>,
      objects?: Array<ObjectCluster>
    }
  },
  error?: string
}
```

**Response Example (when cluster_type='faces'):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "faces": {
        "description": "Found 2 different people in your photos",
        "total_groups": 2,
        "total_images_with_faces": 21
      }
    },
    "clusters": {
      "faces": [
        {
          "id": 1,
          "name": "Person 1",
          "photos": ["url1", "url2"],
          "count": 15
        },
        {
          "id": 2,
          "name": "Person 2",
          "photos": ["url3", "url4"],
          "count": 6
        }
      ]
    }
  }
}
```

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7838-7845

```typescript
// Step 1: Extract photo URLs
const photoUrls = filteredAndSortedMediaItems
  .map(item => item.image || item.thumbnail)
  .filter(Boolean);

// Step 2: Call FIRST API - analyze photos with selected cluster type
const analysisResponse = await dashboardAPI.analyzeUploadedPhotos(photoUrls, type);
```

**API Implementation:** `utils/authUtils.ts` lines 3413-3425

```typescript
analyzeUploadedPhotos: async (photos: string[], cluster_type?: 'faces' | 'moments' | 'objects'): Promise<ApiResponse<any>> => {
  console.log(`dashboardAPI.analyzeUploadedPhotos: Analyzing ${photos.length} photos with cluster_type: ${cluster_type || 'all'}`);

  const requestBody: any = { photos };
  if (cluster_type) {
    requestBody.cluster_type = cluster_type;
  }

  return await apiRequest('/ai/analyze/upload', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
}
```

---

### Step 5: Second API Call
**Endpoint:** `/ai/photos/memories`

**Method:** POST

**Function:** `dashboardAPI.createMemoriesFromGroups(clusterData, selectedClusterType)`

**Trigger:** Immediately after successful response from first API

**Request Parameters:**
```typescript
{
  groups: any,                                    // Cluster data from first API response
  type: 'faces' | 'moments' | 'objects'          // Selected cluster type
}
```

**Request Example:**
```json
{
  "groups": [
    {
      "id": 1,
      "name": "Person 1",
      "photos": ["url1", "url2"],
      "count": 15
    },
    {
      "id": 2,
      "name": "Person 2",
      "photos": ["url3", "url4"],
      "count": 6
    }
  ],
  "type": "faces"
}
```

**Response Structure:**
```typescript
{
  success: boolean,
  data?: {
    memories_created: number,
    memory_ids: string[]
  },
  error?: string
}
```

**Code Location:** `pages/MemoryDetailsPage.tsx` line 1893

```typescript
const clusterData = analysisData.clusters[selectedClusterType];
const createResponse = await dashboardAPI.createMemoriesFromGroups(clusterData, selectedClusterType);
```

**API Implementation:** `utils/authUtils.ts` lines 3449-3460

```typescript
createMemoriesFromGroups: async (groupData: any, type: 'faces' | 'moments' | 'objects'): Promise<ApiResponse<any>> => {
  console.log(`dashboardAPI.createMemoriesFromGroups: Creating memories from ${type} groups`);
  console.log('Group data being sent:', groupData);

  return await apiRequest('/ai/photos/memories', {
    method: 'POST',
    body: JSON.stringify({
      groups: groupData,
      type
    }),
  });
}
```

---

### Step 6: Success Handling
**System Actions:**
1. Sets progress to 100%
2. Clears progress interval
3. Shows success toast message
4. Waits 500ms to display 100% progress
5. Closes AI Wizard modal
6. Resets animation state
7. Refreshes memories data
8. Navigates back to memories list

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7892-7912

```typescript
if (createResponse.success) {
  toast.success(`Successfully created memories from ${type}!`);
  setSelectedAnalysisOption(null);

  // Jump to 100%
  setAiWizardProgress(100);

  // Clear interval
  clearInterval(progressInterval);

  // Wait a moment to show 100%, then close
  setTimeout(() => {
    setIsAIWizardModalOpen(false);
    setAiWizardAnimatingOut(false);
  }, 500);

  // Refresh memories data then navigate back to memories page
  if (onRefresh) {
    await onRefresh();
  }
  onBack();
}
```

---

## State Management

### State Variables

**Modal States:**
```typescript
const [isAIWizardModalOpen, setIsAIWizardModalOpen] = useState(false);
const [aiWizardAnimatingOut, setAiWizardAnimatingOut] = useState(false);
const [aiWizardProgress, setAiWizardProgress] = useState(0);
const [isAIResultsModalOpen, setIsAIResultsModalOpen] = useState(false);
```

**User Selection:**
```typescript
const [selectedAnalysisOption, setSelectedAnalysisOption] = useState<number | null>(null);
const [isApplyingTask, setIsApplyingTask] = useState(false);
```

**State Flow:**
1. User clicks button → `setIsAIResultsModalOpen(true)`
2. User selects option → `setSelectedAnalysisOption(0 | 1 | 2)`
3. User clicks Apply → `setIsAIResultsModalOpen(false)`, `setIsAIWizardModalOpen(true)`, `setAiWizardAnimatingOut(false)`
4. After 800ms → `setAiWizardAnimatingOut(true)` (triggers animation to bottom-left)
5. Progress updates → `setAiWizardProgress(0-100)`
6. On completion → `setIsAIWizardModalOpen(false)`, `setAiWizardAnimatingOut(false)`

---

## Progress Animation

### Modal Animation Behavior
1. **Initial Display (0-800ms):**
   - Modal appears in center of screen
   - Full size with backdrop
   - Shows loading animation and descriptive text

2. **Bottom-Left Animation (After 800ms):**
   - Animates to bottom-left corner over 700ms
   - Transform: `translate(calc(-50vw + 180px), calc(50vh - 100px)) scale(0.8)`
   - Backdrop fades out
   - Loading content hides
   - Only progress bar remains visible

### Progress Bar Behavior
- **Duration:** Incremental progress from 0% to 95%, then waits for API
- **Update Interval:** Every 100ms
- **Increment:** +0.5% per update

### Progress Stages
1. **0-95%:** Steady progress (0.5% every 100ms)
2. **95%:** Stops and waits for both API calls to complete
3. **100%:** Jumps immediately when second API succeeds

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7828-7840 (Progress interval setup)

---

## Results Modal

### Display Format (After removing groups text)
```
╔════════════════════════════════════════════╗
║  Faces Detected          97% confident     ║
║  Found 2 different people in your photos   ║
║  → People (21 photos)                      ║
╠════════════════════════════════════════════╣
║  Moments Detected        90% confident     ║
║  Detected 2 special moments or occasions   ║
║  → Moments (17 photos)                     ║
╠════════════════════════════════════════════╣
║  Objects Detected        93% confident     ║
║  Found 41 different types of objects       ║
║  → Objects (321 photos)                    ║
╚════════════════════════════════════════════╝
```

**Code Location:** `pages/MemoryDetailsPage.tsx` lines 7875-7986

**Removed Element:** `~{item.groups} groups` text (line 7983)

---

## Error Handling

### Validation Errors
1. **Another memory processing:**
   - Message: "Please wait for the current AI analysis to complete before starting a new one."
   - Type: Info toast

2. **Insufficient photos:**
   - Message: "Please upload X more photo(s) to use AI Memory Wizard (minimum 3 photos required)"
   - Type: Error toast

### API Errors

**First API Error (analyze/upload):**
```typescript
catch (error) {
  clearInterval(progressInterval);
  setIsAIWizardModalOpen(false);

  if (backgroundProcessingTriggered && setAiProcessing) {
    setAiProcessing({
      memoryId: memoryId,
      status: 'failed',
      startTime: startTime
    });
  } else {
    toast.error("Failed to analyze photos. Please try again.");
  }
}
```

**Second API Error (photos/memories):**
```typescript
catch (memoriesError) {
  clearInterval(progressInterval);
  setIsAIWizardModalOpen(false);

  if (backgroundProcessingTriggered && setAiProcessing) {
    setAiProcessing({
      memoryId: memoryId,
      status: 'failed',
      startTime: startTime
    });
  } else {
    toast.error("Failed to create memories. Please try again.");
  }
}
```

**Missing Cluster Data:**
```typescript
if (!analysisData.clusters || !analysisData.clusters[selectedClusterType]) {
  toast.error(`No ${selectedClusterType} data found in AI analysis`);
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────┐
│  User clicks "AI Memory Wizard" button  │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │   Validations  │
        │ • Processing?  │
        │ • Min 3 photos │
        └────────┬───────┘
                 │ PASS
                 ▼
┌────────────────────────────────────────┐
│   Show AI Results Modal (FIRST)        │
│   ┌──────────────────────────────┐    │
│   │  AI Memory Wizard Suggestions│    │
│   │  ○ Faces Detected            │    │
│   │     Found different people   │    │
│   │  ○ Moments Detected          │    │
│   │     Detected special moments │    │
│   │  ○ Objects Detected          │    │
│   │     Found different objects  │    │
│   │                              │    │
│   │  [Apply Button]              │    │
│   └──────────────────────────────┘    │
└────────────────┬───────────────────────┘
                 │ User selects option & clicks Apply
                 ▼
        ┌────────────────┐
        │ Close results  │
        │ modal          │
        └────────┬───────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│   Show Progress Modal in CENTER        │
│   ┌──────────────────────────────┐    │
│   │  Memory Wizard AI            │    │
│   │  [Loading Animation]         │    │
│   │  Analyzing your photos...    │    │
│   │  [████░░░░░░] 15%            │    │
│   └──────────────────────────────┘    │
└────────────────┬───────────────────────┘
                 │ After 800ms
                 ▼
┌────────────────────────────────────────┐
│   Animate to BOTTOM-LEFT Corner        │
│   ┌──────────────┐                     │
│   │[████████░░]  │ ← Compact view      │
│   │Processing 75%│                     │
│   └──────────────┘                     │
└────────────────┬───────────────────────┘
                 │ Simultaneously
                 ▼
┌────────────────────────────────────────┐
│   API Call #1: /ai/analyze/upload      │
│   POST {                               │
│     photos: [url1, url2, ...],         │
│     cluster_type: "faces"              │
│   }                                    │
└────────────────┬───────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Extract cluster│
        │ data from      │
        │ response       │
        └────────┬───────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│   API Call #2: /ai/photos/memories     │
│   POST {                               │
│     groups: clusterData,               │
│     type: "faces"                      │
│   }                                    │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│   Progress jumps to 100%               │
│   ┌──────────────┐                     │
│   │[██████████]  │                     │
│   │Processing100%│                     │
│   └──────────────┘                     │
└────────────────┬───────────────────────┘
                 │ After 500ms
                 ▼
        ┌────────────────┐
        │ Success!       │
        │ • Close modal  │
        │ • Show toast   │
        │ • Refresh data │
        │ • Navigate back│
        └────────────────┘
```

---

## Testing Checklist

### Happy Path
- [ ] Click AI Memory Wizard button with 3+ photos
- [ ] AI Results modal appears immediately with static options
- [ ] Can select one of three options (Faces/Moments/Objects)
- [ ] Click Apply button
- [ ] Results modal closes
- [ ] Progress modal appears in center of screen
- [ ] After 800ms, modal animates to bottom-left corner
- [ ] Progress bar shows in bottom-left and updates smoothly
- [ ] First API call succeeds
- [ ] Second API call succeeds
- [ ] Progress jumps to 100%
- [ ] Success toast appears
- [ ] Modal closes after 500ms
- [ ] Data refreshes
- [ ] Navigates back to memories list

### Edge Cases
- [ ] Click button with < 3 photos → Shows error
- [ ] Click button while another memory processing → Shows info message
- [ ] Click Apply without selecting option → Shows error
- [ ] First API fails → Shows error, clears progress, closes modal
- [ ] Second API fails → Shows error, clears progress, closes modal
- [ ] No cluster data in response → Shows specific error
- [ ] Network timeout → Handles gracefully

### UI/UX
- [ ] Results modal shows BEFORE any API calls
- [ ] Photo count and groups text are removed from options
- [ ] Progress modal animation is smooth (center → bottom-left)
- [ ] Progress bar remains visible in bottom-left position
- [ ] Modal opacity stays at 1 (fully visible) throughout
- [ ] Backdrop prevents interaction during initial display
- [ ] Progress updates every 100ms with 0.5% increment
- [ ] Toast messages are clear and helpful

---

## File Locations

### Main Implementation
- **Component:** `pages/MemoryDetailsPage.tsx`
  - Lines 491-492: State declarations (`isAIWizardModalOpen`, `aiWizardAnimatingOut`, etc.)
  - Lines 6081-6100: AI Memory Wizard button onClick handler
  - Lines 7507-7598: Progress modal with animation UI
  - Lines 7680-7930: AI Results modal UI
  - Lines 7832-7922: Apply button handler with API calls

### API Functions
- **File:** `utils/authUtils.ts`
  - Lines 3413-3425: `analyzeUploadedPhotos` function
  - Lines 3449-3460: `createMemoriesFromGroups` function

---

## API Endpoints

### Backend Endpoints
1. **POST /api/react/ai/analyze/upload**
   - Analyzes photos and detects faces/moments/objects
   - Returns clusters based on cluster_type

2. **POST /api/react/ai/photos/memories**
   - Creates memories from grouped clusters
   - Returns created memory IDs

---

## Dependencies

### Required Packages
- `react` - State management and hooks
- `sonner` - Toast notifications
- `lucide-react` - Icons (UserCircle, Heart, Package, etc.)

### Context
- `AuthContext` - User authentication
- `dashboardAPI` - API service layer

---

## Change Log

### Latest Changes (2025-12-26)
1. ✅ **Major Flow Restructure**: Results modal now shows FIRST with static options
2. ✅ **Removed useEffect trigger**: APIs now called from Apply button click handler
3. ✅ **Progress modal animation**: Added center-to-bottom-left animation
   - Shows in center for 800ms
   - Animates to bottom-left corner with transform calculation
   - Opacity remains at 1 (fully visible) throughout
4. ✅ **Animation state management**: Added `aiWizardAnimatingOut` state
5. ✅ **Progress visibility fix**: Ensured progress bar stays visible in bottom-left
6. ✅ **Transform optimization**: Uses `translate(calc(-50vw + 180px), calc(50vh - 100px)) scale(0.8)`
7. ✅ **Apply button handler**: Consolidated API calls in single async handler

### Previous Changes (2025-12-24)
1. ✅ Removed "~X groups" text from results modal
2. ✅ Fixed variable initialization order (filteredAndSortedMediaItems)
3. ✅ Updated useEffect dependency array
4. ✅ Implemented two-step API call flow
5. ✅ Added progress animation

### Initial Implementation
1. Added AI Memory Wizard button
2. Created cluster selection logic
3. Implemented error handling
4. Added toast notifications

---

## Known Issues
None currently.

---

## Future Enhancements
1. Add ability to edit cluster names before creating memories
2. Allow multiple cluster type selection
3. Show preview of photos in each cluster
4. Add undo functionality after memory creation
5. Add ability to pause/cancel AI processing
6. Show estimated time remaining in progress bar

---

**Last Updated:** December 26, 2025
**Version:** 2.0
**Author:** Development Team
