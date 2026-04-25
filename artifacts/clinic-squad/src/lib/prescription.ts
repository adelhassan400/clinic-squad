import type { Prescription } from "@workspace/api-client-react";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPrintHtml(p: Prescription, clinicName: string): string {
  const itemRows = p.items
    .map(
      (it, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>
            <div class="drug">${escapeHtml(it.drug)}</div>
            ${it.notes ? `<div class="item-notes">${escapeHtml(it.notes)}</div>` : ""}
          </td>
          <td>${escapeHtml(it.dosage || "—")}</td>
          <td>${escapeHtml(it.frequency || "—")}</td>
          <td>${escapeHtml(it.duration || "—")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Prescription · ${escapeHtml(p.patientName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111;
    margin: 0;
    padding: 32px;
    background: #fff;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #0d9488;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .clinic { font-size: 22px; font-weight: 700; color: #0d9488; }
  .title { font-size: 14px; text-transform: uppercase; letter-spacing: .14em; color: #666; }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px 32px;
    margin-bottom: 18px;
    font-size: 13px;
  }
  .meta .label {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: .1em;
    color: #888;
    margin-bottom: 2px;
  }
  .meta .value { font-weight: 600; }
  .dx {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .dx-label {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: .1em;
    color: #888;
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 16px;
  }
  th, td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }
  thead th {
    background: #f8fafc;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #666;
    border-bottom: 2px solid #0d9488;
  }
  td.num { width: 30px; color: #888; }
  .drug { font-weight: 600; }
  .item-notes { color: #666; font-size: 12px; margin-top: 2px; }
  .notes {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 13px;
    margin-bottom: 24px;
    background: #fffbea;
  }
  .notes-label {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: .1em;
    color: #b45309;
    margin-bottom: 4px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 40px;
    font-size: 12px;
  }
  .signature {
    text-align: right;
  }
  .signature .line {
    border-top: 1px solid #333;
    width: 220px;
    margin-bottom: 4px;
  }
  .signature .name { font-weight: 700; }
  .small { color: #666; font-size: 11px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  .toolbar {
    text-align: center;
    margin-bottom: 16px;
  }
  .toolbar button {
    background: #0d9488;
    color: #fff;
    border: 0;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    margin: 0 4px;
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button onclick="window.close()" style="background:#64748b">Close</button>
  </div>
  <div class="sheet">
    <header>
      <div>
        <div class="clinic">${escapeHtml(clinicName || "Clinic")}</div>
        <div class="small">E-Prescription</div>
      </div>
      <div class="title">Rx</div>
    </header>

    <section class="meta">
      <div>
        <div class="label">Patient</div>
        <div class="value">${escapeHtml(p.patientName)}</div>
        <div class="small">${escapeHtml(p.patientPhone || "")}</div>
      </div>
      <div>
        <div class="label">Date</div>
        <div class="value">${escapeHtml(p.date)}</div>
      </div>
      <div>
        <div class="label">Doctor</div>
        <div class="value">Dr. ${escapeHtml(p.doctorName)}</div>
      </div>
      <div>
        <div class="label">Prescription ID</div>
        <div class="value small">${escapeHtml(p.id.slice(0, 8))}</div>
      </div>
    </section>

    ${
      p.diagnosis
        ? `<div class="dx">
            <div class="dx-label">Diagnosis</div>
            <div>${escapeHtml(p.diagnosis)}</div>
          </div>`
        : ""
    }

    <table>
      <thead>
        <tr>
          <th></th>
          <th>Medication</th>
          <th>Dosage</th>
          <th>Frequency</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    ${
      p.notes
        ? `<div class="notes">
            <div class="notes-label">Notes for the patient</div>
            <div>${escapeHtml(p.notes)}</div>
          </div>`
        : ""
    }

    <footer>
      <div class="small">Issued ${new Date(p.createdAt).toLocaleString()}</div>
      <div class="signature">
        <div class="line"></div>
        <div class="name">Dr. ${escapeHtml(p.doctorName)}</div>
        <div class="small">Signature</div>
      </div>
    </footer>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
}

export function printPrescription(p: Prescription, clinicName: string): void {
  const html = buildPrintHtml(p, clinicName);
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) {
    alert("Please allow pop-ups to print prescriptions.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  // Egyptian numbers commonly start with 0 — convert to international 20.
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return "20" + digits.slice(1);
  return digits;
}

function buildWhatsAppMessage(p: Prescription, clinicName: string): string {
  const lines: string[] = [];
  lines.push(`*${clinicName || "Clinic"} — Prescription*`);
  lines.push(`Patient: ${p.patientName}`);
  lines.push(`Date: ${p.date}`);
  lines.push(`Doctor: Dr. ${p.doctorName}`);
  if (p.diagnosis) lines.push(`Diagnosis: ${p.diagnosis}`);
  lines.push("");
  lines.push("*Medications:*");
  p.items.forEach((it, i) => {
    const detail = [it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ");
    lines.push(`${i + 1}. ${it.drug}${detail ? ` — ${detail}` : ""}`);
    if (it.notes) lines.push(`   ↳ ${it.notes}`);
  });
  if (p.notes) {
    lines.push("");
    lines.push(`Notes: ${p.notes}`);
  }
  lines.push("");
  lines.push("Get well soon 🌿");
  return lines.join("\n");
}

export function sendPrescriptionWhatsApp(p: Prescription, clinicName: string): void {
  const phone = normalizePhone(p.patientPhone || "");
  if (!phone) {
    alert("Patient has no phone number on file.");
    return;
  }
  const text = encodeURIComponent(buildWhatsAppMessage(p, clinicName));
  const url = `https://wa.me/${phone}?text=${text}`;
  window.open(url, "_blank", "noopener");
}
