import {useCallback, useEffect, useMemo, useState} from "react";
import type {QueueEntry} from "@/lib/queue";
import {
    endSubjectiveMatch as apiEndSubjectiveMatch,
    joinSubjectiveQueue as apiJoinSubjective,
    leaveSubjectiveQueue as apiLeaveSubjective,
    startSubjectiveMatch as apiStartSubjectiveMatch,
    subscribeToActiveSubjectiveMatch as apiSubscribeToActiveSubjectiveMatch,
    subscribeToSubjectiveQueue,
} from "@/lib/queue";

interface ActiveMatch {
    id: string;

    [key: string]: unknown;
}

export const useSubjectiveQueue = (currentUser: { id: string; name: string } | null) => {
    const [queue, setQueue] = useState<QueueEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);

    useEffect(() => {
        const unsub = subscribeToSubjectiveQueue((entries) => setQueue(entries));
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = apiSubscribeToActiveSubjectiveMatch((m) => setActiveMatch(m));
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
            await apiJoinSubjective({id: currentUser.id, name: currentUser.name});
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const leave = useCallback(async () => {
        if (!currentUser) throw new Error("Not authenticated");
        setLoading(true);
        try {
            await apiLeaveSubjective(currentUser.id);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const start = useCallback(async (teamAssignments?: Array<string | number | null>) => {
        if (!currentUser) throw new Error("Not authenticated");
        setLoading(true);
        try {
            return await apiStartSubjectiveMatch({id: currentUser.id, name: currentUser.name}, teamAssignments);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const endMatch = useCallback(async (matchId: string) => {
        if (!currentUser) throw new Error("Not authenticated");
        if (!matchId) throw new Error("matchId required");
        setLoading(true);
        try {
            return await apiEndSubjectiveMatch(matchId, {id: currentUser.id, name: currentUser.name});
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
        activeMatch,
        isInQueue,
        isInTopSix,
        topSix: queue.slice(0, 6),
    };
};


