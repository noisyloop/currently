import type { Fit } from "@/lib/cluster/engine";

type WavefieldProps = {
  gpus: number;
  tp: number;
  faults: number[];
  pressure: number;
  fit: Fit;
  onToggle: (index: number) => void;
};

const DRAW_CAP = 48;
const WAVE =
  "M0 28 C 8 12, 16 12, 24 28 S 40 44, 48 28 S 64 12, 72 28 S 88 44, 96 28 S 112 12, 120 28 S 136 44, 144 28";

export function Wavefield({ gpus, tp, faults, pressure, fit, onToggle }: WavefieldProps) {
  const shown = Math.min(gpus, DRAW_CAP);
  const hidden = gpus - shown;
  const down = new Set(faults);
  const accent = fit === "overflow" ? "bg-amber/30" : "bg-aqua/25";
  const nodes: number[][] = [];
  for (let index = 0; index < shown; index += 8) {
    nodes.push(Array.from({ length: Math.min(8, shown - index) }, (_, offset) => index + offset));
  }
  const period = Math.max(1, tp);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {nodes.map((group, node) => (
        <div key={group[0]}>
          <div className="mb-1 font-display text-sm tracking-wide text-mute">NODE {String(node + 1).padStart(2, "0")}</div>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
            {group.map((index) => {
              const failed = down.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={failed}
                  aria-label={`Accelerator ${index}${failed ? ", down" : ""}`}
                  onClick={() => onToggle(index)}
                  className={
                    failed
                      ? "relative flex h-16 min-w-0 items-center justify-center overflow-hidden border border-amber bg-ink"
                      : "rack-cell relative flex h-16 min-w-0 items-center justify-center overflow-hidden border border-rule bg-ink"
                  }
                  style={failed ? undefined : { animationDelay: `${((index % period) * 2.4) / period}s` }}
                >
                  {failed ? (
                    <span className="font-display text-2xl text-amber">×</span>
                  ) : (
                    <>
                      <span className={`absolute inset-x-0 bottom-0 ${accent}`} style={{ height: `${Math.round(pressure * 100)}%` }} />
                      <svg viewBox="0 0 144 48" className="wave-drift absolute inset-y-0 left-0 h-full w-[140%] text-aqua" aria-hidden="true">
                        <path d={WAVE} fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </>
                  )}
                  <span className="absolute top-1 left-1.5 font-display text-sm text-bone tabular-nums">
                    {String(index).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {hidden > 0 ? <p className="text-xs text-mute">+{hidden} not drawn — same pressure, same topology.</p> : null}
    </div>
  );
}
