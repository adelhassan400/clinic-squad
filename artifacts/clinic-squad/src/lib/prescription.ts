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
    .map((it, i) => {
      const dose = (it.dosage || "").trim();
      const freq = (it.frequency || "").trim();
      const dur = (it.duration || "").trim();
      const chips: string[] = [];
      if (dose) chips.push(`<span class="chip">${escapeHtml(dose)}</span>`);
      if (freq) chips.push(`<span class="chip">${escapeHtml(freq)}</span>`);
      if (dur) chips.push(`<span class="chip">${escapeHtml(dur)}</span>`);
      return `
        <li class="med">
          <span class="med-num">${i + 1}</span>
          <div class="med-body">
            <div class="med-drug">${escapeHtml(it.drug)}</div>
            ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
            ${it.notes ? `<div class="med-notes">↳ ${escapeHtml(it.notes)}</div>` : ""}
          </div>
        </li>
      `;
    })
    .join("");

  const formattedDate = (() => {
    try {
      return new Date(p.date + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return p.date;
    }
  })();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Prescription · ${escapeHtml(p.patientName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #18181b;
    margin: 0;
    padding: 32px;
    background: #f4f4f5;
  }
  .sheet {
    max-width: 760px;
    margin: 0 auto;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    overflow: hidden;
  }
  .accent-bar {
    height: 6px;
    background: linear-gradient(90deg, #0d9488 0%, rgba(13,148,136,0.7) 60%, rgba(13,148,136,0.3) 100%);
  }
  .padded { padding: 32px 40px; }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 18px;
    margin-bottom: 20px;
    position: relative;
  }
  .rx-mark {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    background: rgba(13,148,136,0.08);
    border: 1px solid rgba(13,148,136,0.3);
    color: #0d9488;
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 38px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .clinic-name {
    font-size: 22px;
    font-weight: 700;
    color: #18181b;
    letter-spacing: -0.01em;
  }
  .clinic-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: #71717a;
    margin-top: 2px;
  }
  .rx-stamp {
    position: absolute;
    top: 0;
    right: 0;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10px;
    color: #a1a1aa;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 32px;
    margin-bottom: 16px;
    font-size: 13px;
  }
  .label {
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.12em;
    color: #71717a;
    margin-bottom: 3px;
  }
  .value { font-weight: 600; color: #18181b; }
  .small { color: #71717a; font-size: 11px; }
  .pcode {
    display: inline-block;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(13,148,136,0.1);
    color: #0d9488;
    border: 1px solid rgba(13,148,136,0.25);
    margin-left: 6px;
    vertical-align: middle;
  }
  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    border-top: 1px solid #e4e4e7;
    border-bottom: 1px solid #e4e4e7;
    padding: 10px 0;
    margin-bottom: 18px;
    font-size: 12px;
  }
  .meta-row span.k { color: #71717a; text-transform: uppercase; font-size: 9px; letter-spacing: 0.12em; margin-right: 6px; }
  .meta-row span.v { font-weight: 600; }
  .meds-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .meds-header .rx-glyph {
    color: #0d9488;
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }
  .meds-header .meds-title {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: #71717a;
    font-weight: 600;
  }
  .meds-header .rule {
    flex: 1;
    height: 1px;
    background: #e4e4e7;
  }
  .meds-header .count {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    color: #a1a1aa;
  }
  ol.meds {
    list-style: none;
    padding: 0;
    margin: 0 0 22px;
  }
  li.med {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px dashed #e4e4e7;
  }
  li.med:last-child { border-bottom: 0; }
  .med-num {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #0d9488;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .med-body { flex: 1; min-width: 0; }
  .med-drug { font-weight: 700; font-size: 14px; color: #18181b; }
  .chips { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-block;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f4f4f5;
    color: #3f3f46;
    border: 1px solid #e4e4e7;
  }
  .med-notes {
    margin-top: 6px;
    color: #52525b;
    font-style: italic;
    font-size: 12px;
  }
  .notes {
    border: 1px solid #fde68a;
    background: #fffbeb;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 12px;
    margin-bottom: 28px;
  }
  .notes-label {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #b45309;
    margin-bottom: 4px;
    font-weight: 700;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #e4e4e7;
    font-size: 11px;
    color: #71717a;
  }
  .signature { text-align: right; }
  .signature .sig-name {
    font-family: "Brush Script MT", "Lucida Handwriting", cursive;
    font-style: italic;
    font-size: 18px;
    color: #18181b;
    padding: 0 14px 6px;
  }
  .signature .line {
    border-top: 1px solid #18181b;
    width: 220px;
    margin: 0 0 4px auto;
  }
  .signature .name { font-weight: 700; color: #18181b; }
  .ribbon {
    text-align: center;
    margin-top: 20px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3em;
    color: #d4d4d8;
  }
  @media print {
    body { padding: 0; background: #fff; }
    .sheet { box-shadow: none; border-radius: 0; }
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
    padding: 9px 18px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    margin: 0 4px;
    font-weight: 600;
  }
  .toolbar button.secondary { background: #64748b; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <div class="accent-bar"></div>
    <div class="padded">
      <header>
        <div class="rx-mark">℞</div>
        <div>
          <div class="clinic-name">${escapeHtml(clinicName || "Clinic")}</div>
          <div class="clinic-tag">Medical Prescription</div>
        </div>
        <div class="rx-stamp">Rx · ${escapeHtml(p.id.slice(0, 8))}</div>
      </header>

      <section class="meta">
        <div>
          <div class="label">Prescribed by</div>
          <div class="value">Dr. ${escapeHtml(p.doctorName)}</div>
          ${p.doctorSpecialty ? `<div class="small">${escapeHtml(p.doctorSpecialty)}</div>` : ""}
        </div>
        <div>
          <div class="label">Patient</div>
          <div class="value">${escapeHtml(p.patientName)}${p.patientCode ? `<span class="pcode">${escapeHtml(p.patientCode)}</span>` : ""}</div>
          <div class="small">${escapeHtml(p.patientPhone || "")}</div>
        </div>
      </section>

      <div class="meta-row">
        <div><span class="k">Date</span><span class="v">${escapeHtml(formattedDate)}</span></div>
        ${p.diagnosis ? `<div><span class="k">Dx</span><span class="v">${escapeHtml(p.diagnosis)}</span></div>` : ""}
      </div>

      <div class="meds-header">
        <span class="rx-glyph">℞</span>
        <span class="meds-title">Medications</span>
        <span class="rule"></span>
        <span class="count">${p.items.length}</span>
      </div>

      <ol class="meds">${itemRows}</ol>

      ${
        p.notes
          ? `<div class="notes">
              <div class="notes-label">Notes for the patient</div>
              <div>${escapeHtml(p.notes)}</div>
            </div>`
          : ""
      }

      <footer>
        <div>Issued ${new Date(p.createdAt).toLocaleString()}</div>
        <div class="signature">
          <div class="sig-name">Dr. ${escapeHtml(p.doctorName)}</div>
          <div class="line"></div>
          <div class="small">${p.doctorSpecialty ? escapeHtml(p.doctorSpecialty) : "Signature"}</div>
        </div>
      </footer>

      <div class="ribbon">Issued via ClinicSquad</div>
    </div>
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
  lines.push(`Patient: ${p.patientName}${p.patientCode ? ` (${p.patientCode})` : ""}`);
  lines.push(`Date: ${p.date}`);
  lines.push(`Doctor: Dr. ${p.doctorName}${p.doctorSpecialty ? ` — ${p.doctorSpecialty}` : ""}`);
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
