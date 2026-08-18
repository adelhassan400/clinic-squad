-- Repair migration for environments where the original patient payment migration was only partially applied.
-- All operations are idempotent and preserve existing patient records.
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS assigned_doctor_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_collected_by text,
  ADD COLUMN IF NOT EXISTS payment_shift_date text,
  ADD COLUMN IF NOT EXISTS payment_received_at timestamptz;

CREATE TABLE IF NOT EXISTS cash_transactions (
  id text PRIMARY KEY,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  doctor_id text,
  collected_by text,
  visit_type text NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  payment_method text,
  shift_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patients_payment_received_at_idx
  ON patients (clinic_id, payment_received_at DESC);

CREATE INDEX IF NOT EXISTS patients_payment_method_idx
  ON patients (clinic_id, payment_method);

CREATE INDEX IF NOT EXISTS cash_transactions_shift_idx
  ON cash_transactions (clinic_id, shift_date, created_at DESC);

CREATE INDEX IF NOT EXISTS cash_transactions_patient_idx
  ON cash_transactions (clinic_id, patient_id);
