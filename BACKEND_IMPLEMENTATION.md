# Backend Implementation for Cross-Tab Login Blocking

## Laravel Routes

Add these routes to your `routes/api.php` or routes file:

```php
// Add to your existing API routes
Route::get('auth/check', [UserController::class, 'checkAuth']);
Route::post('login', [UserController::class, 'login']); // Updated to handle conflicts
```

## Laravel Controller Methods

### 1. Check Authentication Status

Add this method to your `UserController`:

```php
/**
 * Check if user is already authenticated in browser session
 */
public function checkAuth(Request $request)
{
    try {
        $user = Auth::user();

        if ($user) {
            return response()->json([
                'success' => true,
                'data' => [
                    'isAuthenticated' => true,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar' => $user->avatar,
                        'profile_color' => $user->profile_color,
                    ]
                ]
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'isAuthenticated' => false
            ]
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => 'Failed to check authentication status'
        ], 500);
    }
}
```

### 2. Updated Login Method

Update your existing login method to handle conflicts:

```php
/**
 * Handle user login with cross-tab conflict detection
 */
public function login(Request $request)
{
    try {
        // Validate request
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Check if user is already authenticated
        $currentUser = Auth::user();
        if ($currentUser) {
            // If different user is trying to login, return conflict
            if ($currentUser->email !== $request->email) {
                return response()->json([
                    'success' => false,
                    'error' => "Already logged in as {$currentUser->name}, please logout first.",
                    'message' => "Already logged in as {$currentUser->name}, please logout first.",
                    'currentUser' => [
                        'id' => $currentUser->id,
                        'name' => $currentUser->name,
                        'email' => $currentUser->email,
                    ]
                ], 409); // 409 Conflict status code
            }

            // Same user trying to login again - allow it
            // You might want to refresh the token here
            $token = $currentUser->createToken('auth-token')->plainTextToken;

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $currentUser->id,
                        'name' => $currentUser->name,
                        'email' => $currentUser->email,
                        'avatar' => $currentUser->avatar,
                        'profile_color' => $currentUser->profile_color,
                        'role' => $currentUser->role,
                        'phone_number' => $currentUser->phone_number,
                        'bio' => $currentUser->bio,
                        'location' => $currentUser->location,
                    ],
                    'token' => $token,
                    'token_type' => 'Bearer'
                ]
            ]);
        }

        // No user currently authenticated - proceed with normal login
        $credentials = $request->only('email', 'password');

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid credentials',
                'message' => 'Invalid email or password'
            ], 401);
        }

        $user = Auth::user();
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar' => $user->avatar,
                    'profile_color' => $user->profile_color,
                    'role' => $user->role,
                    'phone_number' => $user->phone_number,
                    'bio' => $user->bio,
                    'location' => $user->location,
                ],
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ]);

    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'error' => 'Validation failed',
            'message' => 'Please check your input',
            'errors' => $e->errors()
        ], 422);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => 'Login failed',
            'message' => 'An error occurred during login'
        ], 500);
    }
}
```

### 3. Enhanced Logout Method

Make sure your logout method is robust:

```php
/**
 * Handle user logout
 */
public function logout(Request $request)
{
    try {
        $user = Auth::user();

        if ($user) {
            // Revoke all tokens for the user
            $user->tokens()->delete();

            // Logout from current session
            Auth::logout();

            // Invalidate session
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'error' => 'Logout failed',
            'message' => 'An error occurred during logout'
        ], 500);
    }
}
```

## Session Configuration

Make sure your session configuration supports the conflict detection:

### config/session.php
```php
return [
    // ... other config

    // Ensure sessions are driver by database or redis for cross-request persistence
    'driver' => env('SESSION_DRIVER', 'database'),

    // Set appropriate session lifetime
    'lifetime' => env('SESSION_LIFETIME', 120),

    // Ensure sessions work across subdomains if needed
    'domain' => env('SESSION_DOMAIN', null),

    // Make sessions secure in production
    'secure' => env('SESSION_SECURE_COOKIE', false),

    // Prevent JavaScript access to session cookie
    'http_only' => true,

    // ... other config
];
```

## Middleware (Optional)

You can create a middleware to automatically check for conflicts:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckAuthConflict
{
    public function handle(Request $request, Closure $next)
    {
        // Only apply to login routes
        if ($request->is('api/login') && $request->isMethod('post')) {
            $currentUser = Auth::user();
            $requestEmail = $request->input('email');

            if ($currentUser && $currentUser->email !== $requestEmail) {
                return response()->json([
                    'success' => false,
                    'error' => "Already logged in as {$currentUser->name}, please logout first.",
                    'currentUser' => [
                        'id' => $currentUser->id,
                        'name' => $currentUser->name,
                        'email' => $currentUser->email,
                    ]
                ], 409);
            }
        }

        return $next($request);
    }
}
```

Then register it in `app/Http/Kernel.php`:

```php
protected $routeMiddleware = [
    // ... other middleware
    'auth.conflict' => \App\Http\Middleware\CheckAuthConflict::class,
];
```

And apply it to your login route:

```php
Route::post('login', [UserController::class, 'login'])->middleware('auth.conflict');
```

## Testing the Implementation

### Test Cases:

1. **Normal Login**: User logs in normally - should work
2. **Same User Re-login**: Same user tries to login again - should work (refresh token)
3. **Different User Login**: Different user tries to login - should return 409 conflict
4. **After Logout**: After logout, different user can login - should work

### Example Test Responses:

**Conflict Response (409):**
```json
{
    "success": false,
    "error": "Already logged in as John Doe, please logout first.",
    "currentUser": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
    }
}
```

**Successful Login (200):**
```json
{
    "success": true,
    "data": {
        "user": {
            "id": 1,
            "name": "John Doe",
            "email": "john@example.com",
            "avatar": "...",
            "profile_color": "#6C60FF"
        },
        "token": "...",
        "token_type": "Bearer"
    }
}
```

This implementation provides robust cross-tab login blocking with proper error handling and user feedback.