import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCreatePrescription,
  presetLabel,
  presetValue,
  FREQUENCY_PRESETS,
  DURATION_PRESETS,
} from "./prescription-ui.ts";

test("admin, doctor and superadmin can create prescriptions", () => {
  for (const r of ["admin", "doctor", "superadmin"]) assert.equal(canCreatePrescription(r), true);
});

test("nurse, assistant, secretary and missing roles cannot", () => {
  for (const r of ["nurse", "assistant", "secretary", "", undefined, null]) {
    assert.equal(canCreatePrescription(r as string | undefined | null), false);
  }
});

test("stored preset value stays English in every UI language", () => {
  for (const p of [...FREQUENCY_PRESETS, ...DURATION_PRESETS]) {
    assert.equal(presetValue(p), p.en);
    assert.notEqual(presetValue(p), presetLabel(p, "ar"));
  }
});

test("presets are translated in Arabic and unchanged in English", () => {
  for (const p of [...FREQUENCY_PRESETS, ...DURATION_PRESETS]) {
    assert.equal(presetLabel(p, "en"), p.en);
    assert.notEqual(presetLabel(p, "ar"), p.en);
    assert.match(presetLabel(p, "ar"), /[\u0600-\u06FF]/);
  }
});
