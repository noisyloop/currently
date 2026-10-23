import { TriangleAlert } from "lucide-react";
import { ASSUMPTIONS, type Plan, type Workload } from "@/lib/cluster/engine";
import type { AgentBrief } from "@/lib/cluster/brief";
import { compact, gb, money } from "./format";

type ReadoutProps = {
  plan: Plan;
  workload: Workload;
  faults: number;
  brief: AgentBrief | null;
  briefError: string | null;
  briefFresh: boolean;
  briefing: boolean;
  onBrief: () => void;
  onOnly: (id: string | null) => void;
  only: string | null;
};

export function Readout({
  plan,
  workload,
  faults,
  brief,
  briefError,
  briefFresh,
  briefing,
  onBrief,
  onOnly,
  only,
}: ReadoutProps) {
  const place = plan.placement;
  const parts = [
    { label: "Weights", value: place.breakdown.weightsGb, tone: "bg-aqua" },
    { label: "Optimizer", value: place.breakdown.optimizerGb, tone: "bg-bone" },
    { label: "Activations", value: place.breakdown.activationsGb, tone: "bg-mute" },
    { label: "KV", value: place.breakdown.kvGb, tone: "bg-amber" },
    { label: "Tax", value: place.breakdown.taxGb, tone: "bg-bone/40" },
  ].filter((part) => part.value > 0.05);
  const filled = Math.min(100, (place.perGpuGb / place.vramGb) * 100);
  const fitTone = place.fit === "comfortable" ? "text-aqua" : "text-amber";

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs tracking-wide text-mute uppercase">Placement</h2>
        <p className={`font-display text-5xl leading-none tracking-wide ${fitTone}`}>{place.fit}</p>
        <p className="font-display text-3xl leading-none text-bone">{place.acceleratorName}</p>
        <p className="text-sm text-mute">
          {place.generation} · TP{place.tp} PP{place.pp} DP{place.dp} · {place.nodes} {place.nodes === 1 ? "node" : "nodes"}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-px bg-rule">
        <Stat label="Per GPU" value={`${gb(place.perGpuGb)} GB`} detail={`of ${place.vramGb}`} />
        <Stat label="Window" value={money(place.usdPerHour)} detail={`${money(place.usdTotal)} / ${workload.hours}h`} />
        <Stat
          label={workload.mode === "serve" ? "Decode sketch" : "Step stretch"}
          value={workload.mode === "serve" ? compact(place.tokPerSec ?? 0) : `×${place.stepStretch.toFixed(2)}`}
          detail={workload.mode === "serve" ? "tok/s, HBM only" : `accum ${place.gradAccum}`}
        />
        <Stat label="Healthy need" value={String(place.gpus)} detail={faults > 0 ? `short ${faults}` : "none marked down"} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="h-3 bg-raised">
          <div className={`h-full ${place.fit === "overflow" ? "bg-amber" : "bg-aqua"}`} style={{ width: `${filled}%` }} />
        </div>
        <div className="flex h-3 w-full overflow-hidden bg-raised">
          {parts.map((part) => (
            <div
              key={part.label}
              className={part.tone}
              style={{ width: `${(part.value / Math.max(place.perGpuGb, 0.001)) * 100}%` }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {parts.map((part) => (
            <li key={part.label} className="flex items-center gap-2 text-xs text-mute">
              <span className={`inline-block size-2 ${part.tone}`} />
              {part.label} {gb(part.value)}
            </li>
          ))}
        </ul>
      </section>

      {faults > 0 ? (
        <p className="border border-amber px-3 py-3 text-sm text-amber">
          {faults} accelerator{faults === 1 ? "" : "s"} marked down. This placement still needs {place.gpus} healthy. You are short.
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-wide">OTHER SKUS</h2>
        <div className="flex flex-col">
          {plan.alts.map((alt) => {
            const selected = alt.acceleratorId === place.acceleratorId;
            return (
              <button
                key={alt.acceleratorId}
                type="button"
                aria-pressed={only === alt.acceleratorId}
                onClick={() => onOnly(only === alt.acceleratorId ? null : alt.acceleratorId)}
                className={
                  selected
                    ? "flex min-h-11 items-center justify-between gap-3 border-t border-aqua py-2 text-left"
                    : "flex min-h-11 items-center justify-between gap-3 border-t border-rule py-2 text-left"
                }
              >
                <span>
                  <span className="block text-sm text-bone">{alt.acceleratorName.replace("Instinct ", "")}</span>
                  <span className="block text-xs text-mute">
                    TP{alt.tp} PP{alt.pp} DP{alt.dp} · {alt.fit}
                    {only === alt.acceleratorId ? " · pinned" : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-2xl leading-none text-bone tabular-nums">×{alt.gpus}</span>
                  <span className="block text-xs text-mute tabular-nums">{money(alt.usdPerHour)}/hr</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-mute">Tap a SKU to pin it. Tap again to let the desk choose. Prices are public listings, not a quote.</p>
      </section>

      {place.warnings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {place.warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-sm text-amber">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="flex flex-col">
        <h2 className="font-display text-2xl tracking-wide">TRACE</h2>
        <ol>
          {plan.trace.map((step, index) => (
            <li key={step.id} className="border-t border-rule py-3">
              <h3 className="font-display text-xl tracking-wide text-aqua">
                {String(index + 1).padStart(2, "0")} {step.title}
              </h3>
              <p className="text-sm text-mute">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 border border-rule p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">AGENT</h2>
          <button
            type="button"
            onClick={onBrief}
            disabled={briefing || briefFresh}
            className="h-11 bg-aqua px-4 text-sm text-ink disabled:opacity-40"
          >
            {briefing ? "Reading the rack…" : briefFresh ? "Brief is current" : "Brief the agent"}
          </button>
        </div>
        <p className="text-sm text-mute">
          The trace above is the planner, and it does not call out. Grok speaks once, when you ask, about this placement only.
        </p>
        {briefError ? <p className="text-sm text-amber">{briefError}</p> : null}
        {brief ? (
          <div className={briefFresh ? "flex flex-col gap-3" : "flex flex-col gap-3 opacity-60"}>
            {!briefFresh ? <p className="text-xs tracking-wide text-amber uppercase">Stale — the rack moved</p> : null}
            <p className="font-display text-3xl leading-none text-bone">{brief.headline}</p>
            {brief.risks.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {brief.risks.map((risk) => (
                  <li key={risk} className="text-sm text-bone">
                    {risk}
                  </li>
                ))}
              </ul>
            ) : null}
            {brief.move ? <p className="text-sm text-aqua">{brief.move}</p> : null}
            <p className="text-sm text-mute">{brief.note}</p>
          </div>
        ) : null}
      </section>

      <details className="border border-rule">
        <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-sm text-mute">What the math assumes</summary>
        <ul className="flex flex-col gap-2 border-t border-rule p-3">
          {ASSUMPTIONS.map((line) => (
            <li key={line} className="text-xs text-mute">
              {line}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-ink px-3 py-3">
      <div className="text-xs tracking-wide text-mute uppercase">{label}</div>
      <div className="font-display text-3xl leading-none text-bone tabular-nums">{value}</div>
      <div className="text-xs text-mute tabular-nums">{detail}</div>
    </div>
  );
}
