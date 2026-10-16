import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../lib/format";
import { groupIcon, groupLabel, groupOrder } from "../lib/groups";
import type { Plan } from "../lib/plan";

export interface Candidate {
  key: string;
  name: string;
  group: string;
  /** Instances that still have upgrades left. */
  count: number;
  /** Total upgrade time across those instances. */
  work: number;
}

/** Everything with upgrades left, one entry per building type / hero, from a plan with nothing excluded. */
export function candidatesFrom(plan: Plan): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const t of plan.tracks) {
    const work = t.steps.reduce((a, s) => a + s.duration, 0);
    if (!work) continue;
    const c = byKey.get(t.itemKey) ?? { key: t.itemKey, name: t.name, group: t.group, count: 0, work: 0 };
    c.count++;
    c.work += work;
    byKey.set(t.itemKey, c);
  }
  return [...byKey.values()].sort(
    (a, b) => groupOrder(a.group) - groupOrder(b.group) || b.work - a.work,
  );
}

interface Props {
  candidates: Candidate[];
  excluded: string[];
  onChange: (excluded: string[]) => void;
}

export function PlanFilter({ candidates, excluded, onChange }: Props) {
  const off = new Set(excluded);
  const groups = [...new Set(candidates.map((c) => c.group))];
  const [open, setOpen] = useState<Set<string>>(new Set());

  const setMany = (keys: string[], include: boolean) => {
    const next = new Set(off);
    for (const k of keys) include ? next.delete(k) : next.add(k);
    onChange([...next]);
  };
  const toggleOpen = (g: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  const includedCount = candidates.filter((c) => !off.has(c.key)).length;

  return (
    <section className="card side-card plan-filter">
      <div className="pf-head">
        <h3>What to upgrade</h3>
        <span className="muted">
          {includedCount}/{candidates.length}
        </span>
      </div>
      <p className="setting-desc">
        Untick anything you don't want in the plan. Upgrades already running still keep their builder busy.
      </p>
      <div className="pf-actions">
        <button className="ghost small" onClick={() => onChange([])} disabled={!excluded.length}>
          Select all
        </button>
        <button className="ghost small" onClick={() => setMany(candidates.map((c) => c.key), false)}>
          Clear
        </button>
      </div>
      {!candidates.length && <p className="muted">Everything is maxed for this Town Hall. 🎉</p>}
      <div className="pf-groups">
        {groups.map((g) => {
          const items = candidates.filter((c) => c.group === g);
          const on = items.filter((c) => !off.has(c.key));
          const isOpen = open.has(g);
          return (
            <div className={`pf-group ${isOpen ? "open" : ""}`} key={g}>
              <div className="pf-group-row">
                <GroupCheckbox
                  checked={on.length === items.length}
                  indeterminate={on.length > 0 && on.length < items.length}
                  onChange={(v) => setMany(items.map((c) => c.key), v)}
                  label={`Include all ${groupLabel(g)}`}
                />
                <button className="pf-group-toggle" onClick={() => toggleOpen(g)} aria-expanded={isOpen}>
                  <span className="pf-icon">{groupIcon(g)}</span>
                  <span className="pf-name">{groupLabel(g)}</span>
                  <span className={`pf-count ${on.length < items.length ? "partial" : ""}`}>
                    {on.length}/{items.length}
                  </span>
                  <span className="chev">›</span>
                </button>
              </div>
              {isOpen && (
                <div className="pf-items">
                  {items.map((c) => {
                    const active = !off.has(c.key);
                    return (
                      <button
                        key={c.key}
                        className={`pf-chip ${active ? "on" : "off"}`}
                        aria-pressed={active}
                        onClick={() => setMany([c.key], !active)}
                        title={`${c.count} with upgrades left · ${formatDuration(c.work)} of builder time`}
                      >
                        <span className="pf-tick">{active ? "✓" : "+"}</span>
                        {c.name}
                        {c.count > 1 && <span className="pf-mult">×{c.count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GroupCheckbox(props: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = props.indeterminate;
  }, [props.indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="cb"
      aria-label={props.label}
      checked={props.checked}
      onChange={(e) => props.onChange(e.target.checked)}
    />
  );
}
