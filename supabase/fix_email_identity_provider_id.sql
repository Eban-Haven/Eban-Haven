-- Run in Supabase SQL Editor if you already ran seed_auth_profiles.sql with
-- provider_id = email. GoTrue requires provider_id = user UUID for email logins.
UPDATE auth.identities AS i
SET provider_id = i.user_id::text
WHERE i.provider = 'email'
  AND i.provider_id LIKE '%@%';
