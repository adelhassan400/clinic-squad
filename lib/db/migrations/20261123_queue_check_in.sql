-- Run before starting the new application version. Existing active queues have no
-- historical arrival time; updated_at is a best-effort backfill, not file creation.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS active_appointment_id text;
UPDATE patients SET checked_in_at = updated_at
WHERE status IN ('waiting', 'in-progress') AND checked_in_at IS NULL;
CREATE INDEX IF NOT EXISTS patients_active_queue_idx
ON patients (clinic_id, assigned_doctor_id, checked_in_at, id)
WHERE status IN ('waiting', 'in-progress');
