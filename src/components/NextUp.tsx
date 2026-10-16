import { formatDuration, formatShortDate } from "../lib/format";
import { groupIcon } from "../lib/groups";
import { trackLabeler } from "../lib/labels";
import type { Step } from "../lib/plan";
import type { Schedule } from "../lib/scheduler";

export function NextUp({ schedule, now }: { schedule: Schedule; now: number }) {
  const label = trackLabeler(schedule.plan.tracks);
  const steps = schedule.order.filter((s) => s.duration > 0);
  if (!steps.length) return null;

  const running = steps.filter((s) => s.inProgress).sort((a, b) => a.end! - b.end!);
  const startNow = steps.filter((s) => !s.inProgress && s.start === 0);
  const upcoming = steps.filter((s) => s.start! > 0).slice(0, 8);

  const row = (s: Step, when: string) => (
    <li key={s.idx}>
      <span className="step-icon">{groupIcon(s.track.group)}</span>
      <span className="step-name">
        {label(s.track)}
        <span className="lvl-pill">Lv {s.level}</span>
      </span>
      <span className="step-when">{when}</span>
    </li>
  );

  return (
    <section className="nextup">
      {startNow.length > 0 && (
        <div className="card nu-card nu-now">
          <h3>
            <span className="pulse" /> Start now
            <span className="muted count">{startNow.length} free builder{startNow.length === 1 ? "" : "s"}</span>
          </h3>
          <ul className="steps">{startNow.map((s) => row(s, formatDuration(s.duration)))}</ul>
        </div>
      )}
      {running.length > 0 && (
        <div className="card nu-card">
          <h3>
            ⏳ In progress <span className="muted count">{running.length}</span>
          </h3>
          <ul className="steps">{running.map((s) => row(s, `done in ${formatDuration(s.duration)}`))}</ul>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="card nu-card nu-upcoming">
          <h3>📋 Then, in this order</h3>
          <ul className="steps">
            {upcoming.map((s) => row(s, `${formatShortDate(now, s.start!)} · ${formatDuration(s.duration)}`))}
          </ul>
        </div>
      )}
    </section>
  );
}
