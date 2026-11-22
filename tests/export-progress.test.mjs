import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, createExportTracker } from "../src/export-progress.mjs";

const collect = (t) => {
  const events = [];
  t.subscribe((e) => events.push(e));
  return events;
};

test("reports start, each stage, then end", () => {
  const t = createExportTracker();
  const events = collect(t);
  assert.equal(t.start(), true);
  for (const s of Object.keys(STAGES)) t.stage(s);
  t.finish("done");
  assert.deepEqual(events.map((e) => e.type), ["start", "stage", "stage", "stage", "stage", "end"]);
  assert.deepEqual(events.filter((e) => e.stage).map((e) => e.label), Object.values(STAGES));
  assert.equal(events.at(-1).outcome, "done");
  assert.equal(t.busy, false);
});

test("blocks a second export while one runs, allows it after finish", () => {
  const t = createExportTracker();
  assert.equal(t.start(), true);
  assert.equal(t.start(), false);
  assert.equal(t.busy, true);
  t.finish("cancelled");
  assert.equal(t.start(), true);
});

test("ignores unknown stages and stages outside a run", () => {
  const t = createExportTracker();
  const events = collect(t);
  t.stage("render");
  t.start();
  t.stage("bogus");
  assert.deepEqual(events.map((e) => e.type), ["start"]);
});

test("finish without start emits nothing", () => {
  const t = createExportTracker();
  const events = collect(t);
  t.finish("done");
  assert.equal(events.length, 0);
});

test("unsubscribe stops events", () => {
  const t = createExportTracker();
  const events = [];
  const off = t.subscribe((e) => events.push(e));
  off();
  t.start();
  assert.equal(events.length, 0);
});
