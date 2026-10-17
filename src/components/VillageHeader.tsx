import { formatDate, formatDuration } from "../lib/format";
import type { Village } from "../lib/parseExport";
import type { Schedule } from "../lib/scheduler";

interface Props {
  tag: string;
  village: Village;
  schedule: Schedule;
  now: number;
  onUpdate: () => void;
}

export function VillageHeader({ tag, village, schedule, now, onUpdate }: Props) {
  const { finish, lowerBound, totalWork, builders, apprenticeSaved } = schedule;
  const items = schedule.tracks.filter((r) => r.timeToMax > 0 && !r.track.excluded).length;
  const waste = finish - lowerBound;
  const age = village.timestamp ? now / 1000 - village.timestamp : 0;
  const stale = age > 2 * 86400;

  return (
    <section className="card village">
      <div className="village-id">
        <div className="th-badge" title={`Town Hall ${village.townHall}`}>
          <small>TH</small>
          {village.townHall}
        </div>
        <div>
          <h2>{tag}</h2>
          <div className="muted village-meta">
            {village.timestamp ? (
              <span className={stale ? "stale" : ""}>
                Exported {formatDuration(age)} ago{stale && " · re-export for accurate timers"}
              </span>
            ) : (
              <span>Export time unknown</span>
            )}
            <button className="link" onClick={onUpdate}>
              Update export
            </button>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="stat stat-main">
          <div className="stat-label">Everything maxed in</div>
          {finish > 0 ? (
            <>
              <div className="stat-value">{formatDuration(finish)}</div>
              <div className="stat-sub">🗓️ {formatDate(now, finish)}</div>
            </>
          ) : (
            <div className="stat-value done">Maxed ✓</div>
          )}
        </div>
        <div className="stat">
          <div className="stat-label">Builder time</div>
          <div className="stat-value">{formatDuration(totalWork)}</div>
          <div className="stat-sub">
            {waste > 3600 ? (
              <span title="How much later than a perfect split between builders">+{formatDuration(waste)} vs. ideal</span>
            ) : finish > 0 ? (
              <span className="good">✓ perfectly balanced</span>
            ) : (
              ""
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Builders</div>
          <div className="stat-value">{builders}</div>
          <div className="stat-sub">
            {apprenticeSaved > 0
              ? `+ Apprentice: −${formatDuration(apprenticeSaved)}`
              : builders > 0 && finish > 0
                ? `${formatDuration(totalWork / builders)} each`
                : ""}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Left to upgrade</div>
          <div className="stat-value">{items}</div>
          <div className="stat-sub">buildings &amp; heroes</div>
        </div>
      </div>

      {village.townHallUpgrading && (
        <p className="notice">🏗️ Your Town Hall itself is upgrading — this plan is for its current level.</p>
      )}
    </section>
  );
}
