import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueueEntry } from "@/lib/queue";
import {
  subscribeToQueue,
  joinQueue,
  leaveQueue,
  startMatch,
  subscribeToActiveMatch,
  endMatch,
  signalMatchEnd,
} from "@/lib/queue";

type CurrentUser = { id: string; name: string } | null;
type Unsub = () => void;

const needId = (matchId: string) => {
  if (!matchId) throw new Error("matchId required");
};

// Shared by useQueue and useSubjectiveQueue; `api` is one flow's functions from @/lib/queue.
export const useQueueFlow = (
  currentUser: CurrentUser,
  api: {
    subscribeQueue: (cb: (e: QueueEntry[]) => void) => Unsub;
    subscribeActive: (cb: (m: any) => void) => Unsub;
    join: (u: { id: string; name: string }) => Promise<unknown>;
    leave: (userId: string) => Promise<unknown>;
    start: (lead: { id: string; name: string }, teams?: Array<string | number | null>) => Promise<string>;
    end: (matchId: string, by: { id: string; name: string }) => Promise<unknown>;
    signal: (matchId: string, by: { id: string; name: string }) => Promise<unknown>;
  },
) => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);

  useEffect(() => api.subscribeQueue(setQueue), [api]);
  useEffect(() => api.subscribeActive(setActiveMatch), [api]);

  const topSix = useMemo(() => queue.slice(0, 6), [queue]);
  const isInQueue = !!currentUser && queue.some((q) => q.userId === currentUser.id);
  const isInTopSix = !!currentUser && topSix.some((q) => q.userId === currentUser.id);

  // Runs fn(user) with the loading flag set; rejects if signed out.
  // Keyed on id/name so callers passing a fresh {id, name} literal each render get stable callbacks.
  const id = currentUser?.id;
  const name = currentUser?.name;
  const run = useCallback(
    async <T,>(fn: (u: { id: string; name: string }) => Promise<T>) => {
      if (!id) throw new Error("Not authenticated");
      setLoading(true);
      try {
        return await fn({ id, name });
      } finally {
        setLoading(false);
      }
    },
    [id, name],
  );
  return {
    queue,
    loading,
    join: useCallback(() => run(async (u) => void (await api.join(u))), [run, api]),
    leave: useCallback(() => run(async (u) => void (await api.leave(u.id))), [run, api]),
    start: useCallback((teams?: Array<string | number | null>) => run((u) => api.start(u, teams)), [run, api]),
    endMatch: useCallback(
      (matchId: string) => run((u) => (needId(matchId), api.end(matchId, u))),
      [run, api],
    ),
    signalMatchEnd: useCallback(
      (matchId: string) => run((u) => (needId(matchId), api.signal(matchId, u))),
      [run, api],
    ),
    activeMatch,
    isInQueue,
    isInTopSix,
    topSix,
  };
};

const objectiveApi = {
  subscribeQueue: subscribeToQueue,
  subscribeActive: subscribeToActiveMatch,
  join: joinQueue,
  leave: leaveQueue,
  start: startMatch,
  end: endMatch,
  signal: signalMatchEnd,
};

export const useQueue = (currentUser: CurrentUser) => useQueueFlow(currentUser, objectiveApi);
