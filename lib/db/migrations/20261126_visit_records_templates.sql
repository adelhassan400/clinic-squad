-- Run on the production database BEFORE deploying the version that uses these tables.
-- Only creates new tables; no existing table or row is changed.
CREATE TABLE IF NOT EXISTS visit_records (
  id text PRIMARY KEY,
  clinic_id text NOT NULL,
  patient_id text NOT NULL,
  visit_date text NOT NULL,
  vitals jsonb,
  vitals_by text,
  vitals_by_name text,
  ready_at timestamptz,
  diagnosis text,
  clinical_notes text,
  doctor_id text,
  doctor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS visit_records_patient_day_idx
  ON visit_records (clinic_id, patient_id, visit_date);

CREATE TABLE IF NOT EXISTS prescription_templates (
  id text PRIMARY KEY,
  clinic_id text NOT NULL,
  doctor_id text NOT NULL,
  name text NOT NULL,
  diagnosis text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS prescription_templates_doctor_name_idx
  ON prescription_templates (clinic_id, doctor_id, name);
