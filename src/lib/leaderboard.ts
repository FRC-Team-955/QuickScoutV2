import {type EventKey, filterByEventType} from "@/lib/dateUtils";

export type LeaderboardRow = {
    key: string;
    scoutName: string;
    matches: number;
    lastSubmitted: number;
    submittedAt: number;
};

export type Boards = Record<EventKey, LeaderboardRow[]>;

type Submission = { scoutName: string; submittedAt: number };

/**
 * Group submitted participant entries from `matches` and `subjectiveMatches` by lowercased scout name.
 * Numeric participant keys are the pre-submission participants[] array and are skipped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const collectSubmissions = (matchesData: any, subjectiveData: any): Map<string, Submission[]> => {
    const submissions = new Map<string, Submission[]>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const add = (participantsRoot: any, objective: boolean) => {
        if (!participantsRoot || typeof participantsRoot !== "object") return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(participantsRoot).forEach(([participantId, d]: [string, any]) => {
            if (/^\d+$/.test(participantId) || !d) return;
            if (objective && !(d.teamNumber != null || d.submittedAt != null || d.autonomous || d.teleop || d.endGame)) return;
            const scoutName = String((objective ? d.scoutName || d.name : d.scoutName) || "").trim();
            if (!scoutName) return;
            const key = scoutName.toLowerCase();
            const submittedAt = Number(d.submittedAt) || 0;
            submissions.set(key, [...(submissions.get(key) ?? []), {scoutName, submittedAt}]);
        });
    };
    // Objective matches fall back to the match node itself for legacy data without `participants`
    Object.values(matchesData ?? {}).forEach((m: any) => add(m?.participants || m, true)); // eslint-disable-line @typescript-eslint/no-explicit-any
    Object.values(subjectiveData ?? {}).forEach((m: any) => add(m?.participants, false)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return submissions;
};

/** Per-event boards, ranked by matches desc then most recent submission */
export const buildBoards = (submissions: Map<string, Submission[]>): Boards => {
    const boards: Boards = {osf: [], clack: [], dcmp: [], girlsgen: [], current: []};
    submissions.forEach((subList, key) => {
        const scoutName = subList[0]?.scoutName || "";
        Object.entries(filterByEventType(subList)).forEach(([event, subs]) => {
            if (subs.length === 0) return;
            const lastSubmitted = Math.max(...subs.map((s) => s.submittedAt));
            boards[event as keyof Boards].push({key, scoutName, matches: subs.length, lastSubmitted, submittedAt: lastSubmitted});
        });
    });
    Object.values(boards).forEach((rows) => rows.sort((a, b) => b.matches - a.matches || b.lastSubmitted - a.lastSubmitted));
    return boards;
};
