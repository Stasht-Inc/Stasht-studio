<?php
// config/cors.php - Environment-based CORS Configuration
// This allows you to set different CORS settings per environment

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:5173'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];

// Then in your .env file, add:
// CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://stashtpro.wd-projects.site