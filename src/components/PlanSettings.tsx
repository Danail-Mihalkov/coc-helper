import { GOLD_PASS_BOOST, type Settings } from "../lib/plan";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export function PlanSettings({ settings, onChange }: Props) {
  const setBuilders = (n: number) => onChange({ ...settings, builders: Math.min(10, Math.max(1, n)) });
  const boost = Math.round(GOLD_PASS_BOOST * 100);

  return (
    <section className="card side-card">
      <h3>Plan settings</h3>
      <div className="setting">
        <div>
          <div className="setting-name">🔨 Builders</div>
          <div className="setting-desc">Counted from your Builder's Huts and B.O.B — adjust if needed.</div>
        </div>
        <div className="stepper">
          <button onClick={() => setBuilders(settings.builders - 1)} disabled={settings.builders <= 1} aria-label="Fewer builders">
            −
          </button>
          <span aria-live="polite">{settings.builders}</span>
          <button onClick={() => setBuilders(settings.builders + 1)} disabled={settings.builders >= 10} aria-label="More builders">
            +
          </button>
        </div>
      </div>
      <label className="setting switch-row">
        <div>
          <div className="setting-name">🏅 Gold Pass</div>
          <div className="setting-desc">
            −{boost}% on upgrades not yet started. Nominally 20%, but it unlocks partway through the season.
          </div>
        </div>
        <input
          type="checkbox"
          className="switch"
          checked={settings.goldPass}
          onChange={(e) => onChange({ ...settings, goldPass: e.target.checked })}
        />
      </label>
    </section>
  );
}
