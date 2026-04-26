import type { Prescription } from "@workspace/api-client-react";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STETHOSCOPE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34" aria-hidden="true">
  <path d="M11 2v2"/>
  <path d="M5 2v2"/>
  <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/>
  <path d="M8 15a6 6 0 0 0 12 0v-3"/>
  <circle cx="20" cy="10" r="2"/>
</svg>`;

const CADUCEUS_WATERMARK_SVG = `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="currentColor" stroke="currentColor">
    <path d="M50 18 Q22 12 8 28 Q14 30 24 28 Q38 26 50 24 Z" stroke="none"/>
    <path d="M50 18 Q78 12 92 28 Q86 30 76 28 Q62 26 50 24 Z" stroke="none"/>
    <circle cx="50" cy="16" r="5" stroke="none"/>
    <line x1="50" y1="22" x2="50" y2="132" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 36 C36 44 36 56 50 60 C64 64 64 76 50 80 C36 84 36 96 50 100 C64 104 64 116 50 120" fill="none" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M50 36 C64 44 64 56 50 60 C36 64 36 76 50 80 C64 84 64 96 50 100 C36 104 36 116 50 120" fill="none" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="38" cy="42" r="2" stroke="none"/>
    <circle cx="62" cy="42" r="2" stroke="none"/>
    <path d="M50 130 L46 138 L54 138 Z" stroke="none"/>
  </g>
</svg>`;

const PIN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

const PHONE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>`;

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

  const specialtyLine = p.doctorSpecialty ? escapeHtml(p.doctorSpecialty) : "Medical Practitioner";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Prescription · ${escapeHtml(p.patientName)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 28px 16px;
    background: linear-gradient(135deg, #5eead4 0%, #14b8a6 100%);
    min-height: 100vh;
  }
  .sheet {
    max-width: 760px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 6px;
    box-shadow: 0 30px 60px rgba(15, 23, 42, 0.18), 0 8px 20px rgba(15, 23, 42, 0.1);
    overflow: hidden;
    position: relative;
  }

  /* ===== Header ===== */
  .rx-header {
    position: relative;
    height: 110px;
    overflow: hidden;
  }
  .rx-banner {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 70%;
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
    color: #fff;
    display: flex;
    align-items: center;
    padding: 0 38px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 70px) 100%, 0 100%);
  }
  .rx-banner-stripe {
    position: absolute;
    top: 0;
    left: 60%;
    width: 60px;
    height: 100%;
    background: linear-gradient(135deg, rgba(20, 184, 166, 0.55), rgba(13, 148, 136, 0.35));
    clip-path: polygon(0 0, 100% 0, calc(100% - 50px) 100%, 0 100%);
  }
  .rx-banner-stripe.b {
    left: 70%;
    width: 40px;
    background: linear-gradient(135deg, rgba(20, 184, 166, 0.3), rgba(13, 148, 136, 0.15));
  }
  .doc-name {
    font-size: 26px;
    font-weight: 300;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: #ffffff;
  }
  .doc-name b {
    font-weight: 800;
    margin-right: 4px;
  }
  .doc-qual {
    font-size: 10px;
    letter-spacing: 0.32em;
    color: rgba(255, 255, 255, 0.92);
    margin-top: 6px;
    text-transform: uppercase;
    font-weight: 500;
  }
  .rx-icon-disk {
    position: absolute;
    right: 36px;
    top: 50%;
    transform: translateY(-50%);
    width: 70px;
    height: 70px;
    border-radius: 50%;
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 18px rgba(20, 184, 166, 0.35);
    border: 3px solid #ffffff;
  }
  .rx-stamp {
    position: absolute;
    top: 8px;
    right: 130px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
    color: rgba(15, 23, 42, 0.45);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  /* ===== Patient info form ===== */
  .rx-info {
    padding: 22px 40px 18px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 36px;
    font-size: 12.5px;
  }
  .rx-info .row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    min-height: 22px;
  }
  .rx-info .k {
    color: #475569;
    font-weight: 500;
    flex-shrink: 0;
  }
  .rx-info .v {
    color: #0f172a;
    font-weight: 600;
    flex: 1;
  }
  .rx-info .row.full {
    grid-column: 1 / -1;
  }
  .pcode {
    display: inline-block;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(20, 184, 166, 0.12);
    color: #0d9488;
    border: 1px solid rgba(20, 184, 166, 0.3);
    margin-left: 6px;
    vertical-align: middle;
    font-weight: 600;
  }

  /* ===== Body / meds ===== */
  .rx-body {
    position: relative;
    padding: 14px 40px 28px;
    min-height: 320px;
  }
  .rx-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -45%);
    width: 320px;
    height: 420px;
    color: #14b8a6;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }
  .rx-watermark svg {
    width: 100%;
    height: 100%;
  }
  .rx-mark {
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 56px;
    font-weight: 700;
    color: #0f172a;
    line-height: 0.85;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
  }
  .rx-mark .r {
    color: #0f172a;
  }
  .rx-mark .x {
    color: #0d9488;
    margin-left: -10px;
    font-style: italic;
  }
  ol.meds {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    position: relative;
    z-index: 1;
  }
  li.med {
    display: flex;
    gap: 14px;
    padding: 10px 0;
    border-bottom: 1px dashed #e2e8f0;
  }
  li.med:last-child { border-bottom: 0; }
  .med-num {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25);
  }
  .med-body { flex: 1; min-width: 0; }
  .med-drug {
    font-weight: 700;
    font-size: 14px;
    color: #0f172a;
    letter-spacing: -0.005em;
  }
  .chips {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-block;
    font-size: 11px;
    padding: 2px 9px;
    border-radius: 999px;
    background: rgba(20, 184, 166, 0.08);
    color: #0d9488;
    border: 1px solid rgba(20, 184, 166, 0.25);
    font-weight: 500;
  }
  .med-notes {
    margin-top: 6px;
    color: #475569;
    font-style: italic;
    font-size: 12px;
  }
  .notes {
    margin-top: 14px;
    border-left: 3px solid #14b8a6;
    background: rgba(20, 184, 166, 0.06);
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 12px;
    position: relative;
    z-index: 1;
  }
  .notes-label {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: #0d9488;
    margin-bottom: 4px;
    font-weight: 700;
  }

  /* ===== Signature ===== */
  .rx-signature {
    padding: 18px 40px 12px;
    display: flex;
    justify-content: flex-end;
    position: relative;
    z-index: 1;
  }
  .sig-block {
    text-align: center;
    min-width: 220px;
  }
  .sig-name {
    font-family: "Brush Script MT", "Lucida Handwriting", "Segoe Script", cursive;
    font-style: italic;
    font-size: 20px;
    color: #0f172a;
    padding-bottom: 4px;
  }
  .sig-line {
    border-top: 1px solid #0f172a;
    margin: 0 auto 4px;
    width: 200px;
  }
  .sig-label {
    font-size: 10px;
    color: #475569;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  /* ===== Footer ===== */
  .rx-footer {
    position: relative;
    margin-top: 6px;
    padding: 14px 40px;
    background: linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%);
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #334155;
  }
  .rx-footer .clinic {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #0f172a;
    font-size: 11.5px;
  }
  .rx-footer .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #475569;
  }
  .rx-footer .item svg {
    color: #0d9488;
  }
  .rx-ribbon {
    text-align: center;
    padding: 8px 0 14px;
    font-size: 9px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  /* ===== Print ===== */
  @media print {
    body {
      background: #ffffff;
      padding: 0;
    }
    .sheet {
      box-shadow: none;
      border-radius: 0;
      max-width: 100%;
    }
    .no-print { display: none !important; }
  }

  /* ===== Toolbar ===== */
  .toolbar {
    text-align: center;
    margin-bottom: 18px;
  }
  .toolbar button {
    background: #ffffff;
    color: #0d9488;
    border: 0;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    margin: 0 4px;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  }
  .toolbar button.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    backdrop-filter: blur(8px);
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <header class="rx-header">
      <div class="rx-banner">
        <div>
          <div class="doc-name"><b>Dr. ${escapeHtml(p.doctorName)}</b></div>
          <div class="doc-qual">${specialtyLine}</div>
        </div>
      </div>
      <div class="rx-banner-stripe"></div>
      <div class="rx-banner-stripe b"></div>
      <div class="rx-stamp">Rx · ${escapeHtml(p.id.slice(0, 8))}</div>
      <div class="rx-icon-disk">${STETHOSCOPE_SVG}</div>
    </header>

    <section class="rx-info">
      <div class="row">
        <span class="k">Patient Name:</span>
        <span class="v">${escapeHtml(p.patientName)}${p.patientCode ? `<span class="pcode">${escapeHtml(p.patientCode)}</span>` : ""}</span>
      </div>
      <div class="row">
        <span class="k">Date:</span>
        <span class="v">${escapeHtml(formattedDate)}</span>
      </div>
      <div class="row">
        <span class="k">Phone:</span>
        <span class="v">${escapeHtml(p.patientPhone || "—")}</span>
      </div>
      <div class="row">
        <span class="k">Rx ID:</span>
        <span class="v" style="font-family: ui-monospace, Menlo, monospace; font-size: 11px;">${escapeHtml(p.id.slice(0, 12))}</span>
      </div>
      <div class="row full">
        <span class="k">Diagnosis:</span>
        <span class="v">${escapeHtml(p.diagnosis || "—")}</span>
      </div>
    </section>

    <section class="rx-body">
      <div class="rx-watermark">${CADUCEUS_WATERMARK_SVG}</div>
      <div class="rx-mark"><span class="r">R</span><span class="x">x</span></div>
      <ol class="meds">${itemRows}</ol>
      ${
        p.notes
          ? `<div class="notes">
              <div class="notes-label">Notes for the patient</div>
              <div>${escapeHtml(p.notes)}</div>
            </div>`
          : ""
      }
    </section>

    <div class="rx-signature">
      <div class="sig-block">
        <div class="sig-name">Dr. ${escapeHtml(p.doctorName)}</div>
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
      </div>
    </div>

    <footer class="rx-footer">
      <div class="clinic">${escapeHtml(clinicName || "Clinic")}</div>
      <div class="item">${PIN_SVG}<span>${escapeHtml(p.doctorSpecialty || "Medical Practice")}</span></div>
      <div class="item">${PHONE_SVG}<span>${escapeHtml(p.patientPhone || "—")}</span></div>
    </footer>

    <div class="rx-ribbon">Issued via ClinicSquad · ${new Date(p.createdAt).toLocaleString()}</div>
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
