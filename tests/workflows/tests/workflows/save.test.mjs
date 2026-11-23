import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(
  new URL(
    "../../artifacts/clinic-squad/src/lib/consultation-save.ts",
    import.meta.url,
  ),
  "utf8",
);
const code = ts.transpile(source, {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
});
const { ConsultationSave } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const draft = (n) => ({
  diagnosis: `diagnosis ${n}`,
  clinicalNotes: `notes ${n}`,
});
test("one in-flight save at a time; an edit during saving is flushed last, never overwritten", async () => {
  const writes = [],
    resolvers = [];
  const save = new ConsultationSave(
    (d) => {
      writes.push(d);
      return new Promise((r) => resolvers.push(r));
    },
    () => {},
  );
  save.initialize(draft(0));
  save.edit(draft(1));
  const p = save.flush();
  save.edit(draft(2));
  assert.equal(save.flush(), p);
  assert.equal(writes.length, 1);
  resolvers.shift()();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(writes, [draft(1), draft(2)]);
  resolvers.shift()();
  await p;
  assert.equal(save.dirty, false);
  assert.equal(save.status, "saved");
});
test("failed saves stay dirty, show error, and retry the latest text", async () => {
  let fail = true;
  const writes = [];
  const save = new ConsultationSave(
    async (d) => {
      writes.push(d);
      if (fail) throw Error("offline");
    },
    () => {},
  );
  save.edit(draft(1));
  await assert.rejects(save.flush());
  assert.equal(save.status, "error");
  assert.equal(save.dirty, true);
  save.edit(draft(2));
  fail = false;
  await save.flush();
  assert.deepEqual(writes, [draft(1), draft(2)]);
  assert.equal(save.dirty, false);
});
test("separate patients never share text or completion state", async () => {
  const a = [],
    b = [];
  const one = new ConsultationSave(
      async (d) => a.push(d),
      () => {},
    ),
    two = new ConsultationSave(
      async (d) => b.push(d),
      () => {},
    );
  one.initialize(draft("A"));
  two.initialize(draft("B"));
  one.edit(draft("A edited"));
  await one.flush();
  assert.deepEqual(a, [draft("A edited")]);
  assert.deepEqual(b, []);
  assert.equal(two.dirty, false);
});
