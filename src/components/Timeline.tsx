import { useMemo } from "react";
import { formatDate, formatDuration, formatShortDate } from "../lib/format";
import { groupColor, groupIcon, groupLabel, groupOrder } from "../lib/groups";
import { trackLabeler } from "../lib/labels";
import type { Track } from "../lib/plan";
import type { Schedule } from "../lib/scheduler";

interface Block {
  track: Track;
  start: number;
  end: number;
  fromLevel: number;
  toLevel: number;
}

const DAY = 86400;

export function Timeline({ schedule, now }: { schedule: Schedule; now: number }) {
  const label = useMemo(() => trackLabeler(schedule.plan.tracks), [schedule]);
  const lanes = useMemo(() => {
    const steps = schedule.order.filter((s) => s.duration > 0);
    const bySlot = new Map<number, Block[]>();
    for (const s of steps) {
      const list = bySlot.get(s.slot!) ?? [];
      const last = list[list.length - 1];
      // Consecutive levels of the same item become one block.
      if (last && last.track === s.track && last.end === s.start) {
        last.end = s.end!;
        last.toLevel = s.level;
      } else {
        list.push({ track: s.track, start: s.start!, end: s.end!, fromLevel: s.level, toLevel: s.level });
      }
      bySlot.set(s.slot!, list);
    }
    return [...bySlot.keys()]
      .sort((a, b) => a - b)
      .map((slot, i) => ({ name: `Builder ${i + 1}`, blocks: bySlot.get(slot)! }));
  }, [schedule]);

  const groups = [...new Set(lanes.flatMap((l) => l.blocks.map((b) => b.track.group)))].sort(
    (a, b) => groupOrder(a) - groupOrder(b),
  );
  const total = Math.max(DAY, schedule.finish);
  const tickEvery = total > 200 * DAY ? 60 : total > 90 * DAY ? 30 : total > 30 * DAY ? 7 : 1;
  const ticks: number[] = [];
  for (let d = tickEvery; d * DAY < total; d += tickEvery) ticks.push(d * DAY);

  return (
    <section className="card">
      <div className="tl-head">
        <h2>Builder timeline</h2>
        <div className="legend">
          {groups.map((g) => (
            <span key={g}>
              <i style={{ background: groupColor(g) }} />
              {groupIcon(g)} {groupLabel(g)}
            </span>
          ))}
        </div>
      </div>
      <p className="hint">One row per builder, following the plan. Hover a block for details.</p>
      <div className="timeline">
        <div className="tl-axis">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${(t / total) * 100}%` }}>
              {formatShortDate(now, t)}
            </span>
          ))}
        </div>
        {lanes.map((lane) => (
          <div className="tl-lane" key={lane.name}>
            <div className="tl-name">{lane.name}</div>
            <div className="tl-track">
              {ticks.map((t) => (
                <i key={t} className="tl-grid" style={{ left: `${(t / total) * 100}%` }} />
              ))}
              {lane.blocks.map((b, i) => (
                <div
                  key={i}
                  className="tl-block"
                  style={{
                    left: `${(b.start / total) * 100}%`,
                    width: `${((b.end - b.start) / total) * 100}%`,
                    background: groupColor(b.track.group, b.track.name),
                  }}
                  title={`${label(b.track)}: level ${b.fromLevel - 1} → ${b.toLevel}\n${formatDate(now, b.start)} – ${formatDate(now, b.end)} (${formatDuration(b.end - b.start)})`}
                >
                  <span>{label(b.track)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

