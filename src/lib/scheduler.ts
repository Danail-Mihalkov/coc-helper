import { BUILDERS_APPRENTICE, helperDailyBoost } from "./gamedata";
import type { Plan, Step, Track } from "./plan";

const DAY = 86400;
const CRITICAL_SLACK = 7 * DAY;

export interface TrackResult {
  track: Track;
  /** Sum of all remaining upgrade times: how long it takes to max if worked on non-stop. */
  timeToMax: number;
  start?: number;
  end?: number;
  /** Latest time this item can start (and then run non-stop) without pushing back the finish date. */
  latestStart: number;
  /** True when there's (almost) no slack left: start it now and keep a builder on it. */
  critical: boolean;
}

export interface Schedule {
  plan: Plan;
  tracks: TrackResult[];
  builders: number;
  totalWork: number;
  finish: number;
  /** Best possible finish ignoring ordering problems: max(longest chain, work / builders). */
  lowerBound: number;
  /** Total time the Builder's Apprentice takes off the plan. */
  apprenticeSaved: number;
  /** Steps in start order. */
  order: Step[];
}

/**
 * List scheduling with critical-path priorities.
 *
 * Every upgrade level is a step. Steps of one building form a chain (you can't
 * upgrade two levels at once), and some steps wait on another (a hero level
 * needs a Hero Hall level, a merged defense needs its sources). Whenever a
 * builder is free, it takes the ready step whose remaining downstream work is
 * the longest. Long chains therefore start first and short ones fill the gaps,
 * so everything lands close to the same day.
 *
 * The Builder's Apprentice, if any, is assigned once a day to the running
 * step with the highest priority and takes `multiplier × seconds` off it.
 */
export function schedule(plan: Plan): Schedule {
  const { steps } = plan;
  const builders = Math.max(1, plan.settings.builders);
  const boost = helperDailyBoost(BUILDERS_APPRENTICE, plan.settings.apprentice);
  let nextBoost = boost.multiplier > 0 ? 0 : Infinity;
  let apprenticeSaved = 0;
  const priority = computePriorities(steps);

  const remainingPreds = steps.map((s) => s.preds.length);
  const ready: Step[] = [];
  const slots: (number | null)[] = Array(builders).fill(null);
  const events: Step[] = [];
  const order: Step[] = [];
  for (const s of steps) {
    s.start = s.end = s.slot = undefined;
  }

  const finishStep = (s: Step, t: number) => {
    for (const n of s.succs) {
      if (--remainingPreds[n.idx] === 0) enqueue(n, t);
    }
  };

  const startStep = (s: Step, t: number) => {
    let slot = slots.findIndex((x) => x === null);
    if (slot === -1) {
      // More upgrades already running than builders (e.g. Goblin Builder): add a temporary slot.
      slots.push(null);
      slot = slots.length - 1;
    }
    slots[slot] = s.idx;
    s.start = t;
    s.end = t + s.duration;
    s.slot = slot;
    order.push(s);
    events.push(s);
  };

  const enqueue = (s: Step, t: number) => {
    if (s.duration === 0 && !s.inProgress) {
      // Instant (e.g. unlocking a hero): completes as soon as it's allowed.
      s.start = s.end = t;
      order.push(s);
      finishStep(s, t);
      return;
    }
    ready.push(s);
  };

  // Upgrades already running in the export occupy their builder from t = 0.
  for (const s of steps) {
    if (s.inProgress) startStep(s, 0);
  }
  for (const s of steps) {
    if (!s.inProgress && s.preds.length === 0) enqueue(s, 0);
  }

  let t = 0;
  for (;;) {
    let running = slots.filter((x) => x !== null).length;
    while (running < builders && ready.length) {
      let best = 0;
      for (let i = 1; i < ready.length; i++) {
        if (priority[ready[i].idx] > priority[ready[best].idx]) best = i;
      }
      const [s] = ready.splice(best, 1);
      startStep(s, t);
      running++;
    }
    if (t >= nextBoost) {
      apprenticeSaved += assignApprentice(t);
      nextBoost += DAY;
    }
    if (!events.length) break;
    // Advance to the next completion (or apprentice shift) and release everything that ends then.
    t = Math.min(nextBoost, ...events.map((s) => s.end!));
    for (let i = events.length - 1; i >= 0; i--) {
      const s = events[i];
      if (s.end! > t) continue;
      events.splice(i, 1);
      slots[s.slot!] = null;
      finishStep(s, t);
    }
    // Drop overflow slots once they're free.
    while (slots.length > builders && slots[slots.length - 1] === null) slots.pop();
  }

  /** Boosts the most urgent running upgrade; returns the time saved. */
  function assignApprentice(t: number): number {
    let best: Step | undefined;
    for (const s of events) {
      if (s.end! > t && (!best || priority[s.idx] > priority[best.idx])) best = s;
    }
    if (!best) return 0;
    const left = best.end! - t;
    const { seconds, multiplier } = boost;
    // While boosted it progresses (1 + multiplier)× as fast; it may finish within the boost.
    const newLeft = left >= (1 + multiplier) * seconds ? left - multiplier * seconds : left / (1 + multiplier);
    best.end = t + newLeft;
    return left - newLeft;
  }

  const totalWork = steps.reduce((a, s) => a + s.duration, 0);
  const finish = Math.max(0, ...steps.map((s) => s.end ?? 0));
  // The apprentice adds a fraction of a builder, and can speed up any one chain by the same fraction.
  const boostShare = (boost.multiplier * boost.seconds) / DAY;
  const chains = plan.tracks.map((tr) => tr.steps.reduce((a, s) => a + s.duration, 0));

  const tracks: TrackResult[] = plan.tracks.map((track) => {
    const timeToMax = track.steps.reduce((a, s) => a + s.duration, 0);
    const latestStart = Math.max(0, finish - timeToMax);
    return {
      track,
      timeToMax,
      start: track.steps[0]?.start,
      end: track.steps[track.steps.length - 1]?.end,
      latestStart,
      critical: timeToMax > 0 && latestStart <= CRITICAL_SLACK,
    };
  });

  return {
    plan,
    tracks,
    builders,
    totalWork,
    finish,
    lowerBound: Math.max(0, ...chains.map((c) => c / (1 + boostShare)), totalWork / (builders + boostShare)),
    apprenticeSaved,
    order,
  };
}

/** Priority of a step = the longest chain of work that can't start until it's done (critical path). */
function computePriorities(steps: Step[]): number[] {
  const order = topoOrder(steps);
  const bottom = new Array(steps.length).fill(0);
  for (let i = order.length - 1; i >= 0; i--) {
    const s = order[i];
    let down = 0;
    for (const n of s.succs) down = Math.max(down, bottom[n.idx]);
    bottom[s.idx] = s.duration + down;
  }
  return bottom;
}

function topoOrder(steps: Step[]): Step[] {
  const indeg = steps.map((s) => s.preds.length);
  const queue = steps.filter((s) => s.preds.length === 0);
  const out: Step[] = [];
  while (queue.length) {
    const s = queue.shift()!;
    out.push(s);
    for (const n of s.succs) if (--indeg[n.idx] === 0) queue.push(n);
  }
  return out;
}
