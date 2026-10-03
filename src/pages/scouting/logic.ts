// Pure helpers for Scouting.tsx: form shapes, RTDB payloads, drafts, participant roster, TBA import.

export type MatchForm = {
    teamNumber: string;
    autonomousNotes: string;
    autonomousFuel: number;
    autoClimb: string;
    teamNumberNotes: string;
    teleopNotes: string;
    teleopFuel: number;
    teleopClimb: string;
    endGameNotes: string;
    didClimb: boolean;
    climbLevel: string;
    defenseScore: string;
    sotm: string;
    robotTipped: string;
};

export type SubjectiveForm = {
    subjectiveTeamNumber: string;
    autonomousEffectiveness: string;
    canQuicklyScore: string;
    estimatedBPS: string;
    canClimb: string;
    climbTime: string;
    climbLevelSubjective: string;
    teamFocus: string;
    driverSynchronization: string;
    defensiveStrategy: string;
    blockingEffectiveness: string;
    allyCooperation: string;
    defensiveSkill: string;
    robotReliability: string;
    robotPenalties: string;
    autoFuel: string;
    autoClimb1: string;
    teleopPassing: string;
    gameSense: string;
    strengths: string;
    weaknesses: string;
};

export const EMPTY_MATCH: MatchForm = {
    teamNumber: "", autonomousNotes: "", autonomousFuel: 0, autoClimb: "", teamNumberNotes: "",
    teleopNotes: "", teleopFuel: 0, teleopClimb: "", endGameNotes: "", didClimb: false,
    climbLevel: "", defenseScore: "", sotm: "", robotTipped: "",
};

export const EMPTY_SUBJECTIVE: SubjectiveForm = {
    subjectiveTeamNumber: "", autonomousEffectiveness: "", canQuicklyScore: "", estimatedBPS: "",
    canClimb: "", climbTime: "", climbLevelSubjective: "", teamFocus: "", driverSynchronization: "",
    defensiveStrategy: "", blockingEffectiveness: "", allyCooperation: "", defensiveSkill: "",
    robotReliability: "", robotPenalties: "", autoFuel: "", autoClimb1: "", teleopPassing: "",
    gameSense: "", strengths: "", weaknesses: "",
};

type Submitter = { userId: string; scoutName: string; teamNumber: string; matchId: string; submittedAt: unknown };

// Shape written to matches/{id}/participants/{userId}; Analytics/Dashboard read these exact fields.
export const buildMatchPayload = (f: MatchForm, s: Submitter) => ({
    ...s,
    teamNumberNotes: f.teamNumberNotes,
    autonomous: {fuel: f.autonomousFuel, notes: f.autonomousNotes, autoClimb: f.autoClimb},
    teleop: {
        fuel: f.teleopFuel,
        notes: f.teleopNotes,
        teleopClimb: f.teleopClimb,
        climbLevel: f.teleopClimb === "yes" ? f.climbLevel : null,
        defenseScore: f.defenseScore,
    },
    endGame: {didClimb: f.didClimb, climbLevel: f.didClimb ? f.climbLevel : null, notes: f.endGameNotes},
    sotm: f.sotm,
    robotTipped: f.robotTipped,
});

// Shape written to subjectiveMatches/{id}/participants/{userId}.
export const buildSubjectivePayload = (f: SubjectiveForm, s: Submitter) => ({
    ...s,
    robotPerformance: {
        autonomousEffectiveness: f.autonomousEffectiveness,
        canQuicklyScore: f.canQuicklyScore,
        canClimb: f.canClimb,
        climbLevel: f.canClimb === "yes" ? f.climbLevelSubjective : null,
    },
    teamDynamics: {teamFocus: f.teamFocus, driverSynchronization: f.driverSynchronization},
    tacticalInsights: {
        defensiveStrategy: f.defensiveStrategy,
        blockingEffectiveness: f.blockingEffectiveness,
        allyCooperation: f.allyCooperation,
    },
    misc: {
        defensiveSkill: f.defensiveSkill,
        robotReliability: f.robotReliability,
        robotPenalties: f.robotPenalties,
        autoFuel: f.autoFuel,
        autoClimb: f.autoClimb1,
        teleopPassing: f.teleopPassing,
        gameSense: f.gameSense,
        strengths: f.strengths,
        weaknesses: f.weaknesses,
    },
});

export const matchDraftKey = (userId: string, matchId: string, team: string) =>
    `scout_draft_match:${userId}:${matchId}:${team}`;
export const subjectiveDraftKey = (userId: string, matchId: string, team: string) =>
    `scout_draft_subjective:${userId}:${matchId}:${team}`;

export const readDraft = <T>(key: string): Partial<T> | null => {
    try {
        return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
        return null;
    }
};

export const writeDraft = (key: string, data: object) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        console.warn("Failed to write draft to localStorage");
    }
};

export const removeDraft = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch {
        console.warn("Failed to remove draft from localStorage");
    }
};

export type RosterEntry = { key: string; userId?: string; name?: string; assignedTeam?: string | null; submitted: boolean };

// Objective matches store the roster as an array (keys "0".."5") and each submission under
// participants/{userId}; subjective matches key the roster by userId and the submission replaces it.
export const participantRoster = (participants: any): RosterEntry[] => {
    const entries = Object.entries(participants || {}).filter(([, p]) => p) as [string, any][];
    const indexed = entries.filter(([k]) => /^\d+$/.test(k));
    return (indexed.length ? indexed : entries).map(([key, p]) => ({
        key,
        userId: p.userId,
        name: p.name ?? p.scoutName,
        assignedTeam: p.assignedTeam ?? p.teamNumber,
        submitted: !!(p.submittedAt || participants[p.userId]?.submittedAt),
    }));
};

// True when nobody on the roster is still scouting (including an empty/missing roster).
export const allSubmitted = (participants: any) => participantRoster(participants).every((p) => p.submitted);

export const validAssignment = (s: string) => /^\d{1,5}$/.test(s);

// Red 1-3 then Blue 1-3 for qualification match `qualNum`; null if the match isn't found.
// Unparseable team keys (e.g. "frc254B") become "" so the other teams keep their stations.
export const qualTeams = (matches: any[], qualNum: number): string[] | null => {
    const match = matches.find((m) => Number((m.key || "").match(/_qm(\d+)/)?.[1]) === qualNum);
    if (!match) return null;
    const red = (match.alliances?.red?.team_keys || []).slice(0, 3);
    const blue = (match.alliances?.blue?.team_keys || []).slice(0, 3);
    const pad = (keys: string[]) => [0, 1, 2].map((i) => keys[i]?.replace(/^frc/, "") ?? "").map((n) => (/^\d+$/.test(n) ? n : ""));
    return [...pad(red), ...pad(blue)];
};

export const STATIONS = ["Red 1", "Red 2", "Red 3", "Blue 1", "Blue 2", "Blue 3"];

type Field = { key: keyof SubjectiveForm; id: string; label: string; placeholder: string };

// autoFuel, autoClimb1, defensiveStrategy and driverSynchronization have no input but are still submitted.
export const SUBJECTIVE_SECTIONS: { title: string; fields: Field[] }[] = [
    {
        title: "Robot Performance and Strategy",
        fields: [
            {key: "autonomousEffectiveness", id: "autonomous-effectiveness", label: "How effective is their robot during the Autonomous period?", placeholder: "e.g., Not Effective, Somewhat Effective, Very Effective"},
            {key: "canQuicklyScore", id: "quick-score", label: "Estimated fuels scored per cycle?", placeholder: "e.g., 1-3, 4-6, 8+"},
            {key: "estimatedBPS", id: "estimated-bps", label: "Estimated BPS (optional)?", placeholder: "e.g., 3-5 BPS, 1-2 BPS, or N/A"},
            {key: "canClimb", id: "can-climb", label: "Is their robot able to climb? If so, what level (L1, L2, L3)?", placeholder: "e.g., Yes - L1, No, or description"},
            {key: "climbTime", id: "climb-time", label: "Estimated time to climb?", placeholder: "e.g., <10s, 10-20s, >20s, or N/A"},
            {key: "climbLevelSubjective", id: "climb-level-subjective", label: "Climb Level (Subjective)?", placeholder: "e.g., L1, L2, L3, or N/A"},
        ],
    },
    {
        title: "Team Dynamics",
        fields: [
            {key: "teamFocus", id: "team-focus", label: "Do they focus on scoring, passing, defense, or a mix?", placeholder: "e.g., Scoring focused, Balanced mix, Defense oriented, Support oriented"},
        ],
    },
    {
        title: "Tactical Insights",
        fields: [
            {key: "blockingEffectiveness", id: "blocking-effectiveness", label: "How effectively can they block or disrupt scoring (if they defend)?", placeholder: "e.g., Very effective, Moderately effective, Ineffective"},
            {key: "defensiveSkill", id: "defensive-skill", label: "Do they seem experienced with playing defense?", placeholder: "e.g., Yes, No, A little"},
            {key: "allyCooperation", id: "ally-cooperation", label: "How well do they work their allies for combined strategies (constantly bumping or getting in their way)?", placeholder: "e.g., Great teamwork, Often interferes, Gets in the way"},
        ],
    },
    {
        title: "Misc",
        fields: [
            {key: "robotReliability", id: "robot-reliability", label: "Was the robot reliable during the entire match?", placeholder: "e.g., Dead, Stuck, Tipped"},
            {key: "robotPenalties", id: "robot-penalties", label: "Did they receive any penalties?", placeholder: "e.g., Red Card, Yellow Card"},
            {key: "teleopPassing", id: "teleop-passing", label: "Can they pass?", placeholder: "e.g., Yes, No, Sometimes"},
            {key: "gameSense", id: "game-sense", label: "Do you think they have game sense?", placeholder: "e.g., Yes, No, A little"},
            {key: "strengths", id: "strengths", label: "Team and Robot Strengths?", placeholder: "e.g., Shooting, Defense, Speed"},
            {key: "weaknesses", id: "weaknesses", label: "Team and Robot Weaknesses?", placeholder: "e.g., Bad intake, Can't shoot, Tank Drive"},
        ],
    },
];
