import type {TbaMatch} from "@/lib/tba";

// Ridge term: makes rank-deficient schedules (early event, teams always paired) solvable,
// giving ~minimum-norm OPRs instead of Infinity/garbage. Shifts full-rank results by ~1e-6.
const RIDGE = 1e-6;

// Least-squares OPR. One row per alliance per played match (score >= 0); teams in
// notPlaying[matchKey] are dropped from that match's rows. Solves (AᵀA + λI)x = Aᵀb.
// Teams with no counted appearances are omitted.
export const computeOPRs = (
    matches: Pick<TbaMatch, "key" | "alliances">[],
    notPlaying: Record<string, Set<string>> = {},
): Record<string, number> => {
    const rows = matches
        .filter((m) => m.alliances.red.score >= 0 && m.alliances.blue.score >= 0)
        .flatMap((m) => [m.alliances.red, m.alliances.blue].map((a) => ({
            teams: a.team_keys.filter((t) => !notPlaying[m.key]?.has(t)),
            score: a.score,
        })));

    const teams = [...new Set(rows.flatMap((r) => r.teams))].sort();
    const idx = new Map(teams.map((t, i) => [t, i]));
    const N = teams.length;

    // Augmented [AᵀA + λI | Aᵀb]
    const a = teams.map((_, i) => Array.from({length: N + 1}, (_, j) => (i === j ? RIDGE : 0)));
    for (const {teams: ts, score} of rows) {
        for (const t of ts) {
            const i = idx.get(t);
            for (const u of ts) a[i][idx.get(u)]++;
            a[i][N] += score;
        }
    }

    // Gauss-Jordan; the matrix is symmetric positive definite, so no pivoting is needed.
    for (let c = 0; c < N; c++) {
        for (let r = 0; r < N; r++) {
            const f = r === c ? 0 : a[r][c] / a[c][c];
            if (f) for (let k = c; k <= N; k++) a[r][k] -= f * a[c][k];
        }
    }

    return Object.fromEntries(teams.map((t, i) => [t, a[i][N] / a[i][i]]));
};
