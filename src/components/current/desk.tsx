import { useEffect, useMemo, useState } from "react";
import { briefPlan, type AgentBrief } from "@/lib/cluster/brief";
import {
  EMPTY_PERTURB,
  PRESETS,
  describePlan,
  planSignature,
  planWorkload,
  type Perturb,
  type Workload,
} from "@/lib/cluster/engine";
import { Composer, type Sketch } from "./composer";
import { money } from "./format";
import { Readout } from "./readout";
import { Wavefield } from "./wavefield";

const STORAGE = "current.sketches.v1";

export function Desk() {
  const [workload, setWorkload] = useState<Workload>(PRESETS[0]);
  const [perturb, setPerturb] = useState<Perturb>(EMPTY_PERTURB);
  const [only, setOnly] = useState<string | null>(null);
  const [faults, setFaults] = useState<number[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [kept, setKept] = useState(false);
  const [brief, setBrief] = useState<AgentBrief | null>(null);
  const [briefKey, setBriefKey] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const plan = useMemo(() => planWorkload(workload, perturb, only), [workload, perturb, only]);
  const topo = `${plan.placement.acceleratorId}:${plan.placement.gpus}:${plan.placement.tp}:${plan.placement.pp}:${plan.placement.dp}`;
  const [faultTopo, setFaultTopo] = useState(topo);
  if (faultTopo !== topo) {
    setFaultTopo(topo);
    setFaults([]);
  }

  const liveFaults = faultTopo === topo ? faults.filter((index) => index < plan.placement.gpus) : [];
  const signature = planSignature(plan, perturb, liveFaults.length);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Sketch[];
      if (Array.isArray(parsed)) setSketches(parsed.slice(0, 8));
    } catch {
      /* ignore broken local notes */
    }
  }, []);

  function persist(next: Sketch[]) {
    setSketches(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  }

  function keep() {
    const sketch: Sketch = {
      id: crypto.randomUUID(),
      name: workload.id === "custom" ? `Custom ${workload.paramsB}B` : workload.name,
      at: Date.now(),
      workload,
      perturb,
      only,
    };
    persist([sketch, ...sketches].slice(0, 8));
    setKept(true);
    window.setTimeout(() => setKept(false), 1200);
  }

  function toggleFault(index: number) {
    setFaults((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]));
  }

  function addFault() {
    setFaults((current) => {
      const cap = Math.min(plan.placement.gpus, 48);
      for (let index = 0; index < cap; index++) {
        if (!current.includes(index)) return [...current, index];
      }
      return current;
    });
  }

  async function runBrief() {
    if (briefing) return;
    setBriefing(true);
    setBriefError(null);
    try {
      const result = await briefPlan({
        data: { summary: describePlan(plan, workload, perturb, liveFaults.length) },
      });
      if (!result.ok) {
        setBriefError(result.error);
        return;
      }
      setBrief(result.brief);
      setBriefKey(signature);
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : "The brief failed.");
    } finally {
      setBriefing(false);
    }
  }

  const place = plan.placement;
  const pressure = Math.min(1, place.perGpuGb / place.vramGb);

  return (
    <main className="min-h-screen bg-ink text-bone">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-rule px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Mark />
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-none tracking-wide text-bone">CURRENT</h1>
            <p className="truncate text-xs text-mute">Instinct-class rack desk</p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl leading-none text-aqua tabular-nums">{money(place.usdPerHour)}/hr</div>
          <div className="text-xs text-mute tabular-nums">
            {place.gpus} GPU · {place.fit}
          </div>
        </div>
      </header>

      <div className="desk-frame flex flex-col">
        <section className="order-2 min-w-0 border-b border-rule lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Composer
            workload={workload}
            perturb={perturb}
            only={only}
            sketches={sketches}
            kept={kept}
            onWorkload={setWorkload}
            onPerturb={setPerturb}
            onOnly={setOnly}
            onKeep={keep}
            onRestore={(sketch) => {
              setWorkload(sketch.workload);
              setPerturb(sketch.perturb);
              setOnly(sketch.only);
            }}
            onDrop={(id) => persist(sketches.filter((sketch) => sketch.id !== id))}
          />
        </section>

        <section className="rack-stage order-1 flex min-w-0 flex-col bg-panel lg:order-2 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex items-end justify-between gap-3 px-4 pt-4">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-mute uppercase">Rack</p>
              <p className="truncate font-display text-3xl leading-none text-bone">{place.acceleratorName}</p>
            </div>
            <p className="font-display text-3xl leading-none text-aqua tabular-nums">{place.gpus}</p>
          </div>
          <p className="px-4 pt-2 text-sm text-mute">
            TP{place.tp} · PP{place.pp} · DP{place.dp} · {Math.round(pressure * 100)}% of HBM
            {place.gpus > 48 ? " · first 48 drawn" : ""}
          </p>
          <Wavefield
            gpus={place.gpus}
            tp={place.tp}
            faults={liveFaults}
            pressure={pressure}
            fit={place.fit}
            onToggle={toggleFault}
          />
          <div className="mt-auto flex flex-wrap items-center gap-2 px-4 pt-2 pb-4">
            <button type="button" onClick={addFault} className="h-11 border border-rule px-3 text-sm text-bone hover:border-aqua">
              Fault one
            </button>
            <button
              type="button"
              onClick={() => setFaults([])}
              disabled={liveFaults.length === 0}
              className="h-11 border border-rule px-3 text-sm text-bone hover:border-aqua disabled:opacity-40"
            >
              Clear faults
            </button>
            <span className="text-sm text-mute tabular-nums">{liveFaults.length} down</span>
          </div>
        </section>

        <section className="order-3 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-rule">
          <Readout
            plan={plan}
            workload={workload}
            faults={liveFaults.length}
            brief={brief}
            briefError={briefError}
            briefFresh={briefKey === signature && brief !== null}
            briefing={briefing}
            onBrief={() => void runBrief()}
            onOnly={setOnly}
            only={only}
          />
        </section>
      </div>
    </main>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0 text-aqua" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c3-7 5-7 8 0s5 7 8 0 5-7 8 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
