-- Update site URL and redirect URLs for local Supabase auth
UPDATE auth.config
SET site_url = 'http://localhost:3000',
    additional_redirect_urls = ARRAY[
      'http://localhost:3000/auth/callback',
      'http://127.0.0.1:3000/auth/callback',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

-- Display the updated configuration
SELECT * FROM auth.config; 