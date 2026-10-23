export type Mode = "train" | "tune" | "serve";
export type Precision = "bf16" | "fp8" | "fp4";
export type Optimizer = "adamw" | "adamw8bit";
export type Fit = "comfortable" | "tight" | "overflow";

export type Workload = {
  id: string;
  name: string;
  mode: Mode;
  paramsB: number;
  layers: number;
  hidden: number;
  heads: number;
  kvHeads: number;
  headDim: number;
  precision: Precision;
  seq: number;
  batch: number;
  microBatch: number;
  hours: number;
  loraRank: number;
  optimizer: Optimizer;
};

export type Perturb = {
  hbmTax: number;
  linkFlap: boolean;
  straggler: boolean;
  preempt: boolean;
};

export const EMPTY_PERTURB: Perturb = {
  hbmTax: 0,
  linkFlap: false,
  straggler: false,
  preempt: false,
};

export type Accelerator = {
  id: string;
  name: string;
  vramGb: number;
  bandwidthTBs: number;
  bf16Tflops: number;
  fp8Tflops: number;
  usdPerHour: number;
  generation: string;
};

/** Dense vendor-class peaks. Used as captions, not as the fit. */
export const ACCELERATORS: Accelerator[] = [
  {
    id: "mi300x",
    name: "Instinct MI300X",
    vramGb: 192,
    bandwidthTBs: 5.3,
    bf16Tflops: 1307,
    fp8Tflops: 2614,
    usdPerHour: 1.71,
    generation: "CDNA 3 · 192 GB HBM3",
  },
  {
    id: "mi325x",
    name: "Instinct MI325X",
    vramGb: 256,
    bandwidthTBs: 6,
    bf16Tflops: 1307,
    fp8Tflops: 2614,
    usdPerHour: 2.25,
    generation: "CDNA 3 · 256 GB HBM3E",
  },
  {
    id: "mi355x",
    name: "Instinct MI355X",
    vramGb: 288,
    bandwidthTBs: 8,
    bf16Tflops: 2500,
    fp8Tflops: 5000,
    usdPerHour: 2.95,
    generation: "CDNA 4 · 288 GB HBM3E",
  },
];

export type Breakdown = {
  weightsGb: number;
  optimizerGb: number;
  activationsGb: number;
  kvGb: number;
  taxGb: number;
};

export type Placement = {
  acceleratorId: string;
  acceleratorName: string;
  generation: string;
  vramGb: number;
  bandwidthTBs: number;
  usdPerGpuHour: number;
  tp: number;
  pp: number;
  dp: number;
  gpus: number;
  nodes: number;
  perGpuGb: number;
  usableGb: number;
  headroom: number;
  fit: Fit;
  breakdown: Breakdown;
  residentGb: number;
  gradAccum: number;
  sequencesPerReplica: number;
  usdPerHour: number;
  usdTotal: number;
  tokPerSec: number | null;
  stepStretch: number;
  warnings: string[];
};

export type TraceStep = { id: string; title: string; detail: string };

export type Plan = {
  placement: Placement;
  alts: Placement[];
  trace: TraceStep[];
};

const ANCHORS = [
  { p: 1.5, layers: 24, hidden: 2048, kv: 8 },
  { p: 8, layers: 32, hidden: 4096, kv: 8 },
  { p: 70, layers: 80, hidden: 8192, kv: 8 },
  { p: 405, layers: 126, hidden: 16384, kv: 8 },
  { p: 1000, layers: 160, hidden: 20480, kv: 16 },
];

const shape70 = {
  paramsB: 70,
  layers: 80,
  hidden: 8192,
  heads: 64,
  kvHeads: 8,
  headDim: 128,
};

export const PRESETS: Workload[] = [
  {
    id: "tune-70",
    name: "70B tune",
    mode: "tune",
    ...shape70,
    precision: "bf16",
    seq: 4096,
    batch: 32,
    microBatch: 1,
    hours: 6,
    loraRank: 16,
    optimizer: "adamw8bit",
  },
  {
    id: "full-70",
    name: "70B full",
    mode: "train",
    ...shape70,
    precision: "bf16",
    seq: 4096,
    batch: 64,
    microBatch: 1,
    hours: 12,
    loraRank: 0,
    optimizer: "adamw",
  },
  {
    id: "serve-405",
    name: "405B serve",
    mode: "serve",
    paramsB: 405,
    layers: 126,
    hidden: 16384,
    heads: 128,
    kvHeads: 8,
    headDim: 128,
    precision: "fp8",
    seq: 8192,
    batch: 8,
    microBatch: 1,
    hours: 4,
    loraRank: 0,
    optimizer: "adamw8bit",
  },
  {
    id: "scratch-8",
    name: "8B scratch",
    mode: "train",
    paramsB: 8,
    layers: 32,
    hidden: 4096,
    heads: 32,
    kvHeads: 8,
    headDim: 128,
    precision: "bf16",
    seq: 2048,
    batch: 128,
    microBatch: 4,
    hours: 24,
    loraRank: 0,
    optimizer: "adamw",
  },
  {
    id: "decode-1t",
    name: "1T decode",
    mode: "serve",
    paramsB: 1000,
    layers: 160,
    hidden: 20480,
    heads: 160,
    kvHeads: 16,
    headDim: 128,
    precision: "fp4",
    seq: 4096,
    batch: 4,
    microBatch: 1,
    hours: 2,
    loraRank: 0,
    optimizer: "adamw8bit",
  },
];

export const ASSUMPTIONS: string[] = [
  "Weights: params × 2 bytes (BF16), 1 byte (FP8), or 0.5 byte (FP4).",
  "LoRA trainable count assumes seven linears (q, k, v, o, gate, up, down): 2 × rank × hidden × 7 × layers. The frozen base stays resident.",
  "AdamW adds 12 bytes of FP32 master, momentum, and variance, plus 2 bytes of gradient. 8-bit Adam keeps the FP32 master and packs the moments, 6 + 2 bytes.",
  "Training activations are a selective-checkpoint estimate: micro-batch × sequence × hidden × layers × 10 bytes. Not a profiler.",
  "Inference KV is 2 × layers × KV heads × head dim × sequence × sequences-on-that-replica × weight bytes. FP4 KV is optimistic — many runtimes keep the cache in FP8.",
  "Tensor and pipeline parallel split weights, optimizer state, and activations. KV splits across pipeline stages and across min(TP, KV heads).",
  "A placement is legal at or under 90% of HBM. Comfortable means at or under 78%. Search is powers of two, TP and PP at most 8 (one baseboard), DP at most 32, and at most 512 GPUs.",
  "Decode tok/s reads the weight shard from HBM once per step and emits one token per resident sequence. Collectives tax wide TP. Prefill, compute ceilings, and expert routing are not in the number.",
  "Training step stretch is pipeline bubble × collective tax × a 1.35 straggler. It is a ratio, not seconds.",
  "Prices are public on-demand listings around Oct 2026 ($1.71 / $2.25 / $2.95 per GPU-hour). Not a TensorWave quote. Peaks are AMD dense matrix figures and do not decide the fit.",
];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function weightBytes(precision: Precision): number {
  if (precision === "bf16") return 2;
  if (precision === "fp8") return 1;
  return 0.5;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundTo(n: number, step: number): number {
  return Math.max(step, Math.round(n / step) * step);
}

export function shapeForParams(
  paramsB: number,
): Pick<Workload, "layers" | "hidden" | "heads" | "kvHeads" | "headDim"> {
  const p = clamp(paramsB, 0.5, 4000);
  let layers = ANCHORS[0].layers;
  let hidden = ANCHORS[0].hidden;
  let kv = ANCHORS[0].kv;
  const last = ANCHORS[ANCHORS.length - 1];
  if (p >= last.p) {
    const prev = ANCHORS[ANCHORS.length - 2];
    const t = Math.log(p / last.p) / Math.log(last.p / prev.p);
    layers = Math.round(last.layers * (1 + 0.15 * t));
    hidden = roundTo(last.hidden * (1 + 0.1 * t), 128);
    kv = 16;
  } else {
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      const a = ANCHORS[i];
      const b = ANCHORS[i + 1];
      if (p <= b.p) {
        const t = Math.log(p / a.p) / Math.log(b.p / a.p);
        layers = Math.max(4, Math.round(lerp(a.layers, b.layers, t)));
        hidden = roundTo(lerp(a.hidden, b.hidden, t), 128);
        kv = p >= 700 ? 16 : a.kv;
        break;
      }
    }
  }
  const heads = Math.max(1, Math.round(hidden / 128));
  return {
    layers,
    hidden,
    heads,
    kvHeads: Math.min(kv, heads),
    headDim: 128,
  };
}

function sanitize(workload: Workload, perturb: Perturb): { workload: Workload; perturb: Perturb } {
  const heads = Math.round(clamp(workload.heads, 1, 256));
  return {
    workload: {
      ...workload,
      paramsB: clamp(workload.paramsB, 0.1, 4000),
      layers: Math.round(clamp(workload.layers, 1, 400)),
      hidden: Math.round(clamp(workload.hidden, 128, 32768)),
      heads,
      kvHeads: Math.round(clamp(workload.kvHeads, 1, heads)),
      headDim: Math.round(clamp(workload.headDim, 32, 256)),
      seq: Math.round(clamp(workload.seq, 128, 262144)),
      batch: Math.round(clamp(workload.batch, 1, 8192)),
      microBatch: Math.round(clamp(workload.microBatch, 1, 64)),
      hours: clamp(workload.hours, 0.5, 720),
      loraRank: Math.round(clamp(workload.loraRank, 0, 256)),
    },
    perturb: {
      ...perturb,
      hbmTax: clamp(perturb.hbmTax, 0, 0.4),
    },
  };
}

type Candidate = Placement & { score: number; overGb: number };

function fitOf(perGpu: number, vram: number, usable: number): Fit {
  if (perGpu > usable) return "overflow";
  if (perGpu > vram * 0.78) return "tight";
  return "comfortable";
}

function evaluate(
  workload: Workload,
  perturb: Perturb,
  accel: Accelerator,
  tp: number,
  pp: number,
  dp: number,
  pinned: boolean,
): Candidate {
  const bpp = weightBytes(workload.precision);
  const residentGb = workload.paramsB * bpp;
  const loraB =
    workload.mode === "tune" && workload.loraRank > 0
      ? (2 * workload.loraRank * workload.hidden * 7 * workload.layers) / 1e9
      : 0;
  const trainableB =
    workload.mode === "serve" ? 0 : workload.mode === "tune" && workload.loraRank > 0 ? loraB : workload.paramsB;
  const optBpp = workload.mode === "serve" ? 0 : workload.optimizer === "adamw" ? 14 : 8;
  const optimizerTotal = trainableB * optBpp;
  const actTotal =
    workload.mode === "serve"
      ? 0
      : (workload.microBatch * workload.seq * workload.hidden * workload.layers * 10) / 1e9;
  const sequencesPerReplica = workload.mode === "serve" ? Math.ceil(workload.batch / dp) : 0;
  const kvTotal =
    workload.mode === "serve"
      ? (2 * workload.layers * workload.kvHeads * workload.headDim * workload.seq * sequencesPerReplica * bpp) /
        1e9
      : 0;

  const shard = tp * pp;
  const kvWays = Math.max(1, Math.min(tp, workload.kvHeads));
  const weightsGb = residentGb / shard;
  const optimizerGb = optimizerTotal / shard;
  const activationsGb = actTotal / shard;
  const kvGb = kvTotal / (pp * kvWays);
  const subtotal = weightsGb + optimizerGb + activationsGb + kvGb;
  const taxGb = subtotal * perturb.hbmTax;
  const perGpuGb = subtotal + taxGb;
  const usableGb = accel.vramGb * 0.9;
  const headroom = (accel.vramGb - perGpuGb) / accel.vramGb;
  const fit = fitOf(perGpuGb, accel.vramGb, usableGb);
  const gpus = tp * pp * dp;
  const nodes = gpus <= 8 ? 1 : gpus / 8;
  const gradAccum =
    workload.mode === "serve" ? 1 : Math.max(1, Math.ceil(workload.batch / (workload.microBatch * dp)));

  const bubble = (gradAccum + pp - 1) / gradAccum;
  const comm = tp === 1 ? 1 : perturb.linkFlap ? 1 + 0.45 * Math.log2(tp) : 1 + 0.12 * Math.log2(tp);
  const stepStretch = (workload.mode === "serve" ? 1 : bubble) * comm * (perturb.straggler ? 1.35 : 1);

  let tokPerSec: number | null = null;
  if (workload.mode === "serve" && weightsGb > 0) {
    const shardBytes = weightsGb * 1e9;
    const tax = tp === 1 ? 1 : perturb.linkFlap ? 1 + 0.9 * (tp - 1) : 1 + 0.35 * (tp - 1);
    const perReplica = (sequencesPerReplica * (accel.bandwidthTBs * 1e12)) / shardBytes / tax;
    tokPerSec = perReplica * dp;
  }

  const usdPerHour = gpus * accel.usdPerHour;
  const overGb = Math.max(0, perGpuGb - usableGb);
  let score = overGb > 0 ? 1e9 + overGb * 1000 + gpus : usdPerHour;
  if (overGb === 0) {
    score *= 1 + 0.04 * (pp - 1);
    if (perturb.linkFlap && tp > 1) score *= 1 + 0.15 * Math.log2(tp);
  }

  const warnings: string[] = [];
  if (fit === "overflow") {
    warnings.push(
      `Over HBM by ${overGb.toFixed(1)} GB per GPU. Nothing in the search stays under 90% on this SKU.`,
    );
  } else if (fit === "tight") {
    warnings.push("Headroom is under 22%. A longer context or a runtime spike will OOM this.");
  }
  if (pp > 1 && workload.mode !== "serve" && gradAccum < pp) {
    warnings.push(`Pipeline depth ${pp} with only ${gradAccum} accumulation step. The bubble dominates.`);
  }
  if (perturb.linkFlap && tp > 2) {
    warnings.push("Tensor parallel is still wide on a flapping fabric. Collectives will own the step.");
  }
  if (perturb.straggler) {
    warnings.push("One slow rank gates the group. Stretch assumes everyone waits.");
  }
  if (perturb.preempt) {
    warnings.push("Treat the capacity as preemptible. Checkpoint at least every 15 minutes.");
  }
  if (perturb.hbmTax >= 0.15) {
    warnings.push("HBM tax is doing real work here — fragmentation and runtime, not weights.");
  }
  if (workload.mode === "serve" && workload.precision === "fp4") {
    warnings.push("KV is counted in FP4. Budget extra if the runtime keeps the cache in FP8.");
  }
  if (gpus >= 64) {
    warnings.push("Cross-rack hops are not in the stretch. The model stops at the node fabric.");
  }
  if (pinned && fit === "overflow") {
    warnings.push("This SKU is pinned. Clear the pin and the desk can pick another.");
  }
  if (workload.mode === "serve" && workload.kvHeads < tp) {
    warnings.push(`Only ${workload.kvHeads} KV heads, so TP past that does not split the cache.`);
  }

  return {
    acceleratorId: accel.id,
    acceleratorName: accel.name,
    generation: accel.generation,
    vramGb: accel.vramGb,
    bandwidthTBs: accel.bandwidthTBs,
    usdPerGpuHour: accel.usdPerHour,
    tp,
    pp,
    dp,
    gpus,
    nodes,
    perGpuGb,
    usableGb,
    headroom,
    fit,
    breakdown: { weightsGb, optimizerGb, activationsGb, kvGb, taxGb },
    residentGb,
    gradAccum,
    sequencesPerReplica,
    usdPerHour,
    usdTotal: usdPerHour * workload.hours,
    tokPerSec,
    stepStretch,
    warnings,
    score,
    overGb,
  };
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score < b.score;
  if (a.gpus !== b.gpus) return a.gpus < b.gpus;
  return a.tp < b.tp;
}

export function planWorkload(raw: Workload, rawPerturb: Perturb, onlyId: string | null): Plan {
  const { workload, perturb } = sanitize(raw, rawPerturb);
  const accels = ACCELERATORS;
  const tps = [1, 2, 4, 8];
  const pps = [1, 2, 4, 8];
  const dps = [1, 2, 4, 8, 16, 32];

  let best: Candidate | null = null;
  let tried = 0;
  const bestByAccel = new Map<string, Candidate>();

  for (const accel of accels) {
    for (const tp of tps) {
      for (const pp of pps) {
        for (const dp of dps) {
          const gpus = tp * pp * dp;
          if (gpus > 512) continue;
          tried += 1;
          const candidate = evaluate(workload, perturb, accel, tp, pp, dp, onlyId === accel.id);
          const prev = bestByAccel.get(accel.id);
          if (!prev || better(candidate, prev)) bestByAccel.set(accel.id, candidate);
          if (!best || better(candidate, best)) best = candidate;
        }
      }
    }
  }

  const pinnedBest = onlyId ? bestByAccel.get(onlyId) : null;
  const winner = pinnedBest ?? best;
  if (!winner) {
    throw new Error("Planner produced no placement");
  }

  const alts = ACCELERATORS.map((accel) => bestByAccel.get(accel.id)).filter((item): item is Candidate => !!item);
  alts.sort((a, b) => a.score - b.score);

  const { score: _score, overGb: _over, ...placement } = winner;
  const trace = buildTrace(workload, perturb, placement, alts, tried, onlyId);

  return {
    placement,
    alts: alts.map(({ score: _s, overGb: _o, ...rest }) => rest),
    trace,
  };
}

function gb(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function money(n: number): string {
  if (n >= 100) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}

function buildTrace(
  workload: Workload,
  perturb: Perturb,
  placement: Placement,
  alts: Placement[],
  tried: number,
  onlyId: string | null,
): TraceStep[] {
  const bpp = weightBytes(workload.precision);
  const lora =
    workload.mode === "tune" && workload.loraRank > 0
      ? (2 * workload.loraRank * workload.hidden * 7 * workload.layers) / 1e9
      : 0;
  const modeLine =
    workload.mode === "serve"
      ? `Serving ${workload.paramsB}B in ${workload.precision.toUpperCase()}. Weights are ${gb(placement.residentGb)} GB and stay resident. No optimizer.`
      : workload.mode === "tune" && workload.loraRank > 0
        ? `LoRA rank ${workload.loraRank} trains about ${lora.toFixed(3)}B parameters. The ${gb(placement.residentGb)} GB base still sits in HBM. Optimizer is ${workload.optimizer === "adamw" ? "AdamW" : "8-bit Adam"} on the adapters only.`
        : `Full ${workload.mode === "train" ? "train" : "tune"} of ${workload.paramsB}B at ${bpp} bytes/param. ${workload.optimizer === "adamw" ? "AdamW" : "8-bit Adam"} state dominates the footprint.`;

  const working =
    workload.mode === "serve"
      ? `KV for ${placement.sequencesPerReplica} sequence(s) on each replica, context ${workload.seq.toLocaleString("en-US")}. Counted in the weight precision.`
      : `Activations use micro-batch ${workload.microBatch}, sequence ${workload.seq.toLocaleString("en-US")}, selective checkpoint. Global batch ${workload.batch} becomes grad accumulation ${placement.gradAccum}.`;

  const altLine = alts
    .map((alt) => {
      const mark = alt.acceleratorId === placement.acceleratorId ? " ← pick" : "";
      return `${alt.acceleratorName} ×${alt.gpus} ${alt.fit} ${money(alt.usdPerHour)}/hr${mark}`;
    })
    .join(". ");

  const why =
    placement.fit === "overflow"
      ? "Every legal topology still spills. This is the least-bad spill, not a recommendation to launch."
      : onlyId
        ? `Pinned to ${placement.acceleratorName}. The desk did not shop the other SKUs.`
        : `Cheapest placement that stays under 90% HBM. Comfier SKUs lose if they cost more — they stay in the alt row.`;

  const stressBits: string[] = [];
  if (perturb.hbmTax > 0) stressBits.push(`${Math.round(perturb.hbmTax * 100)}% HBM tax on the working set`);
  if (perturb.linkFlap) stressBits.push(placement.tp === 1 ? "link flap, and TP is already 1" : "link flap taxing TP");
  if (perturb.straggler) stressBits.push("a straggler on the critical path");
  if (perturb.preempt) stressBits.push("preemptible capacity");
  const stress =
    stressBits.length === 0
      ? "Quiet rack. No tax, no flap, no straggler, no preemption."
      : `Applied ${stressBits.join(", ")}.`;

  const price =
    workload.mode === "serve" && placement.tokPerSec != null
      ? `${money(placement.usdPerHour)}/hr · ${money(placement.usdTotal)} for ${workload.hours}h. Decode sketch ${Math.round(placement.tokPerSec).toLocaleString("en-US")} tok/s across the cluster. HBM bandwidth, not a benchmark.`
      : `${money(placement.usdPerHour)}/hr · ${money(placement.usdTotal)} for ${workload.hours}h. Step stretch ×${placement.stepStretch.toFixed(2)} against a quiet single stage.`;

  return [
    { id: "weigh", title: "Weigh", detail: modeLine },
    { id: "working", title: "Working set", detail: working },
    {
      id: "search",
      title: "Search",
      detail: `${tried.toLocaleString("en-US")} topologies. ${altLine}.`,
    },
    {
      id: "pick",
      title: "Place",
      detail: `${placement.acceleratorName} ×${placement.gpus} · TP${placement.tp} PP${placement.pp} DP${placement.dp} · ${gb(placement.perGpuGb)} / ${placement.vramGb} GB · ${placement.fit}. ${why}`,
    },
    { id: "stress", title: "Stress", detail: stress },
    { id: "price", title: "Price", detail: price },
  ];
}

export function describePlan(plan: Plan, workload: Workload, perturb: Perturb, faults: number): string {
  const p = plan.placement;
  return [
    `Workload ${workload.name}, mode ${workload.mode}, ${workload.paramsB}B params, precision ${workload.precision}, seq ${workload.seq}, batch ${workload.batch}, micro-batch ${workload.microBatch}, window ${workload.hours}h.`,
    `Shape L${workload.layers} hidden ${workload.hidden} heads ${workload.heads} kv-heads ${workload.kvHeads} head-dim ${workload.headDim}.`,
    workload.mode === "tune"
      ? `LoRA rank ${workload.loraRank}. Optimizer ${workload.optimizer}.`
      : `Optimizer ${workload.mode === "serve" ? "none" : workload.optimizer}.`,
    `Placement ${p.acceleratorName} x${p.gpus} (${p.nodes} node of 8), TP ${p.tp} PP ${p.pp} DP ${p.dp}.`,
    `Per GPU ${p.perGpuGb.toFixed(1)} GB of ${p.vramGb} GB, usable cap ${p.usableGb.toFixed(1)} GB, headroom ${(p.headroom * 100).toFixed(0)}%, fit ${p.fit}.`,
    `Breakdown GB/GPU: weights ${p.breakdown.weightsGb.toFixed(2)}, optimizer ${p.breakdown.optimizerGb.toFixed(2)}, activations ${p.breakdown.activationsGb.toFixed(2)}, kv ${p.breakdown.kvGb.toFixed(2)}, tax ${p.breakdown.taxGb.toFixed(2)}.`,
    `Cost $${p.usdPerHour.toFixed(2)}/hr, $${p.usdTotal.toFixed(2)} for the window, listed at $${p.usdPerGpuHour.toFixed(2)} per GPU-hour.`,
    p.tokPerSec != null
      ? `Decode sketch ${p.tokPerSec.toFixed(0)} tok/s cluster, ${p.sequencesPerReplica} sequences per replica.`
      : `Step stretch x${p.stepStretch.toFixed(2)}, grad accumulation ${p.gradAccum}.`,
    `Perturbations: HBM tax ${(perturb.hbmTax * 100).toFixed(0)}%, link flap ${perturb.linkFlap}, straggler ${perturb.straggler}, preempt ${perturb.preempt}.`,
    `Operator marked ${faults} of ${p.gpus} accelerators down.`,
    ...plan.alts.map(
      (alt) =>
        `Alt ${alt.acceleratorName}: ${alt.gpus} GPU, ${alt.fit}, $${alt.usdPerHour.toFixed(2)}/hr, headroom ${(alt.headroom * 100).toFixed(0)}%, TP${alt.tp} PP${alt.pp} DP${alt.dp}.`,
    ),
    `Warnings: ${p.warnings.join(" | ") || "none"}.`,
    "Heuristic memory model, not a profiler. Prices are public listings, not a vendor quote. Do not invent benchmark numbers.",
  ].join("\n");
}

export function planSignature(plan: Plan, perturb: Perturb, faults: number): string {
  const p = plan.placement;
  return [
    p.acceleratorId,
    p.tp,
    p.pp,
    p.dp,
    p.perGpuGb.toFixed(1),
    p.fit,
    perturb.hbmTax.toFixed(2),
    perturb.linkFlap,
    perturb.straggler,
    perturb.preempt,
    faults,
  ].join("|");
}
