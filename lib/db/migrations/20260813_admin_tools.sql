CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY DEFAULT 'global',
  basic_monthly_price text NOT NULL DEFAULT '200',
  premium_monthly_price text NOT NULL DEFAULT '400',
  vodafone_cash_number text NOT NULL DEFAULT '01009360198',
  instapay_handle text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL DEFAULT '201009360198',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  admin_id text NOT NULL,
  admin_email text NOT NULL,
  action text NOT NULL,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS system_messages (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_messages_active_idx ON system_messages (active, created_at DESC);

CREATE TABLE IF NOT EXISTS promo_codes (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_percent integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON promo_codes (active, expires_at);

INSERT INTO system_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
