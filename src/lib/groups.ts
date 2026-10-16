/** Display order, labels, icons and colour hues for building groups (from the game data `type`). */
export const GROUPS: { key: string; label: string; icon: string; hue: number }[] = [
  { key: "Defense", label: "Defenses", icon: "🏰", hue: 22 },
  { key: "Trap", label: "Traps", icon: "💣", hue: 0 },
  { key: "Resource", label: "Resources", icon: "💰", hue: 45 },
  { key: "Army", label: "Army buildings", icon: "⚔️", hue: 270 },
  { key: "Worker", label: "Builder's Huts", icon: "🔨", hue: 205 },
  { key: "Hero", label: "Heroes", icon: "👑", hue: 320 },
  { key: "Guardian", label: "Guardians", icon: "🛡️", hue: 150 },
];

const find = (key: string) => GROUPS.find((g) => g.key === key);

export function groupLabel(key: string): string {
  return find(key)?.label ?? key;
}

export function groupIcon(key: string): string {
  return find(key)?.icon ?? "🏗️";
}

export function groupOrder(key: string): number {
  const i = GROUPS.findIndex((g) => g.key === key);
  return i === -1 ? GROUPS.length : i;
}

/** A colour in the group's hue, varied per item name so neighbouring items stay distinguishable. */
export function groupColor(key: string, name = ""): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  const hue = find(key)?.hue ?? 210;
  return `hsl(${hue} ${55 + (h % 15)}% ${38 + (h % 5) * 4}%)`;
}
