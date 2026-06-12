<?php
// app/Http/Middleware/CorsMiddleware.php
// Create this file if you don't have Laravel Sanctum CORS package

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'https://stashtpro.wd-projects.site',
            'https://studio.stasht.com',

        ];

        $origin = $request->header('Origin');

        // Handle preflight OPTIONS request
        if ($request->getMethod() == 'OPTIONS') {
            $response = response('', 200);
        } else {
            $response = $next($request);
        }

        // Set CORS headers
        if (in_array($origin, $allowedOrigins)) {
            $response->header('Access-Control-Allow-Origin', $origin);
        }

        $response->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With');
        $response->header('Access-Control-Allow-Credentials', 'true');
        $response->header('Access-Control-Max-Age', '86400');

        return $response;
    }
}

// Don't forget to register this middleware in app/Http/Kernel.php:
// In the $middleware array, add: \App\Http\Middleware\CorsMiddleware::class,