import { useMemo, useState } from "react";
import { formatDuration, formatShortDate } from "../lib/format";
import { trackLabeler } from "../lib/labels";
import { groupColor, groupIcon, groupLabel, groupOrder } from "../lib/groups";
import type { Schedule, TrackResult } from "../lib/scheduler";

type SortKey = "time" | "startBy" | "end" | "name";

export function ItemTable({ schedule, now }: { schedule: Schedule; now: number }) {
  const [rawFilter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("time");
  const [query, setQuery] = useState("");
  const [showMaxed, setShowMaxed] = useState(false);
  const label = useMemo(() => trackLabeler(schedule.plan.tracks), [schedule]);

  const planned = useMemo(
    () => schedule.tracks.filter((r) => !r.track.excluded && (showMaxed || r.timeToMax > 0)),
    [schedule, showMaxed],
  );
  const groups = useMemo(
    () => [...new Set(planned.map((r) => r.track.group))].sort((a, b) => groupOrder(a) - groupOrder(b)),
    [planned],
  );
  // Fall back to "All" if the selected group was just excluded from the plan.
  const filter = rawFilter === "all" || groups.includes(rawFilter) ? rawFilter : "all";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return planned
      .filter((r) => filter === "all" || r.track.group === filter)
      .filter((r) => !q || r.track.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "time"
          ? b.timeToMax - a.timeToMax
          : sort === "startBy"
            ? a.latestStart - b.latestStart
            : sort === "end"
            ? (b.end ?? 0) - (a.end ?? 0)
            : label(a.track).localeCompare(label(b.track), undefined, { numeric: true }),
      );
  }, [planned, filter, sort, query, label]);

  const longest = Math.max(1, ...planned.map((r) => r.timeToMax));
  const countIn = (g: string) => planned.filter((r) => g === "all" || r.track.group === g).length;
  const date = (offset: number) => (offset === 0 ? <b className="now">Now</b> : formatShortDate(now, offset));

  return (
    <section className="card table-card">
      <div className="table-head">
        <h2>Time to max</h2>
        <div className="tabs">
          {["all", ...groups].map((g) => (
            <button key={g} className={filter === g ? "tab active" : "tab"} onClick={() => setFilter(g)}>
              {g === "all" ? "All" : `${groupIcon(g)} ${groupLabel(g)}`}
              <span className="tab-count">{countIn(g)}</span>
            </button>
          ))}
        </div>
        <div className="table-tools">
          <input className="search" type="search" placeholder="🔍 Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="time">Longest time to max</option>
            <option value="startBy">Must start soonest</option>
            <option value="end">Finishes last</option>
            <option value="name">Name</option>
          </select>
          <label className="check-inline">
            <input type="checkbox" checked={showMaxed} onChange={(e) => setShowMaxed(e.target.checked)} /> Show maxed
          </label>
        </div>
      </div>
      <p className="hint">
        <b>Time to max</b> = all remaining levels back to back. <b>Start by</b> = the latest date you can begin and still
        finish on the planned date. <span className="badge crit">critical</span> items have less than a week to spare.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Level</th>
              <th className="bar-col">Time to max</th>
              <th>Start by</th>
              <th>Planned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = r.track;
              const running = t.steps[0]?.inProgress;
              const left = t.to - t.from;
              return (
                <tr key={t.key} className={r.critical ? "critical" : ""}>
                  <td>
                    <div className="item-name">
                      <span className="item-icon">{groupIcon(t.group)}</span>
                      {label(t)}
                      {r.critical && <span className="badge crit">critical</span>}
                      {running && <span className="badge run">upgrading</span>}
                      {t.isNew && <span className="badge new">new</span>}
                    </div>
                    {t.notes.length > 0 && (
                      <div className="item-sub">
                        {t.notes.map((n) => (
                          <span key={n}>{n}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="lvl-cell">
                    {left > 0 ? (
                      <>
                        {t.from} → <b>{t.to}</b>
                        <span className="lvl-left">{left} left</span>
                      </>
                    ) : (
                      <span className="done">{t.to} ✓</span>
                    )}
                  </td>
                  <td className="bar-col">
                    {r.timeToMax > 0 && (
                      <div className="bar">
                        <div className="fill" style={{ width: `${(r.timeToMax / longest) * 100}%`, background: groupColor(t.group, t.name) }} />
                        <span>{formatDuration(r.timeToMax)}</span>
                      </div>
                    )}
                  </td>
                  <td>{r.timeToMax > 0 ? date(r.latestStart) : ""}</td>
                  <td className="planned">
                    {r.start != null && r.end != null && r.timeToMax > 0 ? (
                      <>
                        {date(r.start)} <span className="muted">→</span> {formatShortDate(now, r.end)}
                      </>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="muted center">
                  🎉 Nothing left here — all maxed for this Town Hall.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
