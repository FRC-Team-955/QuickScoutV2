import {
  ref,
  push,
  set,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
  get,
  limitToFirst,
  serverTimestamp,
  onDisconnect,
  DatabaseReference,
} from "firebase/database";
import { db } from "@/lib/firebase";
import { slugifyName } from "@/lib/utils";

export type QueueEntry = {
  id?: string;
  userId: string;
  name: string;
  joinedAt?: any;
};

export const setUserPresence = async (user: {
  id: string;
  name: string;
  email?: string;
}) => {
  try {
    const userRef = ref(db, `users/${user.id}`);
    await set(userRef, {
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
    const userRef = ref(db, `users/${userId}`);
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

/**
 * Try to remove only the lastActive field for a user (best-effort, silent failures).
 */
export const removeUserLastActive = async (userId: string) => {
  try {
    await remove(ref(db, `users/${userId}/lastActive`));
  } catch (err) {
    // ignore - caller will handle fallback/logging
    console.debug("removeUserLastActive failed", err);
  }
};

export const joinQueue = async (user: { id: string; name: string }) => {
  try {
    const q = query(ref(db, "queue"), orderByChild("userId"), equalTo(user.id));
    const snap = await get(q);
    if (snap.exists()) return;
    const byName = query(
      ref(db, "queue"),
      orderByChild("name"),
      equalTo(user.name),
    );
    const snapByName = await get(byName);
    snapByName.forEach((child) => {
      if (child.val()?.userId && child.val().userId !== user.id) {
        remove(ref(db, `queue/${child.key}`)).catch(console.error);
      }
    });

    const pushed = await push(ref(db, "queue"), {
      userId: user.id,
      name: user.name,
      joinedAt: serverTimestamp(),
    });
    try {
      await onDisconnect(ref(db, `queue/${pushed.key}`)).remove();
    } catch (err) {
      console.warn("onDisconnect for queue entry failed:", err);
    }

    return pushed.key;
  } catch (err) {
    console.error("joinQueue error", err);
    throw err;
  }
};

export const leaveQueue = async (userId: string) => {
  try {
    const q = query(ref(db, "queue"), orderByChild("userId"), equalTo(userId));
    const snap = await get(q);
    const removes: Promise<void>[] = [];
    snap.forEach((child) => {
      removes.push(remove(ref(db, `queue/${child.key}`)));
    });
    await Promise.all(removes);
  } catch (err) {
    console.error("leaveQueue error", err);
    throw err;
  }
};

export const subscribeToQueue = (cb: (entries: QueueEntry[]) => void) => {
  const q = query(ref(db, "queue"), orderByChild("joinedAt"));
  const unsub = onValue(q, (snap) => {
    const entries: QueueEntry[] = [];
    snap.forEach((child) => {
      entries.push({ id: child.key || undefined, ...(child.val() as any) });
    });
    // ensure order by joinedAt (RTDB query already orders but ensure numeric sort)
    entries.sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
    cb(entries);
  });
  return unsub;
};

export const getTopN = async (n = 6) => {
  const q = query(ref(db, "queue"), orderByChild("joinedAt"), limitToFirst(n));
  const snap = await get(q);
  const out: QueueEntry[] = [];
  snap.forEach((child) => {
    out.push({ id: child.key, ...(child.val() as any) });
  });
  return out;
};

/**
 * Generate a readable, collision-resistant local id for a name.
 * Format: local:alice-smith or local:alice-smith-7xkq
 */
export const getOrCreateLocalId = async (name: string) => {
  const base = `local:${slugifyName(name)}`;
  let candidate = base;
  let attempt = 0;
  // try to reuse existing entry with same name
  while (true) {
    const snap = await get(ref(db, `users/${candidate}`));
    if (!snap.exists()) {
      return candidate;
    }
    const data = snap.val();
    if (data?.name === name) return candidate; // reuse

    // collision with different name -> append short suffix
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 6) return `${base}-${Date.now().toString(36)}`;
  }
};

/**
 * Find an unused ID in the range A1..A25 and return it.
 * Returns null if none available.
 * This is intended for local / fallback users only (client-side IDs).
 */
export const isNameInUse = async (
  name: string,
  excludeUserId?: string,
  graceMs = 2 * 60 * 1000,
): Promise<{ userId: string; lastActive: number | null } | null> => {
  // Find any /users entry with this name that appears "active".
  // Active = lastActive within graceMs OR no lastActive timestamp present.
  const q = query(ref(db, "users"), orderByChild("name"), equalTo(name));
  const snap = await get(q);
  let found: { userId: string; lastActive: number | null } | null = null;
  const now = Date.now();
  snap.forEach((child) => {
    const key = child.key;
    if (!key || (excludeUserId && key === excludeUserId)) return;
    const val = child.val() as any;
    const la =
      typeof val?.lastActive === "number" ? Number(val.lastActive) : null;
    if (la === null) {
      // no timestamp — treat as active
      found = { userId: key, lastActive: null };
      return;
    }
    if (now - la <= graceMs) {
      found = { userId: key, lastActive: la };
      return;
    }
  });
  return found;
};

/**
 * Find an unused ID in the range A1..A25 and return it.
 * Returns null if none available.
 * This is intended for local / fallback users only (client-side IDs).
 */
export const getAvailableAId = async (): Promise<string | null> => {
  const usersSnap = await get(ref(db, `users`));
  const used = new Set<string>();
  usersSnap.forEach((c) => {
    const k = c.key;
    if (typeof k === "string" && /^A(?:[1-9]|1\d|2[0-5])$/.test(k)) used.add(k);
  });

  for (let i = 1; i <= 25; i++) {
    const candidate = `A${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
};

/**
 * Allocate an A# id and create a users/{id} node atomically (best-effort client-side).
 * Returns the allocated id (or null if allocation failed).
 */
export const allocateAId = async (name: string) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = (await getAvailableAId()) || null;
    if (!candidate) return null;
    const snap = await get(ref(db, `users/${candidate}`));
    if (snap.exists()) {
      // race — try again
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
      continue;
    }

    // create the user node
    try {
      await set(ref(db, `users/${candidate}`), {
        id: candidate,
        name,
        email: null,
        lastActive: serverTimestamp(),
        source: "local",
      });
      return candidate;
    } catch (err) {
      console.warn("allocateAId set failed, retrying", err);
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  return null;
};

/**
 * Migrate a user's DB records from oldId -> newId (users node + queue entries).
 * If newId already has data, entries for oldId will be moved and removed.
 */
export const migrateUserId = async (
  oldId: string,
  newId: string,
  name?: string,
) => {
  if (!oldId || !newId || oldId === newId) return;
  try {
    const oldUserSnap = await get(ref(db, `users/${oldId}`));
    if (oldUserSnap.exists()) {
      const oldData = oldUserSnap.val();
      await set(ref(db, `users/${newId}`), {
        ...oldData,
        id: newId,
        name: name || oldData.name,
      });
      await remove(ref(db, `users/${oldId}`));
    }

    // move queue entries
    const q = query(ref(db, "queue"), orderByChild("userId"), equalTo(oldId));
    const snap = await get(q);
    const ops: Promise<any>[] = [];
    snap.forEach((child) => {
      const data = child.val();
      data.userId = newId;
      if (name) data.name = name;
      ops.push(set(ref(db, `queue/${child.key}`), data));
    });
    await Promise.all(ops);

    // remove any duplicate-name entries that belong to other ids
    if (name) {
      const byName = query(
        ref(db, "queue"),
        orderByChild("name"),
        equalTo(name),
      );
      const byNameSnap = await get(byName);
      byNameSnap.forEach((child) => {
        const val = child.val();
        if (val?.userId && val.userId !== newId) {
          remove(ref(db, `queue/${child.key}`)).catch(console.error);
        }
      });
    }
  } catch (err) {
    console.error("migrateUserId error", err);
    throw err;
  }
};

/** Return the entire queue ordered by joinedAt */
export const getAllQueue = async (): Promise<QueueEntry[]> => {
  const q = query(ref(db, "queue"), orderByChild("joinedAt"));
  const snap = await get(q);
  const out: QueueEntry[] = [];
  snap.forEach((child) => {
    out.push({ id: child.key, ...(child.val() as any) });
  });
  out.sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
  return out;
};

export const startMatch = async (
  lead: { id: string; name: string },
  teamAssignments?: Array<string | number | null>,
) => {
  try {
    // enforce single active match: fail fast if another active match exists
    const active = await getActiveMatch();
    if (active) throw new Error("Another match is already running");

    // include the entire queue when starting a match
    const all = await getAllQueue();
    if (all.length === 0) throw new Error("No users in queue");

    // build participants — attach assignedTeam for the first up-to-6 entries when provided
    const participants = all.map((t, idx) => {
      const assigned =
        Array.isArray(teamAssignments) && idx < (teamAssignments || []).length
          ? teamAssignments![idx]
          : null;
      return {
        userId: t.userId,
        name: t.name,
        assignedTeam: assigned != null ? String(assigned) : null,
      };
    });

    const matchesRef = ref(db, "matches");
    const matchRef = await push(matchesRef);
    await set(ref(db, `matches/${matchRef.key}`), {
      startedBy: lead.id,
      startedByName: lead.name,
      participants,
      startedAt: serverTimestamp(),
      status: "active",
    });

    // persist per-user currentAssignment for those assigned (first 6)
    const ops: Promise<any>[] = [];
    const maxAssign = Math.min(
      6,
      all.length,
      Array.isArray(teamAssignments) ? teamAssignments.length : 0,
    );
    for (let i = 0; i < maxAssign; i++) {
      const user = all[i];
      const team = teamAssignments![i];
      if (team != null) {
        ops.push(
          set(ref(db, `users/${user.userId}/currentAssignment`), {
            matchId: matchRef.key,
            teamNumber: String(team),
            assignedAt: serverTimestamp(),
          }),
        );
      }
    }

    // apply per-user assignment writes (fire-and-forget but await to fail early)
    if (ops.length) await Promise.all(ops);

    // remove all participants from queue
    await Promise.all(all.map((t) => leaveQueue(t.userId)));

    return matchRef.key;
  } catch (err) {
    console.error("startMatch error", err);
    throw err;
  }
};

/**
 * Return the currently active match (first match with status === 'active') or null.
 */
export const getActiveMatch = async () => {
  try {
    const snap = await get(ref(db, `matches`));
    let found: any = null;
    snap.forEach((child) => {
      const v = child.val();
      if (v?.status === "active") {
        found = { id: child.key, ...v };
        return true; // stop iteration
      }
    });
    return found;
  } catch (err) {
    console.error("getActiveMatch error", err);
    return null;
  }
};

/**
 * Subscribe to the active match (invokes cb with match object or null). Returns unsubscribe.
 */
export const subscribeToActiveMatch = (cb: (m: any | null) => void) => {
  const r = ref(db, `matches`);
  const unsub = onValue(r, (snap) => {
    let found: any = null;
    snap.forEach((child) => {
      const v = child.val();
      if (v?.status === "active") {
        found = { id: child.key, ...v };
        return true;
      }
    });
    cb(found);
  });
  return () => unsub();
};

/**
 * End an active match: mark status/endedAt and clear users' currentAssignment for that match.
 */
export const endMatch = async (
  matchId: string,
  endedBy?: { id: string; name?: string },
) => {
  if (!matchId) throw new Error("matchId required");
  try {
    const matchSnap = await get(ref(db, `matches/${matchId}`));
    if (!matchSnap.exists()) throw new Error("Match not found");
    const match = matchSnap.val();
    if (match.status !== "active") return;

    // mark match ended
    await set(ref(db, `matches/${matchId}/status`), "ended");
    await set(ref(db, `matches/${matchId}/endedAt`), serverTimestamp());
    if (endedBy?.id)
      await set(ref(db, `matches/${matchId}/endedBy`), endedBy.id);

    // clear per-user currentAssignment where it matches this match
    const participantsObj = match.participants || {};
    const ops: Promise<any>[] = [];
    Object.entries(participantsObj).forEach(([userId, p]: [string, any]) => {
      ops.push(
        get(ref(db, `users/${userId}/currentAssignment`)).then((snap) => {
          if (!snap.exists()) return;
          const val = snap.val();
          if (String(val.matchId) === String(matchId)) {
            return remove(ref(db, `users/${userId}/currentAssignment`)).catch(
              console.warn,
            );
          }
        }),
      );
    });

    await Promise.all(ops);
  } catch (err) {
    console.error("endMatch error", err);
    throw err;
  }
};

/**
 * Remove any queue entries that match `name` but belong to other userIds.
 * Useful when a user logs in and we want to avoid duplicate-name entries.
 */
export const cleanupDuplicateNames = async (userId: string, name: string) => {
  try {
    const q = query(ref(db, "queue"), orderByChild("name"), equalTo(name));
    const snap = await get(q);
    const removes: Promise<void>[] = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val?.userId && val.userId !== userId) {
        removes.push(remove(ref(db, `queue/${child.key}`)));
      }
    });
    await Promise.all(removes);
  } catch (err) {
    console.error("cleanupDuplicateNames error", err);
    throw err;
  }
};

/**
 * Remove a user node and any of their queue entries (used on logout)
 */
export const removeUserCompletely = async (userId: string) => {
  try {
    await remove(ref(db, `users/${userId}`));
    const q = query(ref(db, "queue"), orderByChild("userId"), equalTo(userId));
    const snap = await get(q);
    const removes: Promise<void>[] = [];
    snap.forEach((child) => {
      removes.push(remove(ref(db, `queue/${child.key}`)));
    });
    await Promise.all(removes);
  } catch (err) {
    console.error("removeUserCompletely error", err);
    throw err;
  }
};

export type CurrentAssignment = {
  matchId: string;
  teamNumber: string;
  assignedAt?: number | null;
};

/**
 * Subscribe to /users/{userId}/currentAssignment and invoke callback with the value (or null).
 * Returns an unsubscribe function.
 */
export const subscribeToUserAssignment = (
  userId: string,
  cb: (a: CurrentAssignment | null) => void,
) => {
  const r = ref(db, `users/${userId}/currentAssignment`);
  const unsub = onValue(r, (snap) => {
    if (!snap.exists()) return cb(null);
    const val = snap.val();
    const assignedAt =
      typeof val.assignedAt === "number" ? Number(val.assignedAt) : null;
    cb({
      matchId: String(val.matchId),
      teamNumber: String(val.teamNumber),
      assignedAt,
    });
  });
  return () => unsub();
};


export const cleanupStaleUsers = async (
  maxAgeMs = 10 * 60 * 1000 // 10 minutes
) => {
  try {
    const usersSnap = await get(ref(db, "users"));
    if (!usersSnap.exists()) return;

    const now = Date.now();
    const ops: Promise<any>[] = [];

    usersSnap.forEach((child) => {
      const userId = child.key!;
      const val = child.val();
      const lastActive =
        typeof val?.lastActive === "number" ? val.lastActive : null;

      if (!lastActive || now - lastActive > maxAgeMs) {
        // remove user
        ops.push(remove(ref(db, `users/${userId}`)));

        // remove queue entries
        ops.push(
          get(
            query(ref(db, "queue"), orderByChild("userId"), equalTo(userId))
          ).then((snap) => {
            const removes: Promise<void>[] = [];
            snap.forEach((c) => {
              removes.push(remove(ref(db, `queue/${c.key}`)));
            });
            return Promise.all(removes);
          })
        );
      }
    });

    await Promise.all(ops);
  } catch (err) {
    console.error("cleanupStaleUsers error", err);
  }
};


