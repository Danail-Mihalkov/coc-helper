import { BUILDERS_APPRENTICE, helperDailyBoost, helperMaxLevelAt, LAB_ASSISTANT, MAX_BUILDERS } from "../lib/gamedata";
import { GOLD_PASS_BOOST, type Settings } from "../lib/plan";

interface Props {
  settings: Settings;
  townHall: number;
  /** Helper levels from the export. */
  helpers: Record<number, number>;
  onChange: (s: Settings) => void;
}

export function PlanSettings({ settings, townHall, helpers, onChange }: Props) {
  const boost = Math.round(GOLD_PASS_BOOST * 100);
  const apprenticeMax = helperMaxLevelAt(BUILDERS_APPRENTICE, townHall);
  const { seconds, multiplier } = helperDailyBoost(BUILDERS_APPRENTICE, settings.apprentice);
  const savedPerDay = (seconds * multiplier) / 3600;
  const labAssistant = helpers[LAB_ASSISTANT] ?? 0;

  return (
    <section className="card side-card">
      <h3>Plan settings</h3>
      <div className="setting">
        <div>
          <div className="setting-name">🔨 Builders</div>
          <div className="setting-desc">Counted from your Builder's Huts and B.O.B — adjust if needed.</div>
        </div>
        <Stepper
          value={settings.builders}
          min={1}
          max={MAX_BUILDERS}
          label="builders"
          onChange={(builders) => onChange({ ...settings, builders })}
        />
      </div>
      <div className="setting">
        <div>
          <div className="setting-name">🧑‍🔧 Builder's Apprentice</div>
          <div className="setting-desc">
            {apprenticeMax === 0
              ? "Unlocks at Town Hall 10."
              : settings.apprentice === 0
                ? `Not used. Set its level (max ${apprenticeMax} at TH${townHall}) to count it in.`
                : `Assigned once a day to the most urgent upgrade: −${savedPerDay}h a day.${
                    settings.apprentice < apprenticeMax ? ` Max level here is ${apprenticeMax}.` : ""
                  }`}
          </div>
        </div>
        {apprenticeMax > 0 && (
          <Stepper
            value={settings.apprentice}
            min={0}
            max={apprenticeMax}
            label="apprentice level"
            onChange={(apprentice) => onChange({ ...settings, apprentice })}
          />
        )}
      </div>
      {labAssistant > 0 && (
        <p className="setting-desc setting-note">
          🧪 Lab Assistant level {labAssistant} only speeds up research, which isn't part of this plan.
        </p>
      )}
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

function Stepper(props: { value: number; min: number; max: number; label: string; onChange: (n: number) => void }) {
  const { value, min, max, label, onChange } = props;
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Lower ${label}`}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Raise ${label}`}>
        +
      </button>
    </div>
  );
}
