import {useQueueFlow} from "@/hooks/use-queue";
import {
    endSubjectiveMatch,
    joinSubjectiveQueue,
    leaveSubjectiveQueue,
    signalSubjectiveMatchEnd,
    startSubjectiveMatch,
    subscribeToActiveSubjectiveMatch,
    subscribeToSubjectiveQueue,
} from "@/lib/queue";

const subjectiveApi = {
    subscribeQueue: subscribeToSubjectiveQueue,
    subscribeActive: subscribeToActiveSubjectiveMatch,
    join: joinSubjectiveQueue,
    leave: leaveSubjectiveQueue,
    start: startSubjectiveMatch,
    end: endSubjectiveMatch,
    signal: signalSubjectiveMatchEnd,
};

export const useSubjectiveQueue = (currentUser: { id: string; name: string } | null) =>
    useQueueFlow(currentUser, subjectiveApi);
