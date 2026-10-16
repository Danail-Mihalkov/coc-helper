import { useEffect, useMemo, useState } from "react";
import { ImportPanel } from "./components/ImportPanel";
import { ItemTable } from "./components/ItemTable";
import { NextUp } from "./components/NextUp";
import { candidatesFrom, PlanFilter, type Candidate } from "./components/PlanFilter";
import { PlanSettings } from "./components/PlanSettings";
import { Timeline } from "./components/Timeline";
import { VillageHeader } from "./components/VillageHeader";
import { gameData } from "./lib/gamedata";
import { parseExport, type Village } from "./lib/parseExport";
import { buildPlan, normalizeSettings, type Settings } from "./lib/plan";
import { schedule, type Schedule } from "./lib/scheduler";
import { loadActive, loadProfiles, saveActive, saveProfiles, type Profile } from "./lib/storage";

type Result =
  | { ok: true; now: number; village: Village; settings: Settings; schedule: Schedule; candidates: Candidate[] }
  | { ok: false; error: string };

export default function App() {
  const [profiles, setProfiles] = useState<Record<string, Profile>>(loadProfiles);
  const [active, setActive] = useState<string | null>(() => {
    const a = loadActive();
    return a && loadProfiles()[a] ? a : null;
  });

  /** "new" = adding another village, "update" = replacing the active village's export. */
  const [importing, setImporting] = useState<null | "new" | "update">(null);

  useEffect(() => saveProfiles(profiles), [profiles]);
  useEffect(() => saveActive(active), [active]);

  const profile = active ? profiles[active] : undefined;

  const result = useMemo((): Result | null => {
    if (!profile) return null;
    try {
      const now = Date.now();
      const village = parseExport(profile.exportText, now / 1000);
      const settings = normalizeSettings(village, profile.settings);
      const candidates = candidatesFrom(buildPlan(village, { ...settings, excluded: [] }));
      return { ok: true, now, village, settings, candidates, schedule: schedule(buildPlan(village, settings)) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, [profile]);

  function save(tag: string, exportText: string) {
    setProfiles((p) => ({
      ...p,
      [tag]: { tag, exportText, savedAt: Date.now(), settings: p[tag]?.settings },
    }));
    setActive(tag);
    setImporting(null);
  }

  function updateSettings(settings: Settings) {
    if (!active) return;
    setProfiles((p) => ({ ...p, [active]: { ...p[active], settings } }));
  }

  function remove(tag: string) {
    setProfiles((p) => {
      const { [tag]: _, ...rest } = p;
      return rest;
    });
    if (active === tag) setActive(null);
  }

  const saved = Object.values(profiles).sort((a, b) => b.savedAt - a.savedAt);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <div>
            <h1>CoC Helper</h1>
            <span className="muted">Town Hall upgrade planner</span>
          </div>
        </div>
        {saved.length > 0 && (
          <nav className="villages" aria-label="Saved villages">
            {saved.map((p) => (
              <span key={p.tag} className={`village-chip ${p.tag === active ? "active" : ""}`}>
                <button
                  className="link"
                  onClick={() => {
                    setActive(p.tag);
                    setImporting(null);
                  }}
                >
                  {p.tag}
                </button>
                <button
                  className="link remove"
                  title={`Forget ${p.tag}`}
                  aria-label={`Forget ${p.tag}`}
                  onClick={() => {
                    if (confirm(`Forget ${p.tag} and its settings?`)) remove(p.tag);
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
            <button className="ghost small" onClick={() => setImporting("new")}>
              + Add village
            </button>
          </nav>
        )}
      </header>

      {(!profile || importing) && (
        <ImportPanel
          key={importing ?? "first"}
          currentTag={importing === "update" ? active : null}
          onSave={save}
          onCancel={profile ? () => setImporting(null) : undefined}
        />
      )}

      {result && !result.ok && (
        <p className="card error-msg">
          ⚠️ {result.error}{" "}
          <button className="link" onClick={() => setImporting("update")}>
            Paste a new export
          </button>
        </p>
      )}

      {result?.ok && active && (
        <>
          <VillageHeader
            tag={active}
            village={result.village}
            schedule={result.schedule}
            now={result.now}
            onUpdate={() => setImporting("update")}
          />
          <div className="layout">
            <aside className="sidebar">
              <PlanSettings settings={result.settings} onChange={updateSettings} />
              <PlanFilter
                candidates={result.candidates}
                excluded={result.settings.excluded}
                onChange={(excluded) => updateSettings({ ...result.settings, excluded })}
              />
            </aside>
            <main className="main">
              <NextUp schedule={result.schedule} now={result.now} />
              <ItemTable schedule={result.schedule} now={result.now} />
              <Timeline schedule={result.schedule} now={result.now} />
            </main>
          </div>
        </>
      )}

      <footer className="muted">
        Game data: ClashKing static data ({new Date(gameData.generatedAt).toLocaleDateString()}). Plans builder
        upgrades only — no lab or pets. Walls and hero equipment aren't included. Not affiliated with Supercell.
      </footer>
    </div>
  );
}
