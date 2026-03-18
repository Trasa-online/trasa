-- Store cookie consent in user profile for cross-device reliability
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cookie_consent TEXT CHECK (cookie_consent IN ('granted', 'denied'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cookie_consent_at TIMESTAMPTZ;
