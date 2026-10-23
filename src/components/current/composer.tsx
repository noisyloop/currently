import { ACCELERATORS, PRESETS, type Perturb, type Workload, shapeForParams } from "@/lib/cluster/engine";

export type Sketch = {
  id: string;
  name: string;
  at: number;
  workload: Workload;
  perturb: Perturb;
  only: string | null;
};

type ComposerProps = {
  workload: Workload;
  perturb: Perturb;
  only: string | null;
  sketches: Sketch[];
  kept: boolean;
  onWorkload: (next: Workload) => void;
  onPerturb: (next: Perturb) => void;
  onOnly: (id: string | null) => void;
  onKeep: () => void;
  onRestore: (sketch: Sketch) => void;
  onDrop: (id: string) => void;
};

export function Composer({
  workload,
  perturb,
  only,
  sketches,
  kept,
  onWorkload,
  onPerturb,
  onOnly,
  onKeep,
  onRestore,
  onDrop,
}: ComposerProps) {
  const edit = (partial: Partial<Workload>, rescale = false) => {
    const next: Workload = { ...workload, ...partial, id: "custom", name: workload.name === "" ? "Custom" : "Custom" };
    onWorkload(rescale && partial.paramsB != null ? { ...next, ...shapeForParams(partial.paramsB) } : next);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl tracking-wide text-bone">WORKLOAD</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const on = workload.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={on}
                onClick={() => onWorkload({ ...preset })}
                className={
                  on
                    ? "h-11 bg-aqua px-3 text-sm text-ink"
                    : "h-11 border border-rule px-3 text-sm text-bone hover:border-aqua"
                }
              >
                {preset.name}
              </button>
            );
          })}
        </div>
        <Seg
          label="Mode"
          value={workload.mode}
          options={[
            { id: "train", label: "Train" },
            { id: "tune", label: "Tune" },
            { id: "serve", label: "Serve" },
          ]}
          onChange={(mode) => {
            if (mode === "serve") edit({ mode, loraRank: 0 });
            else if (mode === "tune") edit({ mode, loraRank: workload.loraRank || 16 });
            else edit({ mode, loraRank: 0, optimizer: "adamw" });
          }}
        />
        <Seg
          label="Precision"
          value={workload.precision}
          options={[
            { id: "bf16", label: "BF16" },
            { id: "fp8", label: "FP8" },
            { id: "fp4", label: "FP4" },
          ]}
          onChange={(precision) => edit({ precision })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Num label="Params" suffix="B" value={workload.paramsB} min={0.1} max={4000} integer={false} onChange={(paramsB) => edit({ paramsB }, true)} />
          <Num label="Context" suffix="tok" value={workload.seq} min={128} max={262144} integer onChange={(seq) => edit({ seq })} />
          <Num
            label={workload.mode === "serve" ? "Sequences" : "Global batch"}
            value={workload.batch}
            min={1}
            max={8192}
            integer
            onChange={(batch) => edit({ batch })}
          />
          <Num label="Hours" value={workload.hours} min={0.5} max={720} integer={false} onChange={(hours) => edit({ hours })} />
          {workload.mode !== "serve" ? (
            <Num label="Micro-batch" value={workload.microBatch} min={1} max={64} integer onChange={(microBatch) => edit({ microBatch })} />
          ) : null}
        </div>
        {workload.mode === "tune" ? (
          <Seg
            label="LoRA rank"
            value={String(workload.loraRank)}
            options={[
              { id: "0", label: "Full" },
              { id: "8", label: "8" },
              { id: "16", label: "16" },
              { id: "64", label: "64" },
            ]}
            onChange={(rank) => edit({ loraRank: Number(rank) })}
          />
        ) : null}
        {workload.mode !== "serve" ? (
          <Seg
            label="Optimizer"
            value={workload.optimizer}
            options={[
              { id: "adamw", label: "AdamW" },
              { id: "adamw8bit", label: "8-bit" },
            ]}
            onChange={(optimizer) => edit({ optimizer })}
          />
        ) : null}
        <details className="border border-rule">
          <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-sm text-mute">
            Shape · L{workload.layers} · H{workload.hidden}
          </summary>
          <div className="grid grid-cols-2 gap-3 border-t border-rule p-3">
            <Num label="Layers" value={workload.layers} min={1} max={400} integer onChange={(layers) => edit({ layers })} />
            <Num label="Hidden" value={workload.hidden} min={128} max={32768} integer onChange={(hidden) => edit({ hidden })} />
            <Num label="Heads" value={workload.heads} min={1} max={256} integer onChange={(heads) => edit({ heads: Math.max(heads, workload.kvHeads) })} />
            <Num label="KV heads" value={workload.kvHeads} min={1} max={workload.heads} integer onChange={(kvHeads) => edit({ kvHeads })} />
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl tracking-wide text-bone">STRESS</h2>
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs tracking-wide text-mute uppercase">
            HBM tax
            <span className="font-display text-2xl tracking-normal text-bone tabular-nums">{Math.round(perturb.hbmTax * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            aria-valuetext={`${Math.round(perturb.hbmTax * 100)} percent extra memory`}
            value={Math.round(perturb.hbmTax * 100)}
            suppressHydrationWarning
            onChange={(event) => onPerturb({ ...perturb, hbmTax: Number(event.target.value) / 100 })}
          />
        </label>
        <div className="grid grid-cols-1 gap-2">
          <Toggle on={perturb.linkFlap} label="Link flap" detail="Infinity Fabric misbehaves. Wide TP gets expensive." onClick={() => onPerturb({ ...perturb, linkFlap: !perturb.linkFlap })} />
          <Toggle on={perturb.straggler} label="Straggler" detail="One rank is slow. The group waits." onClick={() => onPerturb({ ...perturb, straggler: !perturb.straggler })} />
          <Toggle on={perturb.preempt} label="Preempt" detail="The node can vanish. Checkpoint or don't." onClick={() => onPerturb({ ...perturb, preempt: !perturb.preempt })} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl tracking-wide text-bone">SKU</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={only === null}
            onClick={() => onOnly(null)}
            className={only === null ? "h-11 bg-aqua text-sm text-ink" : "h-11 border border-rule text-sm text-bone"}
          >
            Any
          </button>
          {ACCELERATORS.map((accel) => (
            <button
              key={accel.id}
              type="button"
              aria-pressed={only === accel.id}
              onClick={() => onOnly(only === accel.id ? null : accel.id)}
              className={only === accel.id ? "h-11 bg-aqua text-sm text-ink" : "h-11 border border-rule text-sm text-bone"}
            >
              {accel.name.replace("Instinct ", "")}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide text-bone">BENCH</h2>
          <button type="button" onClick={onKeep} className="h-11 border border-rule px-3 text-sm text-bone hover:border-aqua">
            {kept ? "Kept" : "Keep placement"}
          </button>
        </div>
        {sketches.length === 0 ? (
          <p className="text-sm text-mute">Nothing kept yet. Placements stay in this browser.</p>
        ) : (
          <ul className="flex flex-col">
            {sketches.map((sketch) => (
              <li key={sketch.id} className="flex items-center gap-2 border-t border-rule py-2">
                <button type="button" onClick={() => onRestore(sketch)} className="min-h-11 flex-1 text-left">
                  <span className="block text-sm text-bone">{sketch.name}</span>
                  <span className="block text-xs text-mute">
                    {sketch.workload.mode} · {sketch.workload.paramsB}B · {new Date(sketch.at).toLocaleString()}
                  </span>
                </button>
                <button type="button" onClick={() => onDrop(sketch.id)} className="h-11 px-3 text-sm text-mute hover:text-bone">
                  Drop
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-mute">
        Unofficial study of Instinct-class racks. Not TensorWave, not AMD, and not a quote. Their 2027 early-careers window runs through Nov 1 — this desk does not apply for you.
      </p>
    </div>
  );
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs tracking-wide text-mute uppercase">{label}</span>
      <div className="flex border border-rule">
        {options.map((option) => {
          const on = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.id)}
              className={on ? "h-11 flex-1 bg-aqua text-sm text-ink" : "h-11 flex-1 text-sm text-mute hover:text-bone"}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  min,
  max,
  integer,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  integer: boolean;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs tracking-wide text-mute uppercase">{label}</span>
      <span className="flex items-center border border-rule bg-raised focus-within:border-aqua">
        <input
          className="h-11 w-full bg-transparent px-3 font-display text-2xl text-bone tabular-nums outline-none"
          inputMode="decimal"
          defaultValue={String(value)}
          key={value}
          suppressHydrationWarning
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) {
              event.target.value = String(value);
              return;
            }
            const clamped = Math.min(max, Math.max(min, next));
            const rounded = integer ? Math.round(clamped) : Math.round(clamped * 100) / 100;
            event.target.value = String(rounded);
            if (rounded !== value) onChange(rounded);
          }}
        />
        {suffix ? <span className="pr-3 text-xs text-mute">{suffix}</span> : null}
      </span>
    </label>
  );
}

function Toggle({ on, label, detail, onClick }: { on: boolean; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={on ? "flex min-h-11 flex-col items-start border border-aqua bg-aqua/10 px-3 py-2 text-left" : "flex min-h-11 flex-col items-start border border-rule px-3 py-2 text-left"}
    >
      <span className={on ? "text-sm text-aqua" : "text-sm text-bone"}>{label}</span>
      <span className="text-xs text-mute">{detail}</span>
    </button>
  );
}
