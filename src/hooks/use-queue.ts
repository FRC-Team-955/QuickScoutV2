import { useEffect, useMemo, useState, useCallback } from "react";
import type { QueueEntry } from "@/lib/queue";
import {
  subscribeToQueue,
  joinQueue as apiJoin,
  leaveQueue as apiLeave,
  getTopN,
  startMatch as apiStartMatch,
  subscribeToActiveMatch as apiSubscribeToActiveMatch,
  endMatch as apiEndMatch,
  signalMatchEnd as apiSignalMatchEnd,
} from "@/lib/queue";

export const useQueue = (currentUser: { id: string; name: string } | null) => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);

  useEffect(() => {
    const unsub = subscribeToQueue((entries) => setQueue(entries));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = apiSubscribeToActiveMatch((m) => setActiveMatch(m));
    return unsub;
  }, []);

  const isInQueue = useMemo(() => {
    if (!currentUser) return false;
    return queue.some((q) => q.userId === currentUser.id);
  }, [queue, currentUser]);

  const isInTopSix = useMemo(() => {
    if (!currentUser) return false;
    return queue.slice(0, 6).some((q) => q.userId === currentUser.id);
  }, [queue, currentUser]);

  const join = useCallback(async () => {
    if (!currentUser) throw new Error("Not authenticated");
    setLoading(true);
    try {
      await apiJoin({ id: currentUser.id, name: currentUser.name });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const leave = useCallback(async () => {
    if (!currentUser) throw new Error("Not authenticated");
    setLoading(true);
    try {
      await apiLeave(currentUser.id);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const start = useCallback(async (teamAssignments?: Array<string | number | null>) => {
    if (!currentUser) throw new Error("Not authenticated");
    setLoading(true);
    try {
      return await apiStartMatch({ id: currentUser.id, name: currentUser.name }, teamAssignments);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const endMatch = useCallback(async (matchId: string) => {
    if (!currentUser) throw new Error("Not authenticated");
    if (!matchId) throw new Error("matchId required");
    setLoading(true);
    try {
      return await apiEndMatch(matchId, { id: currentUser.id, name: currentUser.name });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const signalMatchEnd = useCallback(async (matchId: string) => {
    if (!currentUser) throw new Error("Not authenticated");
    if (!matchId) throw new Error("matchId required");
    setLoading(true);
    try {
      return await apiSignalMatchEnd(matchId, { id: currentUser.id, name: currentUser.name });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  return {
    queue,
    loading,
    join,
    leave,
    start,
    endMatch,
    signalMatchEnd,
    activeMatch,
    isInQueue,
    isInTopSix,
    topSix: queue.slice(0, 6),
  };
};
