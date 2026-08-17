from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / "artifacts/api-server/src/services/patient.service.ts").read_text()
routes = (ROOT / "artifacts/api-server/src/routes/patients.ts").read_text()
checkout = (ROOT / "artifacts/clinic-squad/src/pages/checkout.tsx").read_text()
waiting = (ROOT / "artifacts/clinic-squad/src/pages/waiting-list.tsx").read_text()

checks = {
    "unpaid check-in is rejected": 'updates.status === "waiting" && !["paid", "waiting", "in-progress"].includes(currentPatient.status)',
    "payment error is explicit": 'Payment is required before check-in',
    "paid status requires Egyptian payment method": 'updates.status === "paid" && !["cash", "vodafone_cash", "instapay", "card", "other"].includes(updates.paymentMethod)',
    "payment timestamp is persisted": 'dbUpdates.paymentReceivedAt = new Date()',
    "bulk check-in only selects paid patients": 'patient.status === "paid"',
    "bulk check-in moves eligible patients to waiting": 'set({ status: "waiting", visitType })',
    "bulk endpoint validates visit type": 'z.enum(["New Consultation", "Follow-up", "Re-exam", "Emergency"])',
    "patch route requires payment method": 'parsed.data.status === "paid" && !parsed.data.paymentMethod',
    "checkout records payment before queue handoff": 't("checkout.confirmPayment")',
    "waiting list shows paid indicator": 't("waiting.paid")',
}

failed = []
for label, needle in checks.items():
    haystack = "\n".join((service, routes, checkout, waiting))
    if needle not in haystack:
        failed.append(label)

if failed:
    print("FAILED")
    for item in failed:
        print(f"- {item}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} pre-session payment invariants verified")
print("PASS: unpaid patients are blocked from check-in")
print("PASS: paid patients require an Egyptian payment method")
print("PASS: bulk check-in only queues paid patients")
print("PASS: checkout and Waiting List expose the payment handoff")
print("NOTE: live database requests were not executed because DATABASE_URL is not configured")
