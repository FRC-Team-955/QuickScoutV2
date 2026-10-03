export type PitScoutingResponse = Record<string, string | string[]>;

// Per-auto responses are keyed `auto_{index}_{questionId}` while the form is open
const AUTO_KEY = /^auto_(\d+)_(.+)$/;

/** RTDB payload for pitScouting/{date}/{team}/{uid}: meta + flat responses + `auto{n}` objects */
export const buildPitPayload = (
    responses: PitScoutingResponse,
    teamNumber: string,
    user: { id: string; name?: string },
    submittedAt: unknown,
) => {
    const flat: PitScoutingResponse = {};
    const autos: Record<string, PitScoutingResponse> = {};
    Object.entries(responses).forEach(([key, value]) => {
        const m = key.match(AUTO_KEY);
        if (m) (autos[`auto${m[1]}`] ??= {})[m[2]] = value;
        else flat[key] = value;
    });
    return {
        teamNumber: parseInt(teamNumber, 10),
        scoutName: user.name || "Unknown",
        scoutId: user.id,
        submittedAt,
        ...flat,
        ...autos,
    };
};

/** Drop auto `index`'s responses and shift later autos down so they stay aligned with their cards */
export const removeAutoResponses = (responses: PitScoutingResponse, index: number): PitScoutingResponse =>
    Object.fromEntries(
        Object.entries(responses).flatMap(([key, value]) => {
            const m = key.match(AUTO_KEY);
            const i = m ? Number(m[1]) : -1;
            if (i === index) return [];
            return [[i > index ? `auto_${i - 1}_${m[2]}` : key, value]];
        }),
    );

/** Team numbers with at least one pit entry in a `pitScouting` snapshot ({date: {team: {uid: entry}}}) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getScoutedTeams = (pitData: any): Set<number> => {
    const scouted = new Set<number>();
    Object.values(pitData ?? {}).forEach((byTeam: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!byTeam || typeof byTeam !== "object") return;
        Object.entries(byTeam).forEach(([teamNum, byUser]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!byUser || typeof byUser !== "object") return;
            Object.values(byUser).forEach((entry: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                // teamNumber may come back as a string; Number() keeps the Set lookup numeric
                if (entry && typeof entry === "object") scouted.add(Number(entry.teamNumber) || parseInt(teamNum, 10) || 0);
            });
        });
    });
    return scouted;
};
