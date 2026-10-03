import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import Confetti from "react-confetti";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {navItems} from "@/components/nav";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/contexts/AuthContext";
import {Minus, Play, Plus} from "lucide-react";
import {useQueue} from "@/hooks/use-queue";
import {useSubjectiveQueue} from "@/hooks/use-subjective-queue";
import {
    type CurrentAssignment,
    type CurrentSubjectiveAssignment,
    subscribeToUserAssignment,
    subscribeToUserSubjectiveAssignment,
} from "@/lib/queue";
import {get, getDatabase, onValue, ref, remove, serverTimestamp, set,} from "firebase/database";
import successAudio from "/partyblower.mp3";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {toast} from "sonner";
import {TBA_EVENT_KEY, getEventMatches} from "@/lib/tba";
import {
    allSubmitted,
    buildMatchPayload,
    buildSubjectivePayload,
    EMPTY_MATCH,
    EMPTY_SUBJECTIVE,
    matchDraftKey,
    participantRoster,
    qualTeams,
    readDraft,
    removeDraft,
    STATIONS,
    SUBJECTIVE_SECTIONS,
    subjectiveDraftKey,
    validAssignment,
    writeDraft,
} from "@/pages/scouting/logic";

const EMPTY_TEAMS = ["", "", "", "", "", ""];
const FUEL_STEPS = [-1, 1, 3, 5, 10];

// Form state mirrored to localStorage under draftKey. Whenever draftKey changes to a new
// session, the form is reloaded from that session's draft (over `seed`).
const useDraftForm = <T extends object>(empty: T, draftKey: string | null, seed: Partial<T>) => {
    const [form, setForm] = useState(empty);
    const keyRef = useRef<string | null>(null);
    useEffect(() => {
        keyRef.current = draftKey;
        if (draftKey) setForm({...empty, ...seed, ...(readDraft<T>(draftKey) ?? {})});
    }, [draftKey]);
    useEffect(() => {
        if (keyRef.current) writeDraft(keyRef.current, form);
    }, [form]);
    const setField = <K extends keyof T>(k: K, v: T[K]) => setForm((f) => ({...f, [k]: v}));
    // Uses this render's draftKey: clearing the assignment may already have nulled keyRef.
    const finish = () => {
        if (draftKey) removeDraft(draftKey);
        keyRef.current = null;
        setForm(empty);
    };
    return {form, setForm, setField, finish};
};

const Section = ({title, description, children}: { title: ReactNode; description?: string; children?: ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
    </Card>
);

const Choice = ({value, onChange, options = ["yes", "no"], className = "flex gap-2"}: {
    value: string; onChange: (v: string) => void; options?: string[]; className?: string;
}) => (
    <div className={className}>
        {options.map((o) => (
            <Button key={o} variant={value === o ? "default" : "outline"} onClick={() => onChange(o)}>
                {o[0].toUpperCase() + o.slice(1)}
            </Button>
        ))}
    </div>
);

const Counter = ({label, value, onStep}: { label: string; value: number; onStep: (d: number) => void }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
            <Label className="text-base font-medium">{label}</Label>
            <p className="text-sm text-muted-foreground">Current: {value}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
            {FUEL_STEPS.map((d) => (
                <Button key={d} variant="outline" size="sm" onClick={() => onStep(d)}>
                    {d > 0 ? `+${d}` : d}
                </Button>
            ))}
        </div>
    </div>
);

const Person = ({name, sub}: { name?: string; sub: string }) => (
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
            {name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div>
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
    </div>
);

const QueueCard = ({title, description, queue, emptyText, youText, isYouInTopSix, userId, teamAssignments, isLead, children}: {
    title: string; description: string; queue: any[]; emptyText: string; youText: string; isYouInTopSix: boolean;
    userId?: string; teamAssignments: string[]; isLead: boolean; children: ReactNode;
}) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Live queue — ordered by join time</div>
                <ul className="space-y-2 mt-2">
                    {queue.length === 0 && <li className="text-sm text-muted-foreground">{emptyText}</li>}
                    {queue.map((q, idx) => (
                        <li
                            key={q.id}
                            className={`flex items-center justify-between p-2 rounded-md border ${idx < 6 ? "bg-primary/5 border-primary/20" : "bg-secondary"}`}
                        >
                            <Person name={q.name} sub={idx < 6 ? `#${idx + 1} — active` : `#${idx + 1}`}/>
                            <div className="flex items-center gap-3">
                                {userId === q.userId && isYouInTopSix && (
                                    <div className="text-xs text-success font-medium">{youText}</div>
                                )}
                                {isLead && idx < 6 && teamAssignments[idx] && (
                                    <div className="text-sm px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                                        Team {teamAssignments[idx]}
                                    </div>
                                )}
                                {idx < 6 && (
                                    <div className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">Active</div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {children}
        </CardContent>
    </Card>
);

const ScoutersCard = ({title, description, emptyText, participants}: {
    title: string; description: string; emptyText: string; participants: any;
}) => {
    const roster = participantRoster(participants);
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {roster.length > 0 ? (
                    <ul className="space-y-2">
                        {roster.map((p) => (
                            <li key={p.key} className="flex items-center justify-between p-2 rounded-md border bg-secondary/50">
                                <Person name={p.name} sub={`Team ${p.assignedTeam || "—"}`}/>
                                {p.submitted ? (
                                    <div className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">Submitted</div>
                                ) : (
                                    <div className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">Scouting</div>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">{emptyText}</p>
                )}
            </CardContent>
        </Card>
    );
};

// Lead-side start / signal end / force end, shared by the match and subjective queues.
const LeadControls = ({match, userId, label, loading, canStart, onStart, onSignal, onForce}: {
    match: any; userId?: string; label: string; loading: boolean; canStart: boolean;
    onStart: () => void; onSignal: () => void; onForce: () => void;
}) =>
    !match ? (
        <Button onClick={onStart} disabled={loading || !canStart} className="flex-1">
            <Play className="w-4 h-4 mr-2"/>
            Assign & Start {label}
        </Button>
    ) : match.startedBy !== userId ? (
        <Button className="flex-1" disabled>{label[0].toUpperCase() + label.slice(1)} running elsewhere</Button>
    ) : (
        <div className="flex gap-2 flex-1">
            <Button onClick={onSignal} variant="destructive" className="flex-1" disabled={loading || match.leadSignaledEnd}>
                {match.leadSignaledEnd ? "End Signaled" : `Signal End ${label}`}
            </Button>
            <Button onClick={onForce} variant="destructive" className="flex-1" disabled={loading}>
                Force End {label}
            </Button>
        </div>
    );

// Ends the match once every rostered scout has submitted. Every open client runs this;
// end() is a no-op once the match is no longer active.
const useAutoEnd = (root: string, matchId: string | undefined, enabled: boolean, end: (id: string) => Promise<unknown>) =>
    useEffect(() => {
        if (!matchId || !enabled) return;
        return onValue(ref(getDatabase(), `${root}/${matchId}/participants`), (snap) => {
            if (allSubmitted(snap.val())) end(matchId).catch((err) => console.error("Failed to auto-end match", err));
        });
    }, [root, matchId, enabled, end]);

// Scout-side notices: the lead signaled the end, or the session ended without this scout submitting (force end).
const useSessionNotices = (inSession: boolean, signaled: boolean, submitting: boolean, label: string) => {
    useEffect(() => {
        if (inSession && signaled) toast(`Lead has signaled the end of the ${label}. Please finish your scouting and submit.`);
    }, [inSession, signaled]);
    const wasIn = useRef(false);
    useEffect(() => {
        if (wasIn.current && !inSession && !submitting) toast(`The lead ended the ${label}. You have been removed from it.`);
        wasIn.current = inSession;
    }, [inSession]);
};

const QueueToggle = ({inQueue, label, onClick, disabled}: { inQueue: boolean; label: string; onClick: () => void; disabled: boolean }) => (
    <Button onClick={onClick} disabled={disabled} className="flex-1">
        {inQueue ? <Minus className="w-4 h-4 mr-2"/> : <Plus className="w-4 h-4 mr-2"/>}
        {inQueue ? `Leave ${label}` : `Join ${label}`}
    </Button>
);

// Logs and toasts any error from fn.
const run = (fn: () => Promise<unknown>, fallback: string) =>
    fn().catch((err) => {
        console.error(err);
        toast((err as Error)?.message || fallback);
    });

const Scouting = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("scouting");

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (navItems.some((i) => i.id === tab)) navigate(`/${tab}`);
    };

    // Stable identity: the queue hooks' callbacks (and the participants listener below) depend on it.
    const queueUser = useMemo(() => (user ? {id: user.id, name: user.name} : null), [user?.id, user?.name]);

    const {
        queue, topSix, join, leave, start, endMatch, signalMatchEnd, activeMatch, isInQueue, isInTopSix,
        loading: queueLoading,
    } = useQueue(queueUser);

    const {
        queue: subjectiveQueue,
        topSix: subjectiveTopSix,
        join: subjectiveJoin,
        leave: subjectiveLeave,
        start: subjectiveStart,
        endMatch: subjectiveEndMatch,
        signalMatchEnd: subjectiveSignalMatchEnd,
        activeMatch: subjectiveActiveMatch,
        isInQueue: isInSubjectiveQueue,
        isInTopSix: isInSubjectiveTopSix,
        loading: subjectiveQueueLoading,
    } = useSubjectiveQueue(queueUser);

    const isLead = !!user?.isLead;

    const [teamAssignments, setTeamAssignments] = useState<string[]>(EMPTY_TEAMS);
    const [importingTeams, setImportingTeams] = useState(false);
    const [qualificationNumber, setQualificationNumber] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [currentAssignment, setCurrentAssignment] = useState<CurrentAssignment | null>(null);
    const [currentSubjectiveAssignment, setCurrentSubjectiveAssignment] = useState<CurrentSubjectiveAssignment | null>(null);

    useEffect(() => user?.id ? subscribeToUserAssignment(user.id, setCurrentAssignment) : undefined, [user?.id]);
    useEffect(() => user?.id ? subscribeToUserSubjectiveAssignment(user.id, setCurrentSubjectiveAssignment) : undefined, [user?.id]);

    // A scout is in a session exactly while their assignment points at the currently active match.
    const isInMatchScouting = !!user?.id && !!activeMatch?.id && currentAssignment?.matchId === activeMatch.id;
    const isInSubjectiveScouting = !!user?.id && !!subjectiveActiveMatch?.id && currentSubjectiveAssignment?.matchId === subjectiveActiveMatch.id;
    const isActivelyScouting = isInMatchScouting || isInSubjectiveScouting;

    const matchKey = isInMatchScouting ? matchDraftKey(user.id, currentAssignment.matchId, currentAssignment.teamNumber) : null;
    const subjectiveKey = isInSubjectiveScouting
        ? subjectiveDraftKey(user.id, currentSubjectiveAssignment.matchId, currentSubjectiveAssignment.teamNumber)
        : null;
    const match = useDraftForm(EMPTY_MATCH, matchKey, {teamNumber: currentAssignment?.teamNumber});
    const subj = useDraftForm(EMPTY_SUBJECTIVE, subjectiveKey, {subjectiveTeamNumber: currentSubjectiveAssignment?.teamNumber});
    const m = match.form;
    const s = subj.form;

    useEffect(() => {
        if (matchKey) toast(`Scouting Team ${currentAssignment.teamNumber}`);
    }, [matchKey]);

    useEffect(() => {
        if (!(isActivelyScouting || isInQueue || isInSubjectiveQueue)) return;
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [isActivelyScouting, isInQueue, isInSubjectiveQueue]);

    useSessionNotices(isInMatchScouting, !!activeMatch?.leadSignaledEnd, isSubmitting, "match");
    useSessionNotices(isInSubjectiveScouting, !!subjectiveActiveMatch?.leadSignaledEnd, isSubmitting, "subjective match");
    useAutoEnd("matches", activeMatch?.id, !!user?.id, endMatch);
    useAutoEnd("subjectiveMatches", subjectiveActiveMatch?.id, !!user?.id, subjectiveEndMatch);

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiSize, setConfettiSize] = useState({width: 0, height: 0});
    const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const updateSize = () => setConfettiSize({width: window.innerWidth, height: window.innerHeight});
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    const triggerConfetti = useCallback(() => {
        setShowConfetti(true);
        setTimeout(() => {
            new Audio(successAudio).play().catch((err) => console.warn("Unable to play success audio", err));
        }, Math.random() * 15000 + 1000);
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
        }, 5000);
    }, []);

    const setAssignment = (index: number, value: string) =>
        setTeamAssignments((prev) => prev.map((t, i) => (i === index ? value.replace(/[^0-9]/g, "").slice(0, 5) : t)));

    // The first min(6, queueSize) assignments if all are valid team numbers, else null.
    const readyAssignments = (queueSize: number) => {
        const assigned = teamAssignments.slice(0, Math.min(6, queueSize));
        return assigned.every(validAssignment) ? assigned : null;
    };

    const handleImportTeamsByQualNumber = async () => {
        if (!qualificationNumber.trim()) return toast("Please enter a qualification match number");
        const qualNum = parseInt(qualificationNumber, 10);
        setImportingTeams(true);
        try {
            const matches = await getEventMatches(TBA_EVENT_KEY);
            const teams = matches?.length ? qualTeams(matches, qualNum) : null;
            const count = teams?.filter(Boolean).length ?? 0;
            if (!count) {
                setTeamAssignments(EMPTY_TEAMS);
                return toast(!matches?.length ? "No matches found"
                    : !teams ? `Qualification match ${qualNum} not found`
                        : "No valid team numbers found in qualification match");
            }
            setTeamAssignments(teams);
            toast(`Imported ${count} teams from Qualification Match ${qualNum}`);
            setQualificationNumber("");
        } catch (err) {
            console.error("Failed to import teams from TBA", err);
            toast("Failed to import teams from TBA. Check console for details.");
        } finally {
            setImportingTeams(false);
        }
    };

    const handleStartMatch = () => run(async () => {
        if (activeMatch) return toast("A match is already running — end it before starting a new one.");
        const assigned = readyAssignments(topSix.length);
        if (!assigned) return toast("Please enter valid team numbers for the active slots (numbers only)");
        await start(assigned);
        toast(`Match started — Teams: ${assigned.filter(Boolean).join(", ")}`);
        setTeamAssignments(EMPTY_TEAMS);
    }, "Failed to start match");

    const handleStartSubjectiveMatch = () => run(async () => {
        if (subjectiveActiveMatch) return toast("A subjective match is already running — end it before starting a new one.");
        const assigned = readyAssignments(subjectiveTopSix.length);
        if (!assigned) return toast("Please enter valid team numbers for the active slots (numbers only)");
        const matchId = await subjectiveStart(assigned);
        toast(`Subjective match started — id: ${matchId}`);
    }, "Failed to start subjective match");

    const signalEnd = (active: any, signal: (id: string) => Promise<unknown>, label: string) => () => run(async () => {
        if (!active?.id) return toast(`No active ${label} to end`);
        await signal(active.id);
        toast(`${label[0].toUpperCase() + label.slice(1)} end signaled to all scouters`);
    }, `Failed to signal ${label} end`);

    // Ends the match for everyone, submitted or not: status flips to ended, which closes every scout's form,
    // and unsubmitted scouts' assignments are cleared.
    const forceEnd = (active: any, end: (id: string) => Promise<unknown>, label: string, draftPrefix: string) => () => run(async () => {
        if (!active?.id) return toast(`No active ${label} to end`);
        // Clears drafts on this (the lead's) device only.
        Object.keys(localStorage).filter((k) => k.includes(draftPrefix)).forEach((k) => localStorage.removeItem(k));
        await end(active.id);
        toast(`${label[0].toUpperCase() + label.slice(1)} force ended — all scouters removed`);
    }, `Failed to force end ${label}`);

    // Wraps a save that resolves to its success message; navigates away on success.
    const submitting = (save: () => Promise<string>) => async () => {
        setIsSubmitting(true);
        try {
            toast(await save());
            setTimeout(() => navigate("/dashboard"), 500);
        } catch (err) {
            console.error("Submit error:", err);
            toast("Failed to submit. Please try again.");
            setIsSubmitting(false);
        }
    };

    // Writes the participant payload, then clears the assignment. Throws (keeping the form) on failure.
    const saveParticipant = async (matchesRoot: string, assignmentNode: string, assignment: CurrentAssignment | null, payload: (sub: any) => object) => {
        if (!assignment?.matchId || !user?.id || !assignment.teamNumber) throw new Error("Missing match or team information");
        const db = getDatabase();
        await set(ref(db, `${matchesRoot}/${assignment.matchId}/participants/${user.id}`), payload({
            userId: user.id,
            scoutName: user.name || "Unknown",
            matchId: assignment.matchId,
            submittedAt: serverTimestamp(),
        }));
        await remove(ref(db, `users/${user.id}/${assignmentNode}`));
        return assignment.matchId;
    };

    const submitMatch = submitting(async () => {
        if (Math.random() * 10 < 2) for (let i = 0; i < 5; i++) triggerConfetti();
        const matchId = await saveParticipant("matches", "currentAssignment", currentAssignment,
            (sub) => buildMatchPayload(m, {...sub, teamNumber: currentAssignment.teamNumber}));
        match.finish();
        const snap = await get(ref(getDatabase(), `matches/${matchId}/participants`));
        if (!allSubmitted(snap.val())) return "Scouting data submitted successfully!";
        await endMatch(matchId);
        return "No more active scouters. Match ended.";
    });

    const submitSubjective = submitting(async () => {
        const matchId = await saveParticipant("subjectiveMatches", "currentSubjectiveAssignment", currentSubjectiveAssignment,
            (sub) => buildSubjectivePayload(s, {...sub, teamNumber: s.subjectiveTeamNumber}));
        subj.finish();
        const snap = await get(ref(getDatabase(), `subjectiveMatches/${matchId}/participants`));
        if (!allSubmitted(snap.val())) return "Subjective scouting data submitted successfully!";
        await subjectiveEndMatch(matchId);
        return "No more active subjective scouters. Subjective match ended.";
    });

    const showMatchForm = isInMatchScouting && !isLead;
    const showSubjectiveForm = isInSubjectiveScouting && !isLead;
    const station = currentSubjectiveAssignment?.station;

    return (
        <div className="min-h-screen bg-background">
            {showConfetti && confettiSize.width > 0 && (
                <Confetti width={confettiSize.width} height={confettiSize.height} recycle={false} numberOfPieces={1000}/>
            )}
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main
                className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
                style={{WebkitOverflowScrolling: "touch"}}
            >
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6">
                    <div className="space-y-6">
                        {(isLead || !isActivelyScouting) && (
                            <QueueCard
                                title="Match Queue"
                                description="First 6 in the queue will be selected to start scouting (real-time). Use the qualification number input below to load team numbers for a specific qualification match from TBA."
                                queue={queue}
                                emptyText="No one in queue yet"
                                youText="You are in the next match!"
                                isYouInTopSix={isInTopSix}
                                userId={user?.id}
                                teamAssignments={teamAssignments}
                                isLead={isLead}
                            >
                                {isLead && (
                                    <div className="space-y-3">
                                        <Label htmlFor="qual-number">Qualification Match Number</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="qual-number"
                                                type="number"
                                                min="1"
                                                placeholder="Enter match number (e.g., 1, 2, 3)"
                                                value={qualificationNumber}
                                                onChange={(e) => setQualificationNumber(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleImportTeamsByQualNumber()}
                                            />
                                            <Button
                                                onClick={handleImportTeamsByQualNumber}
                                                disabled={importingTeams || !qualificationNumber.trim()}
                                                variant="outline"
                                            >
                                                {importingTeams ? "Importing..." : "Import"}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {isLead && (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {[0, 3, 1, 4, 2, 5].map((i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Input
                                                    aria-label={`Team number ${i + 1}`}
                                                    value={teamAssignments[i]}
                                                    onChange={(e) => setAssignment(i, e.target.value)}
                                                    className="w-28"
                                                    placeholder={STATIONS[i]}
                                                    inputMode="numeric"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-3 items-center">
                                    {!isLead ? (
                                        <QueueToggle
                                            inQueue={isInQueue}
                                            label="match queue"
                                            onClick={() => run(() => (isInQueue ? leave() : join()), "Queue error")}
                                            disabled={queueLoading}
                                        />
                                    ) : (
                                        <LeadControls
                                            match={activeMatch}
                                            userId={user?.id}
                                            label="match"
                                            loading={queueLoading}
                                            canStart={topSix.length > 0 && !!readyAssignments(topSix.length)}
                                            onStart={handleStartMatch}
                                            onSignal={signalEnd(activeMatch, signalMatchEnd, "match")}
                                            onForce={forceEnd(activeMatch, endMatch, "match", "scout_draft_match:")}
                                        />
                                    )}
                                </div>
                            </QueueCard>
                        )}

                        {isLead && activeMatch && (
                            <ScoutersCard
                                title="Active Scouters"
                                description="Scouters currently scouting in the active match"
                                emptyText="No scouters in the active match"
                                participants={activeMatch.participants}
                            />
                        )}

                        {(isLead || !isActivelyScouting) && (
                            <QueueCard
                                title="Subjective Queue"
                                description="First 6 in the queue will be selected to start subjective scouting (real-time)"
                                queue={subjectiveQueue}
                                emptyText="No one in subjective queue yet"
                                youText="You are in the next subjective match!"
                                isYouInTopSix={isInSubjectiveTopSix}
                                userId={user?.id}
                                teamAssignments={teamAssignments}
                                isLead={isLead}
                            >
                                <div className="flex gap-3 items-center">
                                    {!isLead ? (
                                        <QueueToggle
                                            inQueue={isInSubjectiveQueue}
                                            label="subjective queue"
                                            onClick={() => run(() => (isInSubjectiveQueue ? subjectiveLeave() : subjectiveJoin()), "Subjective queue error")}
                                            disabled={subjectiveQueueLoading}
                                        />
                                    ) : (
                                        <LeadControls
                                            match={subjectiveActiveMatch}
                                            userId={user?.id}
                                            label="subjective match"
                                            loading={subjectiveQueueLoading}
                                            canStart={subjectiveTopSix.length > 0 && !!readyAssignments(subjectiveTopSix.length)}
                                            onStart={handleStartSubjectiveMatch}
                                            onSignal={signalEnd(subjectiveActiveMatch, subjectiveSignalMatchEnd, "subjective match")}
                                            onForce={forceEnd(subjectiveActiveMatch, subjectiveEndMatch, "subjective match", "scout_draft_subjective:")}
                                        />
                                    )}
                                </div>
                            </QueueCard>
                        )}

                        {isLead && subjectiveActiveMatch && (
                            <ScoutersCard
                                title="Active Subjective Scouters"
                                description="Scouters currently scouting in the active subjective match"
                                emptyText="No scouters in the active subjective match"
                                participants={subjectiveActiveMatch.participants}
                            />
                        )}

                        {showMatchForm && (
                            <>
                                <Section
                                    title={`Match Scouting - Team ${m.teamNumber}`}
                                    description="Answer the following questions about this team's robot and strategy"
                                />
                                <Section title="Autonomous Notes" description="Record observations during autonomous period (available throughout match)">
                                    <Textarea
                                        placeholder="Enter your notes here..."
                                        value={m.autonomousNotes}
                                        onChange={(e) => match.setField("autonomousNotes", e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                </Section>
                                <Section title="Autonomous Fuel" description="Fuel scored during autonomous period (editable throughout match)">
                                    <Counter
                                        label="Autonomous Fuel"
                                        value={m.autonomousFuel}
                                        onStep={(d) => match.setForm((f) => ({...f, autonomousFuel: Math.max(0, f.autonomousFuel + d)}))}
                                    />
                                </Section>
                                <Section title="Auto Climb" description="Did this team climb?">
                                    <Choice value={m.autoClimb} onChange={(v) => match.setField("autoClimb", v)}/>
                                </Section>
                                <Section title="Teleop Notes" description="Record observations during teleop period">
                                    <Textarea
                                        placeholder="Enter your notes here..."
                                        value={m.teleopNotes}
                                        onChange={(e) => match.setField("teleopNotes", e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                </Section>
                                <Section title="Teleop Fuel" description="Fuel scored during teleop period">
                                    <Counter
                                        label="Teleop Fuel"
                                        value={m.teleopFuel}
                                        onStep={(d) => match.setForm((f) => ({...f, teleopFuel: Math.max(0, f.teleopFuel + d)}))}
                                    />
                                </Section>
                                <Section title="Teleop Climb" description="Did the team successfully climb?">
                                    <Choice className="flex gap-2 mb-4" value={m.teleopClimb} onChange={(v) => match.setField("teleopClimb", v)}/>
                                    {m.teleopClimb === "yes" && (
                                        <div>
                                            <div className="font-medium mb-2">Climb Level</div>
                                            <Choice options={["L1", "L2", "L3"]} value={m.climbLevel} onChange={(v) => match.setField("climbLevel", v)}/>
                                        </div>
                                    )}
                                </Section>
                                <Section title="Defense Score" description="Rate the team's defensive performance">
                                    <div className="flex gap-2">
                                        <Select value={m.defenseScore} onValueChange={(v) => match.setField("defenseScore", v)}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select Score"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {["None", "Poor", "Fair", "Good", "Excellent"].map((label, i) => (
                                                    <SelectItem key={i} value={String(i)}>{i} - {label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </Section>
                                <Section title="Shooting on the Move & Robot Tipped" description="Select Yes or No for each">
                                    <div className="mb-4">
                                        <div className="font-medium mb-2">Shooting on the Move (SOTM)</div>
                                        <Choice value={m.sotm} onChange={(v) => match.setField("sotm", v)}/>
                                    </div>
                                    <div>
                                        <div className="font-medium mb-2">Robot Tipped</div>
                                        <Choice value={m.robotTipped} onChange={(v) => match.setField("robotTipped", v)}/>
                                    </div>
                                </Section>
                                <Card>
                                    <CardContent className="pt-6">
                                        <Button onClick={submitMatch} className="w-full" size="lg" disabled={isSubmitting}>
                                            {isSubmitting ? "Submitting..." : "Submit Scouting"}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        {showSubjectiveForm && (
                            <>
                                <Section
                                    title={`Subjective Scouting - Team ${s.subjectiveTeamNumber}${station ? ` (${station})` : ""}`}
                                    description="Answer the following questions about this team's robot and strategy"
                                />
                                {SUBJECTIVE_SECTIONS.map((section) => (
                                    <Card key={section.title}>
                                        <CardHeader>
                                            <CardTitle>{section.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {section.fields.map((f) => (
                                                <div key={f.key} className="space-y-3">
                                                    <Label htmlFor={f.id} className="text-base font-medium">{f.label}</Label>
                                                    <Input
                                                        id={f.id}
                                                        placeholder={f.placeholder}
                                                        value={s[f.key]}
                                                        onChange={(e) => subj.setField(f.key, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))}
                                <Section title="Submit Subjective Scouting">
                                    <Button onClick={submitSubjective} className="w-full" size="lg" disabled={isSubmitting}>
                                        {isSubmitting ? "Submitting..." : "Submit Subjective Scouting"}
                                    </Button>
                                </Section>
                            </>
                        )}
                    </div>

                    <div className="flex justify-center gap-4 py-6 px-6 border-t">
                        <Button variant="outline" onClick={() => window.scrollTo(0, 0)}>Back to Top</Button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Scouting;
