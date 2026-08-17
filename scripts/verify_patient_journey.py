from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Patient:
    status: str = "registered"
    payment_method: str | None = None
    payment_reference: str | None = None
    visit_type: str = "New Consultation"


def assistant_update(patient: Patient, **updates: object) -> None:
    status = updates.get("status")
    clinical_fields = {"diagnosis", "clinicalNotes", "chronicConditions"}
    if clinical_fields.intersection(updates) or status in {"in-progress", "completed"}:
        raise PermissionError("Clinical updates require a Doctor")
    if status == "paid" and updates.get("paymentMethod") not in {"cash", "vodafone_cash", "instapay", "card", "other"}:
        raise ValueError("A payment method is required before marking a patient paid")
    if status == "waiting" and patient.status not in {"paid", "waiting", "in-progress"}:
        raise ValueError("Payment is required before check-in")
    if status:
        patient.status = str(status)
    if "paymentMethod" in updates:
        patient.payment_method = str(updates["paymentMethod"])
    if "paymentReference" in updates:
        patient.payment_reference = str(updates["paymentReference"])
    if "visitType" in updates:
        patient.visit_type = str(updates["visitType"])


def doctor_update(patient: Patient, **updates: object) -> None:
    status = updates.get("status")
    if status == "in-progress" and patient.status not in {"waiting", "in-progress"}:
        raise ValueError("Patient must be in the waiting list before starting a session")
    if status:
        patient.status = str(status)


patient = Patient()
assert patient.status == "registered"

try:
    assistant_update(patient, status="waiting")
except ValueError as error:
    assert str(error) == "Payment is required before check-in"
else:
    raise AssertionError("Unpaid patient was allowed into the waiting list")

assistant_update(patient, status="paid", paymentMethod="cash")
assert patient.status == "paid"
assert patient.payment_method == "cash"

assistant_update(patient, status="waiting", visitType="Follow-up")
assert patient.status == "waiting"
assert patient.visit_type == "Follow-up"

try:
    assistant_update(patient, status="in-progress")
except PermissionError as error:
    assert str(error) == "Clinical updates require a Doctor"
else:
    raise AssertionError("Assistant was allowed to start a clinical session")

doctor_update(patient, status="in-progress")
assert patient.status == "in-progress"
doctor_update(patient, status="completed")
assert patient.status == "completed"

checkout = (ROOT / "artifacts/clinic-squad/src/pages/checkout.tsx").read_text()
waiting = (ROOT / "artifacts/clinic-squad/src/pages/waiting-list.tsx").read_text()
lang = (ROOT / "artifacts/clinic-squad/src/lib/lang.tsx").read_text()

ui_checks = {
    "Cash is default in payment state": 'useState<PaymentMethod>("cash")',
    "Cash is reset when dialog opens": 'setPaymentMethod("cash")',
    "Cash is first in selector": '<SelectItem value="cash">',
    "paid indicator is shown in waiting list": 't("waiting.paid")',
    "paid status label exists": '"waiting.paid"',
    "queue handoff button exists": 't("checkout.sendToQueue")',
}
combined = "\n".join((checkout, waiting, lang))
for label, needle in ui_checks.items():
    assert needle in combined, f"Missing UI invariant: {label}"

print("PASS: patient starts registered")
print("PASS: unpaid patient is blocked from check-in")
print("PASS: Assistant records cash payment")
print("PASS: paid patient enters the waiting list with visit type")
print("PASS: Assistant cannot start or complete a clinical session")
print("PASS: Doctor starts and completes the consultation")
print(f"PASS: {len(ui_checks)} checkout and Waiting List UI handoff invariants verified")
print("NOTE: this is a deterministic simulation; no live database was available")
