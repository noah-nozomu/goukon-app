export const PRESET_THEMES = [
  "この中で一番人気がありそうな人",
  "この中で一番エロそうな人",
  "この中で一番浮気をしなさそうな人",
  "夜の営みが一番激しそうな人",
  "変態な性癖がありそうな人",
] as const;

export type MinigameStatus = "waiting" | "voting" | "result";

export interface RankedEntry {
  uid: string;
  votes: number;
  rank: number;
}

/** 得票1以上を多い順に並べ、同票は同じ順位。3位の境界で同票の人も含める。 */
export function rankTopThree(counts: Map<string, number>): RankedEntry[] {
  const rows = [...counts.entries()]
    .filter(([, votes]) => votes > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const result: RankedEntry[] = [];
  let rank = 1;
  let index = 0;
  while (index < rows.length && rank <= 3) {
    const votes = rows[index][1];
    while (index < rows.length && rows[index][1] === votes) {
      result.push({ uid: rows[index][0], votes, rank });
      index += 1;
    }
    rank += 1;
  }
  return result;
}

/** Firestore のドキュメント ID に使えるテーマ ID。自由記述の文章は入れない。 */
export function createThemeId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
