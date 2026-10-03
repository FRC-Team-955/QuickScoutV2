import {getDataLabel} from "@/lib/dateUtils";

export type EventType = "all" | "osf" | "clack" | "dcmp" | "current";

export type SortBy =
    | "newest"
    | "highest_score_auto"
    | "highest_score_teleop"
    | "highest_total_score"
    | "highest_climb"
    | "best_defense";

// `path` is the exact RTDB location the entry was read from (built from real keys); null = not deletable.
export type MatchEntry = {
    id: string;
    matchKey: string;
    userId: string;
    station: string;
    teamNumber: number;
    scoutName: string;
    score_auto: number;
    score_teleop: number;
    total_score: number;
    climb: string;
    climbValue: number;
    defense_rating: string;
    defense_rating_value: number;
    robotTipped?: boolean;
    robotDead?: boolean;
    submittedAt: number;
    path?: string | null;
};

export type PitScoutingEntry = {
    id: string;
    dateStr: string;
    teamNumber: number;
    scoutName: string;
    scoutId: string;
    responses: Record<string, unknown>;
    submittedAt: number;
    path?: string | null;
};

export type SubjectiveScoutingEntry = {
    id: string;
    matchId: string;
    teamNumber: string;
    scoutName: string;
    userId: string;
    robotPerformance: {
        autonomousEffectiveness: string;
        canQuicklyScore: string;
        canClimb: string;
        climbLevel?: string | null;
    };
    teamDynamics: {
        performanceUnderPressure: string;
        teamFocus: string;
        driverSynchronization: string;
    };
    tacticalInsights: {
        defensiveStrategy: string;
        blockingEffectiveness: string;
        allyCooperation: string;
    };
    misc?: {
        defensiveSkill?: string;
        robotReliability?: string;
        robotPenalties?: string;
        autoFuel?: string;
        autoClimb?: string;
        teleopPassing?: string;
        gameSense?: string;
        strengths?: string;
        weaknesses?: string;
    };
    submittedAt: number;
    path?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw RTDB snapshots are untyped
type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object";
const str = (v: unknown) => (v == null ? "" : String(v));

/** Join RTDB keys into a path, or null if any segment is empty or would escape its level. */
export const dbPath = (...segments: unknown[]): string | null =>
    segments.every((s) => typeof s === "string" && s.trim() !== "" && !/[/.#$[\]]/.test(s))
        ? segments.join("/")
        : null;

export const matchesSelectedEvent = (timestamp: number, eventType: EventType): boolean =>
    eventType === "all" || getDataLabel(timestamp).toLowerCase() === eventType;

export const parseClimbValue = (val: unknown): { climbValue: number; climbDisplay: string } => {
    const n = typeof val === "number" ? (val > 0 ? val : 0) : Number(str(val).match(/[1-3]/)?.[0] ?? 0);
    return n ? {climbValue: n, climbDisplay: `L${n}`} : {climbValue: 0, climbDisplay: "N/A"};
};

const DEFENSE_LABELS = ["", "1 - Poor", "2 - Fair", "3 - Good", "4 - Excellent"];

export const parseDefenseRating = (val: unknown): { defenseValue: number; defenseDisplay: string } => {
    const n = typeof val === "number"
        ? (Number.isInteger(val) && val >= 1 && val <= 4 ? val : 0)
        : Number(str(val).trim().match(/^[1-4]/)?.[0] ?? 0);
    return n ? {defenseValue: n, defenseDisplay: DEFENSE_LABELS[n]} : {defenseValue: 0, defenseDisplay: "N/A"};
};

const yes = (v: unknown) => v === true || str(v).toLowerCase() === "yes";

/** matches/{matchKey}/participants/{userId} → one MatchEntry per submitted participant */
export const parseMatches = (matchesData: unknown): MatchEntry[] => {
    if (!isObj(matchesData)) return [];
    const out: MatchEntry[] = [];
    Object.entries(matchesData).forEach(([matchKey, matchValue]) => {
        if (!isObj(matchValue)) return;
        // Legacy docs may hold reports at the match root; those are shown but not deletable.
        const underParticipants = isObj(matchValue.participants);
        const root = underParticipants ? matchValue.participants : matchValue;
        Object.entries(root).forEach(([stationId, data]) => {
            if (!isObj(data) || !data.teamNumber) return;
            const auto = isObj(data.autonomous) ? data.autonomous : {};
            const teleop = isObj(data.teleop) ? data.teleop : {};
            // RTDB may hand back numeric fields as strings; coerce so "3" + "5" isn't "35".
            const autoScore = Number(auto.score) || Number(auto.fuel) || 0;
            const teleopScore = Number(teleop.score) || Number(teleop.fuel) || 0;
            const {climbValue, climbDisplay} = parseClimbValue(teleop.climbLevel);
            const {defenseValue, defenseDisplay} = parseDefenseRating(teleop.defenseScore);
            const submittedAt = Number(data.submittedAt) || 0;
            out.push({
                id: `${matchKey}_${stationId}_${submittedAt || Math.random()}`,
                matchKey,
                userId: str(data.userId) || stationId,
                station: stationId,
                teamNumber: parseInt(String(data.teamNumber)),
                scoutName: str(data.scoutName) || "Unknown",
                score_auto: autoScore,
                score_teleop: teleopScore,
                total_score: autoScore + teleopScore,
                climb: climbDisplay,
                climbValue,
                defense_rating: defenseDisplay,
                defense_rating_value: defenseValue,
                robotTipped: yes(data.robotTipped),
                robotDead: yes(data.robotDead),
                submittedAt,
                path: underParticipants ? dbPath("matches", matchKey, "participants", stationId) : null,
            });
        });
    });
    return out;
};

const PIT_META_KEYS = ["teamNumber", "scoutName", "scoutId", "submittedAt"];

/** pitScouting/{dateStr}/{teamNumber}/{userId} → flat fields */
export const parsePitScouting = (pitData: unknown): PitScoutingEntry[] => {
    if (!isObj(pitData)) return [];
    const out: PitScoutingEntry[] = [];
    Object.entries(pitData).forEach(([dateStr, dateValue]) => {
        if (!isObj(dateValue)) return;
        Object.entries(dateValue).forEach(([teamKey, teamValue]) => {
            if (!isObj(teamValue)) return;
            Object.entries(teamValue).forEach(([userId, entry]) => {
                if (!isObj(entry)) return;
                out.push({
                    id: `${dateStr}_${teamKey}_${userId}`,
                    dateStr,
                    teamNumber: Number(entry.teamNumber) || parseInt(teamKey, 10) || 0,
                    scoutName: str(entry.scoutName) || "Unknown",
                    scoutId: str(entry.scoutId) || userId,
                    responses: Object.fromEntries(Object.entries(entry).filter(([k]) => !PIT_META_KEYS.includes(k))),
                    submittedAt: Number(entry.submittedAt) || 0,
                    path: dbPath("pitScouting", dateStr, teamKey, userId),
                });
            });
        });
    });
    return out;
};

/** subjectiveMatches/{matchId}/participants/{userId} → one entry per submitted participant */
export const parseSubjective = (subjectiveData: unknown): SubjectiveScoutingEntry[] => {
    if (!isObj(subjectiveData)) return [];
    const out: SubjectiveScoutingEntry[] = [];
    Object.entries(subjectiveData).forEach(([matchId, matchValue]) => {
        if (!isObj(matchValue) || !isObj(matchValue.participants)) return;
        Object.entries(matchValue.participants).forEach(([userId, p]) => {
            // Skip numeric indices (array elements) - only process actual userId keys
            if (/^\d+$/.test(userId) || !isObj(p)) return;
            const teamNumber = str(p.teamNumber).trim();
            const scoutName = str(p.scoutName).trim();
            if (!teamNumber || !scoutName) return; // unsubmitted placeholder
            const rp = isObj(p.robotPerformance) ? p.robotPerformance : {};
            const td = isObj(p.teamDynamics) ? p.teamDynamics : {};
            const ti = isObj(p.tacticalInsights) ? p.tacticalInsights : {};
            const misc = isObj(p.misc) ? p.misc : {};
            out.push({
                id: `${matchId}_${userId}`,
                matchId,
                userId,
                teamNumber,
                scoutName,
                robotPerformance: {
                    autonomousEffectiveness: str(rp.autonomousEffectiveness),
                    canQuicklyScore: str(rp.canQuicklyScore),
                    canClimb: str(rp.canClimb),
                    climbLevel: rp.climbLevel || null,
                },
                teamDynamics: {
                    performanceUnderPressure: str(td.performanceUnderPressure),
                    teamFocus: str(td.teamFocus),
                    driverSynchronization: str(td.driverSynchronization),
                },
                tacticalInsights: {
                    defensiveStrategy: str(ti.defensiveStrategy),
                    blockingEffectiveness: str(ti.blockingEffectiveness),
                    allyCooperation: str(ti.allyCooperation),
                },
                misc: {
                    defensiveSkill: str(misc.defensiveSkill),
                    robotReliability: str(misc.robotReliability || misc.robotReliablity),
                    robotPenalties: str(misc.robotPenalties),
                    autoFuel: str(misc.autoFuel),
                    autoClimb: str(misc.autoClimb || misc.autoClimb1),
                    teleopPassing: str(misc.teleopPassing),
                    gameSense: str(misc.gameSense),
                    strengths: str(misc.strengths),
                    weaknesses: str(misc.weaknesses),
                },
                submittedAt: Number(p.submittedAt) || 0,
                path: dbPath("subjectiveMatches", matchId, "participants", userId),
            });
        });
    });
    return out;
};

const SORT_KEYS: Record<SortBy, keyof MatchEntry> = {
    newest: "submittedAt",
    highest_score_auto: "score_auto",
    highest_score_teleop: "score_teleop",
    highest_total_score: "total_score",
    highest_climb: "climbValue",
    best_defense: "defense_rating_value",
};

/** Returns a new array; never sorts state in place. */
export const sortMatches = (entries: MatchEntry[], sortBy: SortBy): MatchEntry[] =>
    [...entries].sort((a, b) => (Number(b[SORT_KEYS[sortBy]]) || 0) - (Number(a[SORT_KEYS[sortBy]]) || 0));

export type Stat = { avg: number; max: number; min: number };

export const statOf = (values: number[]): Stat =>
    values.length
        ? {avg: values.reduce((a, b) => a + b, 0) / values.length, max: Math.max(...values), min: Math.min(...values)}
        : {avg: 0, max: 0, min: 0};

export type MatchStats = Record<"autoScore" | "teleopScore" | "totalScore" | "climb" | "defense", Stat>;

export const matchStats = (entries: MatchEntry[]): MatchStats => ({
    autoScore: statOf(entries.map((m) => m.score_auto)),
    teleopScore: statOf(entries.map((m) => m.score_teleop)),
    totalScore: statOf(entries.map((m) => m.total_score)),
    // 0 climb = didn't climb (a real result); 0 defense = not rated, so it's excluded.
    climb: statOf(entries.map((m) => m.climbValue || 0)),
    defense: statOf(entries.map((m) => m.defense_rating_value).filter((v) => v > 0)),
});

export const formatKey = (key: string) =>
    key.replace(/-/g, "_").split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return ""; // objects are rendered separately
    return String(value).trim();
};

export type PitSections = {
    functions: [string, unknown][];
    capabilities: [string, unknown][];
    autos: [string, Record<string, unknown>][];
    drivebase: [string, unknown][];
    notes: [string, unknown][];
};

const CAPABILITY_WORDS = ["defense", "shooter", "fuel-hopper", "bps", "under-trench", "over-bump", "shoot-on", "pass-fuel"];

/** Buckets pit responses by key keyword; first match wins, unmatched keys are dropped. */
export const categorizePitResponses = (responses: Record<string, unknown>): PitSections => {
    const out: PitSections = {functions: [], capabilities: [], autos: [], drivebase: [], notes: []};
    Object.entries(responses).forEach(([key, value]) => {
        if (value == null || value === false) return;
        const k = key.toLowerCase();
        const has = (words: string[]) => words.some((w) => k.includes(w));
        if (has(["intake", "climb"])) out.functions.push([key, value]);
        else if (has(CAPABILITY_WORDS)) out.capabilities.push([key, value]);
        else if (k.startsWith("auto") && typeof value === "object") out.autos.push([key, value as Record<string, unknown>]);
        else if (has(["dimension", "special-detail"])) out.drivebase.push([key, value]);
        else if (has(["strength", "weakness", "feature", "note"])) out.notes.push([key, value]);
    });
    return out;
};

const pst = (ts: number) => new Date(ts).toLocaleString([], {timeZone: "America/Los_Angeles"});
const csvField = (v: unknown) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
const csvSection = (title: string, headers: string[], rows: unknown[][]) => [
    csvField(title),
    headers.map(csvField).join(","),
    ...rows.map((r) => r.map(csvField).join(",")),
    "",
];

/** RFC4180-ish CSV with one titled section per data kind. */
export const buildCsv = (
    matches: MatchEntry[],
    pits: PitScoutingEntry[],
    subjectives: SubjectiveScoutingEntry[],
): string => [
    ...csvSection(
        "MATCH SCOUTING DATA",
        ["Match Key", "Station", "Team Number", "Scout Name", "Auto Score", "Teleop Score", "Total Score", "Climb", "Defense Rating", "Robot Tipped", "Robot Dead", "Submitted At (PST)"],
        matches.map((e) => [e.matchKey, e.station, e.teamNumber, e.scoutName, e.score_auto, e.score_teleop, e.total_score, e.climb, e.defense_rating, e.robotTipped ? "Yes" : "No", e.robotDead ? "Yes" : "No", pst(e.submittedAt)]),
    ),
    ...csvSection(
        "PIT SCOUTING DATA",
        ["Team Number", "Scout Name", "Scout ID", "Submitted At (PST)", "Responses (multi-line JSON) "],
        pits.map((e) => [e.teamNumber, e.scoutName, e.scoutId, pst(e.submittedAt), JSON.stringify(e.responses || {}, null, 2)]),
    ),
    ...csvSection(
        "SUBJECTIVE SCOUTING DATA",
        ["Match ID", "Team Number", "Scout Name", "Submitted At (PST)", "Subjective Summary (multi-line)"],
        subjectives.map((e) => [e.matchId, e.teamNumber, e.scoutName, pst(e.submittedAt), [
            "=== Section 1: Robot Performance & Strategy ===",
            `Autonomous Effectiveness: ${e.robotPerformance.autonomousEffectiveness || ""}`,
            `Can Quickly Score: ${e.robotPerformance.canQuicklyScore || ""}`,
            `Can Climb: ${e.robotPerformance.canClimb || ""}`,
            ...(e.robotPerformance.climbLevel ? [`Climb Level: ${e.robotPerformance.climbLevel}`] : []),
            "",
            "=== Section 2: Team Dynamics ===",
            `Performance Under Pressure: ${e.teamDynamics.performanceUnderPressure || ""}`,
            `Team Focus: ${e.teamDynamics.teamFocus || ""}`,
            `Driver Synchronization: ${e.teamDynamics.driverSynchronization || ""}`,
            "",
            "=== Section 3: Tactical Insights ===",
            `Defensive Strategy: ${e.tacticalInsights.defensiveStrategy || ""}`,
            `Blocking Effectiveness: ${e.tacticalInsights.blockingEffectiveness || ""}`,
            `Ally Cooperation: ${e.tacticalInsights.allyCooperation || ""}`,
        ].join("\n")]),
    ),
].join("\r\n");
