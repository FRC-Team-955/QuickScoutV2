import {
    equalTo,
    get,
    limitToFirst,
    onDisconnect,
    onValue,
    orderByChild,
    push,
    query,
    ref,
    remove,
    serverTimestamp,
    set,
    update,
} from "firebase/database";
import {db} from "@/lib/firebase";
import {STATIONS} from "@/pages/scouting/logic";

export type QueueEntry = {
    id?: string;
    userId: string;
    name: string;
    joinedAt?: any;
};

export type CurrentAssignment = {
    matchId: string;
    teamNumber: string;
    assignedAt?: number | null;
    station?: string | null; // "Red 1".."Blue 3"; absent on assignments made before this field existed
};
export type CurrentSubjectiveAssignment = CurrentAssignment;

type User = { id: string; name?: string };
type TeamAssignments = Array<string | number | null>;

// The objective and subjective flows share one implementation; these are their real differences.
type Flow = {
    queue: string;
    matches: string;
    assignment: string; // field under users/{id}
    label: string; // used in error messages
    limit: number; // both flows take the top 6 (the lead can only assign 6 teams)
    keyed: boolean; // participants stored as array (objective) or object keyed by userId (subjective)
};
const OBJECTIVE: Flow = {queue: "queue", matches: "matches", assignment: "currentAssignment", label: "", limit: 6, keyed: false};
const SUBJECTIVE: Flow = {queue: "subjectiveQueue", matches: "subjectiveMatches", assignment: "currentSubjectiveAssignment", label: "subjective ", limit: 6, keyed: true};

// ---------- presence ----------

export const setUserPresence = async (user: { id: string; name: string; email?: string }) => {
    try {
        // update, not set: a reload mid-match must not wipe currentAssignment / currentSubjectiveAssignment
        await update(ref(db, `users/${user.id}`), {
            id: user.id,
            name: user.name,
            email: user.email || null,
            lastActive: serverTimestamp(),
            source: user.email ? "firebase" : "local",
        });
    } catch (err) {
        console.error("setUserPresence error", err);
    }
};

export const clearUserPresence = async (userId: string) => {
    try {
        await set(ref(db, `users/${userId}/lastActive`), serverTimestamp());
    } catch (err) {
        console.error("clearUserPresence error", err);
    }
};

// --- unload suppression (client-side only) ---
let _suppressPresenceOnUnload = false;
export const setSuppressPresenceOnUnload = (v: boolean) => {
    _suppressPresenceOnUnload = !!v;
};
export const shouldSuppressPresenceOnUnload = () => _suppressPresenceOnUnload;

/** Try to remove only the lastActive field for a user (best-effort, silent failures). */
export const removeUserLastActive = async (userId: string) => {
    try {
        await remove(ref(db, `users/${userId}/lastActive`));
    } catch (err) {
        console.debug("removeUserLastActive failed", err);
    }
};

/** Remove a user node and any of their queue entries (used on logout) */
export const removeUserCompletely = async (userId: string) => {
    await remove(ref(db, `users/${userId}`));
    await removeQueueEntries(OBJECTIVE.queue, "userId", userId, () => true);
};

// ---------- shared helpers ----------

const removeQueueEntries = async (
    queuePath: string,
    field: "userId" | "name",
    value: string,
    keep: (v: any) => boolean,
) => {
    const snap = await get(query(ref(db, queuePath), orderByChild(field), equalTo(value)));
    const removes: Promise<void>[] = [];
    snap.forEach((c) => {
        if (keep(c.val())) removes.push(remove(ref(db, `${queuePath}/${c.key}`)));
    });
    await Promise.all(removes);
};

const toEntries = (snap: any): QueueEntry[] => {
    const out: QueueEntry[] = [];
    snap.forEach((c: any) => {
        out.push({id: c.key || undefined, ...c.val()});
    });
    // RTDB already orders by joinedAt, but ensure a numeric sort
    return out.sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
};

const findActive = (snap: any) => {
    let found: any = null;
    snap.forEach((c: any) => {
        const v = c.val();
        if (v?.status === "active") {
            found = {id: c.key, ...v};
            return true;
        }
    });
    return found;
};

// Dedupe concurrent joins from the same client (double-tap) — the read-then-push below is not atomic.
// ponytail: cross-device duplicates still possible; a transaction would need a queue keyed by userId.
const pendingJoins = new Map<string, Promise<string | undefined>>();

const join = (f: Flow, user: { id: string; name: string }) => {
    const k = `${f.queue}/${user.id}`;
    if (!pendingJoins.has(k)) {
        pendingJoins.set(k, doJoin(f, user).finally(() => pendingJoins.delete(k)));
    }
    return pendingJoins.get(k)!;
};

const doJoin = async (f: Flow, user: { id: string; name: string }) => {
    const existing = await get(query(ref(db, f.queue), orderByChild("userId"), equalTo(user.id)));
    if (existing.exists()) return undefined;
    await removeQueueEntries(f.queue, "name", user.name, (v) => v?.userId && v.userId !== user.id).catch(
        console.error,
    );
    const pushed = await push(ref(db, f.queue), {userId: user.id, name: user.name, joinedAt: serverTimestamp()});
    try {
        await onDisconnect(ref(db, `${f.queue}/${pushed.key}`)).remove();
    } catch (err) {
        console.warn("onDisconnect for queue entry failed:", err);
    }
    return pushed.key;
};

const leave = async (f: Flow, userId: string) => {
    await removeQueueEntries(f.queue, "userId", userId, () => true);
    await remove(ref(db, `users/${userId}/${f.assignment}`)).catch(() => {});
};

const subscribeQueue = (f: Flow, cb: (entries: QueueEntry[]) => void) =>
    onValue(query(ref(db, f.queue), orderByChild("joinedAt")), (snap) => cb(toEntries(snap)));

const subscribeActive = (f: Flow, cb: (m: any | null) => void) =>
    onValue(ref(db, f.matches), (snap) => cb(findActive(snap)));

const start = async (f: Flow, lead: { id: string; name: string }, teamAssignments?: TeamAssignments) => {
    if (findActive(await get(ref(db, f.matches)))) {
        throw new Error(`Another ${f.label}match is already running`);
    }
    const q = query(ref(db, f.queue), orderByChild("joinedAt"));
    const entries = toEntries(await get(query(q, limitToFirst(f.limit))));
    if (entries.length === 0) throw new Error(`No users in ${f.label}queue`);

    const team = (i: number) => teamAssignments?.[i] ?? null;
    const roster = entries.map((t, i) => ({
        userId: t.userId,
        name: t.name,
        assignedTeam: team(i) != null ? String(team(i)) : null,
        station: STATIONS[i] ?? null,
    }));
    const participants = f.keyed ? Object.fromEntries(roster.map((p) => [p.userId, p])) : roster;

    const matchRef = await push(ref(db, f.matches), {
        startedBy: lead.id,
        startedByName: lead.name,
        participants,
        startedAt: serverTimestamp(),
        status: "active",
    });

    await Promise.all(
        entries.flatMap((u, i) =>
            team(i) == null
                ? []
                : set(ref(db, `users/${u.userId}/${f.assignment}`), {
                      matchId: matchRef.key,
                      teamNumber: String(team(i)),
                      station: STATIONS[i] ?? null,
                      assignedAt: serverTimestamp(),
                  }),
        ),
    );

    // remove only the participants from the queue (not everyone)
    await Promise.all(entries.map((t) => removeQueueEntries(f.queue, "userId", t.userId, () => true)));
    return matchRef.key;
};

/** Load an active match, or return null if it has already ended. Throws if missing. */
const loadActive = async (f: Flow, matchId: string) => {
    if (!matchId) throw new Error("matchId required");
    const snap = await get(ref(db, `${f.matches}/${matchId}`));
    if (!snap.exists()) throw new Error("Match not found");
    const match = snap.val();
    return match.status === "active" ? match : null;
};

const end = async (f: Flow, matchId: string, endedBy?: User) => {
    const match = await loadActive(f, matchId);
    if (!match) return;

    await update(ref(db, `${f.matches}/${matchId}`), {
        status: "ended",
        endedAt: serverTimestamp(),
        ...(endedBy?.id && {endedBy: endedBy.id}),
    });

    // Objective participants are an array (keys "0".."5") plus submissions keyed by userId,
    // so take the userId from the entry rather than the key.
    const userIds = new Set(Object.entries(match.participants || {}).map(([k, p]: [string, any]) => p?.userId ?? k));
    await Promise.all(
        [...userIds].map(async (userId) => {
            const r = ref(db, `users/${userId}/${f.assignment}`);
            const snap = await get(r);
            if (snap.exists() && String(snap.val().matchId) === String(matchId)) {
                await remove(r).catch(console.warn);
            }
        }),
    );
};

/** Mark that the lead has signaled end (but don't actually end the match). */
const signal = async (f: Flow, matchId: string, signalledBy?: User) => {
    if (!(await loadActive(f, matchId))) return;
    await update(ref(db, `${f.matches}/${matchId}`), {
        leadSignaledEnd: true,
        leadSignaledAt: serverTimestamp(),
        ...(signalledBy?.id && {leadSignaledBy: signalledBy.id}),
    });
};

const subscribeAssignment = (f: Flow, userId: string, cb: (a: CurrentAssignment | null) => void) =>
    onValue(ref(db, `users/${userId}/${f.assignment}`), (snap) => {
        if (!snap.exists()) return cb(null);
        const val = snap.val();
        cb({
            matchId: String(val.matchId),
            teamNumber: String(val.teamNumber),
            assignedAt: typeof val.assignedAt === "number" ? val.assignedAt : null,
            station: val.station ?? null,
        });
    });

// ---------- objective (match) scouting ----------

export const joinQueue = (user: { id: string; name: string }) => join(OBJECTIVE, user);
export const leaveQueue = (userId: string) => leave(OBJECTIVE, userId);
export const subscribeToQueue = (cb: (entries: QueueEntry[]) => void) => subscribeQueue(OBJECTIVE, cb);
export const startMatch = (lead: { id: string; name: string }, teamAssignments?: TeamAssignments) =>
    start(OBJECTIVE, lead, teamAssignments);
export const subscribeToActiveMatch = (cb: (m: any | null) => void) => subscribeActive(OBJECTIVE, cb);
export const endMatch = (matchId: string, endedBy?: User) => end(OBJECTIVE, matchId, endedBy);
export const subscribeToUserAssignment = (userId: string, cb: (a: CurrentAssignment | null) => void) =>
    subscribeAssignment(OBJECTIVE, userId, cb);

export const signalMatchEnd = (matchId: string, signalledBy?: User) => signal(OBJECTIVE, matchId, signalledBy);

// ---------- subjective scouting ----------

export const joinSubjectiveQueue = (user: { id: string; name: string }) => join(SUBJECTIVE, user);
export const leaveSubjectiveQueue = (userId: string) => leave(SUBJECTIVE, userId);
export const subscribeToSubjectiveQueue = (cb: (entries: QueueEntry[]) => void) => subscribeQueue(SUBJECTIVE, cb);
export const startSubjectiveMatch = (lead: { id: string; name: string }, teamAssignments?: TeamAssignments) =>
    start(SUBJECTIVE, lead, teamAssignments);
export const subscribeToActiveSubjectiveMatch = (cb: (m: any | null) => void) => subscribeActive(SUBJECTIVE, cb);
export const endSubjectiveMatch = (matchId: string, endedBy?: User) => end(SUBJECTIVE, matchId, endedBy);
export const signalSubjectiveMatchEnd = (matchId: string, signalledBy?: User) => signal(SUBJECTIVE, matchId, signalledBy);
export const subscribeToUserSubjectiveAssignment = (
    userId: string,
    cb: (a: CurrentSubjectiveAssignment | null) => void,
) => subscribeAssignment(SUBJECTIVE, userId, cb);
