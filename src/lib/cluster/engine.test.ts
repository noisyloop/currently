import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_PERTURB, PRESETS, planWorkload } from "./engine.ts";

test("70B LoRA fits one tight MI300X", () => {
  const plan = planWorkload(PRESETS[0], EMPTY_PERTURB, null);
  assert.equal(plan.placement.acceleratorId, "mi300x");
  assert.equal(plan.placement.gpus, 1);
  assert.equal(plan.placement.fit, "tight");
});

test("full 70B Adam takes one baseboard of MI300X", () => {
  const plan = planWorkload(PRESETS[1], EMPTY_PERTURB, null);
  assert.equal(plan.placement.acceleratorId, "mi300x");
  assert.equal(plan.placement.gpus, 8);
  assert.equal(plan.placement.tp, 8);
  assert.equal(plan.placement.pp, 1);
  assert.notEqual(plan.placement.fit, "overflow");
});

test("link flap narrows tensor parallel without adding GPUs", () => {
  const calm = planWorkload(PRESETS[1], EMPTY_PERTURB, null);
  const flap = planWorkload(PRESETS[1], { ...EMPTY_PERTURB, linkFlap: true }, null);
  assert.ok(flap.placement.tp < calm.placement.tp);
  assert.equal(flap.placement.tp, 1);
  assert.equal(flap.placement.pp, 8);
  assert.equal(flap.placement.gpus, calm.placement.gpus);
});

test("405B FP8 serve picks two MI325X over a dearer comfortable SKU", () => {
  const plan = planWorkload(PRESETS[2], EMPTY_PERTURB, null);
  assert.equal(plan.placement.acceleratorId, "mi325x");
  assert.equal(plan.placement.gpus, 2);
  assert.equal(plan.placement.fit, "tight");
  assert.ok((plan.placement.tokPerSec ?? 0) > 0);
});

test("8B scratch fits one comfortable MI300X", () => {
  const plan = planWorkload(PRESETS[3], EMPTY_PERTURB, null);
  assert.equal(plan.placement.acceleratorId, "mi300x");
  assert.equal(plan.placement.gpus, 1);
  assert.equal(plan.placement.fit, "comfortable");
});

test("1T FP4 decode prefers two tight MI355X", () => {
  const plan = planWorkload(PRESETS[4], EMPTY_PERTURB, null);
  assert.equal(plan.placement.acceleratorId, "mi355x");
  assert.equal(plan.placement.gpus, 2);
  assert.equal(plan.placement.fit, "tight");
});

test("HBM tax moves the 70B LoRA onto one MI325X", () => {
  const plan = planWorkload(PRESETS[0], { ...EMPTY_PERTURB, hbmTax: 0.15 }, null);
  assert.equal(plan.placement.acceleratorId, "mi325x");
  assert.equal(plan.placement.gpus, 1);
  assert.notEqual(plan.placement.fit, "overflow");
});
