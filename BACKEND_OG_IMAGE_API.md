# Backend API: Open Graph Image Proxy

## Problem
LinkedIn and other social media platforms cannot access images stored in the private S3 bucket (`stasht-data.s3.us-east-2.amazonaws.com`). This prevents preview images from showing when sharing links.

## Solution
Create public API endpoints that fetch images from S3 and serve them publicly for Open Graph meta tags.

---

## Required Endpoints

### 1. Get Post OG Image
**Endpoint:** `GET /api/react/og-image/post/{post_id}`

**Description:** Fetches the image for a specific timeline post and serves it publicly.

**Parameters:**
- `post_id` (path parameter): The ID of the timeline post

**Response:**
- **Content-Type:** `image/jpeg` or `image/png` (based on original image)
- **Headers:**
  - `Cache-Control: public, max-age=86400` (24 hours)
  - `Access-Control-Allow-Origin: *`
- **Body:** Binary image data

**Implementation Logic:**
1. Query database for post with `post_id`
2. Get the `image` field (S3 URL)
3. Fetch image from S3 using backend credentials
4. Stream/return image data with appropriate content-type
5. If post not found or image missing, return 404

**Example:**
```
GET https://restapi-stasht.wd-projects.online/api/react/og-image/post/12345

Response:
Content-Type: image/jpeg
Cache-Control: public, max-age=86400
[Binary JPEG data]
```

---

### 2. Get Memory OG Image
**Endpoint:** `GET /api/react/og-image/memory/{memory_id}`

**Description:** Fetches the cover/thumbnail image for a memory and serves it publicly.

**Parameters:**
- `memory_id` (path parameter): The ID of the memory

**Response:**
- **Content-Type:** `image/jpeg` or `image/png` (based on original image)
- **Headers:**
  - `Cache-Control: public, max-age=86400` (24 hours)
  - `Access-Control-Allow-Origin: *`
- **Body:** Binary image data

**Implementation Logic:**
1. Query database for memory with `memory_id`
2. Get the `last_update_img` or `thumbnail` field (S3 URL)
3. Fetch image from S3 using backend credentials
4. Stream/return image data with appropriate content-type
5. If memory not found or image missing, return default placeholder

**Example:**
```
GET https://restapi-stasht.wd-projects.online/api/react/og-image/memory/789

Response:
Content-Type: image/jpeg
Cache-Control: public, max-age=86400
[Binary JPEG data]
```

---

## Implementation Notes

### Security Considerations
- ✅ **Public endpoint** - No authentication required (LinkedIn crawler cannot authenticate)
- ✅ **Read-only** - Only serves existing images, no modifications
- ✅ **Rate limiting** - Consider adding rate limits to prevent abuse
- ✅ **Cache headers** - Set long cache times to reduce S3 requests

### Performance Optimization
1. **Add caching layer** - Cache frequently accessed images in memory or CDN
2. **Async streaming** - Stream images from S3 without loading fully into memory
3. **Image optimization** - Consider resizing to 1200x630 (recommended OG image size)
4. **CDN integration** - If using CloudFront, route these endpoints through CDN

### Example Implementation (PHP/Laravel)
```php
// routes/api.php
Route::get('/og-image/post/{post_id}', [OgImageController::class, 'getPostImage']);
Route::get('/og-image/memory/{memory_id}', [OgImageController::class, 'getMemoryImage']);

// app/Http/Controllers/OgImageController.php
class OgImageController extends Controller
{
    public function getPostImage($post_id)
    {
        $post = TimelinePost::find($post_id);

        if (!$post || !$post->image) {
            return response()->file(public_path('default-og-image.jpg'));
        }

        // Fetch from S3
        $s3Client = AWS::createClient('s3');
        $result = $s3Client->getObject([
            'Bucket' => 'stasht-data',
            'Key' => $this->extractS3Key($post->image)
        ]);

        $contentType = $result['ContentType'] ?? 'image/jpeg';

        return response($result['Body'])
            ->header('Content-Type', $contentType)
            ->header('Cache-Control', 'public, max-age=86400')
            ->header('Access-Control-Allow-Origin', '*');
    }

    public function getMemoryImage($memory_id)
    {
        $memory = Memory::find($memory_id);

        if (!$memory) {
            return response()->file(public_path('default-og-image.jpg'));
        }

        $imageUrl = $memory->last_update_img ?? $memory->thumbnail;

        if (!$imageUrl) {
            return response()->file(public_path('default-og-image.jpg'));
        }

        // Fetch from S3
        $s3Client = AWS::createClient('s3');
        $result = $s3Client->getObject([
            'Bucket' => 'stasht-data',
            'Key' => $this->extractS3Key($imageUrl)
        ]);

        $contentType = $result['ContentType'] ?? 'image/jpeg';

        return response($result['Body'])
            ->header('Content-Type', $contentType)
            ->header('Cache-Control', 'public, max-age=86400')
            ->header('Access-Control-Allow-Origin', '*');
    }

    private function extractS3Key($s3Url)
    {
        // Extract key from S3 URL
        // Example: https://stasht-data.s3.us-east-2.amazonaws.com/path/to/image.jpg
        // Returns: path/to/image.jpg
        $path = parse_url($s3Url, PHP_URL_PATH);
        return ltrim($path, '/');
    }
}
```

---

## Testing

Once implemented, test the endpoints:

1. **Direct access:**
   ```
   curl -I https://restapi-stasht.wd-projects.online/api/react/og-image/post/12345
   ```
   Should return `200 OK` with `Content-Type: image/jpeg`

2. **LinkedIn Post Inspector:**
   - Visit: https://www.linkedin.com/post-inspector/
   - Enter your post URL (e.g., `https://stashtpro.wd-projects.online/memories?memory_id=123&post_id=456`)
   - Click "Inspect"
   - Preview image should now appear

3. **Browser test:**
   - Open `https://restapi-stasht.wd-projects.online/api/react/og-image/post/12345` in browser
   - Should display the image directly

---

## Alternative: Default Placeholder

If you want to show a default Stasht logo when no image is available, create a fallback:

```php
// In both methods, if no image found:
return response()->file(public_path('images/stasht-og-default.jpg'));
```

Upload a default OG image (1200x630px) with Stasht branding to `public/images/stasht-og-default.jpg`.

---

## Questions?

Contact the frontend team if you need:
- Exact database table/column names for posts and memories
- Current S3 bucket configuration details
- Specific image field names in the database
