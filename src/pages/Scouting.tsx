import {useCallback, useEffect, useRef, useState} from "react";
import Confetti from "react-confetti";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/contexts/AuthContext";
import {Minus, Play, Plus} from "lucide-react";
import {useQueue} from "@/hooks/use-queue";
import {useSubjectiveQueue} from "@/hooks/use-subjective-queue";
import {subscribeToUserAssignment, subscribeToUserSubjectiveAssignment} from "@/lib/queue";
import {get, getDatabase, ref, remove, serverTimestamp, set,} from "firebase/database";
import successAudio from "/partyblower.mp3";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {toast} from "sonner";
import {getNextUnplayedMatch} from "@/lib/tba";


const Scouting = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("scouting");
    const isManualSessionRef = useRef(false);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === "dashboard") {
            navigate("/dashboard");
        } else if (tab === "scouting") {
            navigate("/scouting");
        } else if (tab === "pit-scouting") {
            navigate("/pit-scouting");
        } else if (tab === "analytics") {
            navigate("/analytics");
        } else if (tab === "matches") {
            navigate("/matches");
        } else if (tab === "leaderboard") {
            navigate("/leaderboard");
        }
    };

    const {
        queue,
        topSix,
        join,
        leave,
        start,
        endMatch,
        activeMatch,
        isInQueue,
        isInTopSix,
        loading: queueLoading,
    } = useQueue(user ? {id: user.id, name: user.name} : null);

    const {
        queue: subjectiveQueue,
        topSix: subjectiveTopSix,
        join: subjectiveJoin,
        leave: subjectiveLeave,
        start: subjectiveStart,
        endMatch: subjectiveEndMatch,
        activeMatch: subjectiveActiveMatch,
        isInQueue: isInSubjectiveQueue,
        isInTopSix: isInSubjectiveTopSix,
        loading: subjectiveQueueLoading,
    } = useSubjectiveQueue(user ? {id: user.id, name: user.name} : null);

    const isLead = !!user?.isLead;

    const handleQueueToggle = async () => {
        try {
            if (isInQueue) {
                await leave();
            } else {
                await join();
            }
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Queue error");
        }
    };

    const handleSubjectiveQueueToggle = async () => {
        try {
            if (isInSubjectiveQueue) {
                await subjectiveLeave();
            } else {
                await subjectiveJoin();
            }
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Subjective queue error");
        }
    };

    const [teamAssignments, setTeamAssignments] = useState<string[]>([
        "",
        "",
        "",
        "",
        "",
        "",
    ]);
    const [importingTeams, setImportingTeams] = useState(false);

    const setAssignment = (index: number, value: string) => {
        setTeamAssignments((prev) => {
            const copy = [...prev];
            copy[index] = value.replace(/[^0-9]/g, "").slice(0, 5);
            return copy;
        });
    };

    const handleImportTeamsFromTBA = async () => {
        try {
            setImportingTeams(true);
            const eventKey = "2026orore";
            const match = await getNextUnplayedMatch(eventKey);
            
            if (!match) {
                toast("No upcoming matches found");
                return;
            }
            
            // Extract team numbers from alliances
            // Match structure: { alliances: { red: { team_keys: [...] }, blue: { team_keys: [...] } } }
            const redTeams = match.alliances?.red?.team_keys || [];
            const blueTeams = match.alliances?.blue?.team_keys || [];
            
            const teamNumbers: string[] = [];
            
            // Red teams (indices 0, 1, 2)
            redTeams.forEach((key: string) => {
                const num = key.replace(/^frc/, "");
                if (/^\d+$/.test(num)) {
                    teamNumbers.push(num);
                }
            });
            
            // Blue teams (indices 3, 4, 5)
            blueTeams.forEach((key: string) => {
                const num = key.replace(/^frc/, "");
                if (/^\d+$/.test(num)) {
                    teamNumbers.push(num);
                }
            });
            
            if (teamNumbers.length === 0) {
                toast("No valid team numbers found in next match");
                return;
            }
            
            // Fill the team assignments with proper order: Red 1, Red 2, Red 3, Blue 1, Blue 2, Blue 3
            const newAssignments = ["", "", "", "", "", ""];
            teamNumbers.slice(0, 6).forEach((num, idx) => {
                newAssignments[idx] = num;
            });
            
            setTeamAssignments(newAssignments);
            toast(`Imported ${teamNumbers.length} teams from TBA for next match`);
        } catch (err) {
            console.error("Failed to import teams from TBA", err);
            toast("Failed to import teams from TBA. Check console for details.");
        } finally {
            setImportingTeams(false);
        }
    };


    const validAssignment = (s: string) => /^\d{1,5}$/.test(s);
    const handleStartMatch = async () => {
        try {
            if (activeMatch) {
                toast("A match is already running — end it before starting a new one.");
                return;
            }

            const required = Math.min(6, topSix.length);
            const assigned = teamAssignments.slice(0, required);
            const invalid = assigned.some((v) => !validAssignment(v));
            if (required > 0 && invalid) {
                toast(
                    "Please enter valid team numbers for the active slots (numbers only)",
                );
                return;
            }

            const matchId = await start(assigned);
            toast(`Match started — id: ${matchId}`);
            setTeamAssignments(["", "", "", "", "", ""]);
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Failed to start match");
        }
    };

    const handleStartSubjectiveMatch = async () => {
        try {
            if (subjectiveActiveMatch) {
                toast("A subjective match is already running — end it before starting a new one.");
                return;
            }

            const required = Math.min(6, subjectiveTopSix.length);
            const assigned = teamAssignments.slice(0, required);
            const invalid = assigned.some((v) => !validAssignment(v));
            if (required > 0 && invalid) {
                toast(
                    "Please enter valid team numbers for the active slots (numbers only)",
                );
                return;
            }

            const matchId = await subjectiveStart(assigned);
            toast(`Subjective match started — id: ${matchId}`);
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Failed to start subjective match");
        }
    };

    const handleEndMatch = async () => {
        try {
            if (!activeMatch?.id) return toast("No active match to end");
            await endMatch(activeMatch.id);
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Failed to end match");
        }
    };

    const handleEndSubjectiveMatch = async () => {
        try {
            if (!subjectiveActiveMatch?.id) return toast("No active subjective match to end");
            await subjectiveEndMatch(subjectiveActiveMatch.id);
        } catch (err) {
            console.error(err);
            toast((err as Error)?.message || "Failed to end subjective match");
        }
    };

    const startSubjectiveScouting = (teamNum?: string) => {
        const effectiveTeam = (
            typeof teamNum === "string" ? teamNum : subjectiveTeamNumber
        ).trim();
        if (!effectiveTeam) {
            toast("Please enter a team number");
            return;
        }

        if (teamNum) setSubjectiveTeamNumber(String(teamNum));

        setIsInSubjectiveScouting(true);
        setAutonomousEffectiveness("");
        setCanQuicklyScore("");
        setCanClimb("");
        setClimbLevelSubjective("");
        setPerformanceUnderPressure("");
        setTeamFocus("");
        setDriverSynchronization("");
        setDefensiveStrategy("");
        setBlockingEffectiveness("");
        setAllyCooperation("");
    };

    const resetSubjectiveScouting = async () => {
        if (isInSubjectiveScouting && user?.id && subjectiveActiveMatch?.id) {
            try {
                const db = getDatabase();
                const participantRef = ref(
                    db,
                    `subjectiveMatches/${subjectiveActiveMatch.id}/participants/${user.id}`,
                );

                await set(participantRef, {
                    userId: user.id,
                    scoutName: user.name || "Unknown",
                    teamNumber: subjectiveTeamNumber,
                    matchId: subjectiveActiveMatch.id,
                    submittedAt: serverTimestamp(),
                    robotPerformance: {
                        autonomousEffectiveness,
                        canQuicklyScore,
                        canClimb,
                        climbLevel: canClimb === "yes" ? climbLevelSubjective : null,
                    },
                    teamDynamics: {
                        performanceUnderPressure,
                        teamFocus,
                        driverSynchronization,
                    },
                    tacticalInsights: {
                        defensiveStrategy,
                        blockingEffectiveness,
                        allyCooperation,
                    },
                    // misc fields added for analytics
                    misc: {
                        defensiveSkill,
                        robotReliability: robotReliablity,
                        robotPenalties,
                        autoFuel,
                        autoClimb: autoClimb1,
                        teleopPassing,
                        gameSense,
                    },
                });
                await remove(ref(db, `users/${user.id}/currentSubjectiveAssignment`));
                toast("Subjective scouting submitted!");
            } catch (err) {
                console.error("Failed to submit subjective scouting data:", err);
                toast("Failed to save subjective scouting data. Please notify a lead.");
            }
        }

        setIsInSubjectiveScouting(false);
        setSubjectiveTeamNumber("");
        setAutonomousEffectiveness("");
        setCanQuicklyScore("");
        setCanClimb("");
        setClimbLevelSubjective("");
        setPerformanceUnderPressure("");
        setTeamFocus("");
        setDriverSynchronization("");
        setDefensiveStrategy("");
        setBlockingEffectiveness("");
        setAllyCooperation("");
        setDefensiveStrategy("");
        setRobotReliability("");
        setRobotPenalties("");
        setAutoFuel("");
        setAutoClimb1("");
        setTeleopPassing("");
        setGameSense("");
    };

    const [teamNumber, setTeamNumber] = useState("");

    const [autonomousNotes, setAutonomousNotes] = useState("");
    const [autonomousFuel, setAutonomousFuel] = useState(0);
    const [autoClimb, setAutoClimb] = useState<string>("");

    const [teleopNotes, setTeleopNotes] = useState("");
    const [teleopFuel, setTeleopFuel] = useState(0);
    const [teleopClimb, setTeleopClimb] = useState<string>("");

    const [endGameNotes, setEndGameNotes] = useState("");
    const [didClimb, setDidClimb] = useState(false);
    const [climbLevel, setClimbLevel] = useState("");
    const [defenseScore, setDefenseScore] = useState("");

    const [sotm, setSotm] = useState<string>("");
    const [robotTipped, setRobotTipped] = useState<string>("");

    // Subjective Scouting State
    const [subjectiveTeamNumber, setSubjectiveTeamNumber] = useState("");
    const [isInSubjectiveScouting, setIsInSubjectiveScouting] = useState(false);

    // Section 1: Robot Performance and Strategy
    const [autonomousEffectiveness, setAutonomousEffectiveness] = useState<string>("");
    const [canQuicklyScore, setCanQuicklyScore] = useState<string>("");
    const [canClimb, setCanClimb] = useState<string>("");
    const [climbLevelSubjective, setClimbLevelSubjective] = useState<string>("");

    // Section 2: Team Dynamics
    const [performanceUnderPressure, setPerformanceUnderPressure] = useState<string>("");
    const [teamFocus, setTeamFocus] = useState<string>("");
    const [driverSynchronization, setDriverSynchronization] = useState<string>("");

    // Section 3: Tactical Insights
    const [defensiveStrategy, setDefensiveStrategy] = useState<string>("");
    const [blockingEffectiveness, setBlockingEffectiveness] = useState<string>("");
    const [allyCooperation, setAllyCooperation] = useState<string>("");

    // Section 4: Misc
    const [defensiveSkill, setDefensiveSkill] = useState<string>("");
    const [robotReliablity, setRobotReliability] = useState<string>("");
    const [robotPenalties, setRobotPenalties] = useState<string>("");
    const [autoFuel, setAutoFuel] = useState<string>("");
    const [autoClimb1, setAutoClimb1] = useState<string>("");
    const [teleopPassing, setTeleopPassing] = useState<string>("");
    const [gameSense, setGameSense] = useState<string>("");

    const currentMatchIdRef = useRef<string | null>(null);
    const assignedTeamRef = useRef<string | null>(null);

    const matchEndedHandledRef = useRef(false);

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiSize, setConfettiSize] = useState({width: 0, height: 0});
    const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const triggerConfetti = useCallback(() => {
        setShowConfetti(true);
        audioTimeoutRef.current = setTimeout(
            () => {
                const audio = new Audio(successAudio);
                audio.play().catch((err) => {
                    console.warn("Unable to play success audio", err);
                });
                audioTimeoutRef.current = null;
            },
            Math.random() * 15000 + 1000,
        );
        if (confettiTimeoutRef.current) {
            clearTimeout(confettiTimeoutRef.current);
        }
        confettiTimeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            confettiTimeoutRef.current = null;
        }, 5000);
    }, []);

    const startScouting = (teamNum?: string, opts?: { manual?: boolean }) => {
        const manual = opts?.manual === true;
        isManualSessionRef.current = manual;
        const effectiveTeam = (
            typeof teamNum === "string" ? teamNum : teamNumber
        ).trim();
        if (!effectiveTeam) {
            toast("Please enter a team number");
            return;
        }

        if (manual) {
            currentMatchIdRef.current = null;
            assignedTeamRef.current = null;
        }

        if (teamNum) setTeamNumber(String(teamNum));

        setAutonomousNotes("");
        setAutonomousFuel(0);
        setAutoClimb("");
        setTeleopNotes("");
        setTeleopFuel(0);
        setDefenseScore("");
        setEndGameNotes("");
        setDidClimb(false);
    };

    const lastProcessedAssignmentRef = useRef<string | null>(null);
    useEffect(() => {
        if (!user?.id) return;

        const unsub = subscribeToUserAssignment(user.id, (assignment) => {
            if (isManualSessionRef.current) {
                return;
            }
            if (!assignment) {
                if (!matchEndedHandledRef.current && !activeMatch) {
                    matchEndedHandledRef.current = true;
                }
                return;
            }

            currentMatchIdRef.current = assignment.matchId;
            assignedTeamRef.current = String(assignment.teamNumber);

            matchEndedHandledRef.current = false;

            if (!activeMatch) {
                startScouting(String(assignment.teamNumber), {manual: false});
            }
        });

        return unsub;
    }, [user?.id, activeMatch]);

    useEffect(() => {
        if (!user?.id) return;

        const unsub = subscribeToUserSubjectiveAssignment(user.id, (assignment) => {
            if (!assignment) {
                return;
            }

            if (!isInSubjectiveScouting) {
                startSubjectiveScouting(String(assignment.teamNumber));
            }
        });

        return unsub;
    }, [user?.id, isInSubjectiveScouting]);

    // Add beforeunload event listener to prevent accidental reload during scouting
    useEffect(() => {
        const isScoutingActive = isInSubjectiveScouting || isInQueue || isInSubjectiveQueue;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isScoutingActive) {
                e.preventDefault();
                e.returnValue = "";
                return "";
            }
        };

        if (isScoutingActive) {
            window.addEventListener("beforeunload", handleBeforeUnload);
            return () => {
                window.removeEventListener("beforeunload", handleBeforeUnload);
            };
        }
    }, [isInSubjectiveScouting, isInQueue, isInSubjectiveQueue]);

    useEffect(() => {
        if (isManualSessionRef.current) return;
        if (!activeMatch?.id || !user?.id) return;

        const checkIfLastScouter = async () => {
            try {
                const db = getDatabase();

                const matchRef = ref(db, `matches/${activeMatch.id}`);
                const matchSnap = await get(matchRef);
                if (!matchSnap.exists()) return;

                const match = matchSnap.val();
                if (match.status !== "active") {
                    return;
                }

                const participantsRef = ref(
                    db,
                    `matches/${activeMatch.id}/participants`,
                );
                const snapshot = await get(participantsRef);
                if (!snapshot.exists()) return;

                const participants = snapshot.val();

                const activeParticipants = Object.values(participants).filter(
                    (p) => {
                        const part = p as { submittedAt?: unknown };
                        return !part.submittedAt;
                    },
                );

                if (activeParticipants.length === 0) {
                    console.log("This was the last scouter → ending match");
                    await endMatch(activeMatch.id);
                }
            } catch (err) {
                console.error("Failed to check if last scouter", err);
            }
        };
        checkIfLastScouter();
    }, [activeMatch?.id, user?.id, endMatch]);

    const resetScouting = async () => {
        if (Math.random() * 10 < 2) {
            for (let i = 0; i < 5; i++) {
                triggerConfetti();
            }
        } else {
            if (!isManualSessionRef.current) {
                try {
                    const matchId = currentMatchIdRef.current;
                    const assignedTeam = assignedTeamRef.current;

                    if (!matchId || !user?.id || !assignedTeam) {
                        console.warn(
                            "resetScouting: missing matchId, user, or assignedTeam",
                        );
                        return;
                    }

                    const db = getDatabase();

                    const participantRef = ref(
                        db,
                        `matches/${matchId}/participants/${user.id}`,
                    );

                    await set(participantRef, {
                        userId: user.id,
                        scoutName: user.name || "Unknown",
                        teamNumber: assignedTeam,
                        matchId,

                        submittedAt: serverTimestamp(),

                        autonomous: {
                            fuel: autonomousFuel,
                            notes: autonomousNotes,
                            autoClimb,
                        },

                        teleop: {
                            fuel: teleopFuel,
                            notes: teleopNotes,
                            teleopClimb,
                            climbLevel: teleopClimb === "yes" ? climbLevel : null,
                            defenseScore,
                        },

                        endGame: {
                            didClimb,
                            climbLevel: didClimb ? climbLevel : null,
                            notes: endGameNotes,
                        },
                        sotm,
                        robotTipped,
                    });
                    await remove(ref(db, `users/${user.id}/currentAssignment`));
                } catch (err) {
                    console.error("Failed to submit scouting data:", err);
                    toast("Failed to save scouting data. Please notify a lead.");
                }
            }
        }

        setTeamNumber("");
        setAutonomousNotes("");
        setAutonomousFuel(0);
        setAutoClimb("");
        setTeleopFuel(0);
        setTeleopNotes("");
        setDefenseScore("");
        setEndGameNotes("");
        setDidClimb(false);
        setCancelConfirm(false);
        setSotm("");
        setRobotTipped("");
        isManualSessionRef.current = false;
        if (cancelTimeoutRef.current) {
            clearTimeout(cancelTimeoutRef.current);
            cancelTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        const updateSize = () => {
            setConfettiSize({width: window.innerWidth, height: window.innerHeight});
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);


    return (
        <div className="min-h-screen bg-background">
            {showConfetti && confettiSize.width > 0 && (
                <Confetti
                    width={confettiSize.width}
                    height={confettiSize.height}
                    recycle={false}
                    numberOfPieces={1000}
                />
            )}
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main
                className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
                style={{WebkitOverflowScrolling: "touch"}}
            >
                <TopBar
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                />

                <div className="p-6">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between"></div>

                        {(isLead || !activeMatch) && !isInSubjectiveScouting && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Match Queue</CardTitle>
                                    <CardDescription>
                                        First 6 in the queue will be selected to start scouting
                                        (real-time)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Live queue — ordered by join time
                                            </div>
                                        </div>

                                        <ul className="space-y-2 mt-2">
                                            {queue.length === 0 && (
                                                <li className="text-sm text-muted-foreground">
                                                    No one in queue yet
                                                </li>
                                            )}

                                            {queue.map((q, idx) => (
                                                <li
                                                    key={q.id}
                                                    className={`flex items-center justify-between p-2 rounded-md border ${idx < 6 ? "bg-primary/5 border-primary/20" : "bg-secondary"}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                                                            {q.name?.charAt(0)?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {q.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {idx < 6
                                                                    ? `#${idx + 1} — active`
                                                                    : `#${idx + 1}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {user?.id === q.userId && isInTopSix && (
                                                            <div className="text-xs text-success font-medium">
                                                                You are in the next match!
                                                            </div>
                                                        )}

                                                        {isLead && idx < 6 && teamAssignments[idx] && (
                                                            <div
                                                                className="text-sm px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                                                                Team {teamAssignments[idx]}
                                                            </div>
                                                        )}

                                                        {idx < 6 && (
                                                            <div
                                                                className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">
                                                                Active
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {isLead && (
                                        <Button
                                            onClick={handleImportTeamsFromTBA}
                                            disabled={importingTeams}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            {importingTeams ? "Importing..." : "Import Teams from TBA"}
                                        </Button>
                                    )}

                                    {isLead && (
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {[0, 3, 1, 4, 2, 5].map((i) => {
                                                const placeholders = [
                                                    "Red 1",
                                                    "Red 2",
                                                    "Red 3",
                                                    "Blue 1",
                                                    "Blue 2",
                                                    "Blue 3",
                                                ];
                                                return (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <Input
                                                            aria-label={`Team number ${i + 1}`}
                                                            value={teamAssignments[i]}
                                                            onChange={(e) => setAssignment(i, e.target.value)}
                                                            className="w-28"
                                                            placeholder={placeholders[i]}
                                                            inputMode="numeric"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex gap-3 items-center">
                                        {!isLead ? (
                                            !activeMatch ? (
                                                <Button
                                                    onClick={handleQueueToggle}
                                                    disabled={queueLoading}
                                                    className="flex-1"
                                                >
                                                    {isInQueue ? (
                                                        <Minus className="w-4 h-4 mr-2"/>
                                                    ) : (
                                                        <Plus className="w-4 h-4 mr-2"/>
                                                    )}
                                                    {isInQueue ? "Leave match queue" : "Join match queue"}
                                                </Button>
                                            ) : (
                                                <div className="flex-1 text-center text-sm text-muted-foreground">
                                                    Scouting in progress
                                                </div>
                                            )
                                        ) : activeMatch ? (
                                            activeMatch.startedBy === user?.id ? (
                                                <Button
                                                    onClick={handleEndMatch}
                                                    variant="destructive"
                                                    className="flex-1"
                                                    disabled={queueLoading}
                                                >
                                                    End match
                                                </Button>
                                            ) : (
                                                <Button className="flex-1" disabled>
                                                    Match running elsewhere
                                                </Button>
                                            )
                                        ) : (
                                            <Button
                                                onClick={handleStartMatch}
                                                disabled={
                                                    queueLoading ||
                                                    topSix.length === 0 ||
                                                    (topSix.length > 0 &&
                                                        !teamAssignments
                                                            .slice(0, Math.min(6, topSix.length))
                                                            .every((v) => /^\d{1,5}$/.test(v)))
                                                }
                                                className="flex-1"
                                            >
                                                <Play className="w-4 h-4 mr-2"/>
                                                Assign & Start match
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isLead && activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Active Scouters</CardTitle>
                                    <CardDescription>
                                        Scouters currently scouting in the active match
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {activeMatch.participants && activeMatch.participants.length > 0 ? (
                                        <ul className="space-y-2">
                                            {activeMatch.participants.map((participant: any, idx: number) => (
                                                <li
                                                    key={participant.userId}
                                                    className="flex items-center justify-between p-2 rounded-md border bg-secondary/50"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                                                            {participant.name?.charAt(0)?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {participant.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Team {participant.assignedTeam || "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {idx < 6 && (
                                                        <div
                                                            className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
                                                            Scouting
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No scouters in the active match
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {(isLead || !subjectiveActiveMatch) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Subjective Queue</CardTitle>
                                    <CardDescription>
                                        First 6 in the queue will be selected to start subjective scouting
                                        (real-time)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Live queue — ordered by join time
                                            </div>
                                        </div>

                                        <ul className="space-y-2 mt-2">
                                            {subjectiveQueue.length === 0 && (
                                                <li className="text-sm text-muted-foreground">
                                                    No one in subjective queue yet
                                                </li>
                                            )}

                                            {subjectiveQueue.map((q, idx) => (
                                                <li
                                                    key={q.id}
                                                    className={`flex items-center justify-between p-2 rounded-md border ${idx < 6 ? "bg-primary/5 border-primary/20" : "bg-secondary"}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                                                            {q.name?.charAt(0)?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {q.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {idx < 6
                                                                    ? `#${idx + 1} — active`
                                                                    : `#${idx + 1}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {user?.id === q.userId && isInSubjectiveTopSix && (
                                                            <div className="text-xs text-success font-medium">
                                                                You are in the next subjective match!
                                                            </div>
                                                        )}

                                                        {isLead && idx < 6 && teamAssignments[idx] && (
                                                            <div
                                                                className="text-sm px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                                                                Team {teamAssignments[idx]}
                                                            </div>
                                                        )}

                                                        {idx < 6 && (
                                                            <div
                                                                className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">
                                                                Active
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex gap-3 items-center">
                                        {!isLead ? (
                                            !subjectiveActiveMatch ? (
                                                <Button
                                                    onClick={handleSubjectiveQueueToggle}
                                                    disabled={subjectiveQueueLoading}
                                                    className="flex-1"
                                                >
                                                    {isInSubjectiveQueue ? (
                                                        <Minus className="w-4 h-4 mr-2"/>
                                                    ) : (
                                                        <Plus className="w-4 h-4 mr-2"/>
                                                    )}
                                                    {isInSubjectiveQueue ? "Leave subjective queue" : "Join subjective queue"}
                                                </Button>
                                            ) : (
                                                <div className="flex-1 text-center text-sm text-muted-foreground">
                                                    Scouting in progress
                                                </div>
                                            )
                                        ) : subjectiveActiveMatch ? (
                                            subjectiveActiveMatch.startedBy === user?.id ? (
                                                <Button
                                                    onClick={handleEndSubjectiveMatch}
                                                    variant="destructive"
                                                    className="flex-1"
                                                    disabled={subjectiveQueueLoading}
                                                >
                                                    End subjective match
                                                </Button>
                                            ) : (
                                                <Button className="flex-1" disabled>
                                                    Subjective match running elsewhere
                                                </Button>
                                            )
                                        ) : (
                                            <Button
                                                onClick={handleStartSubjectiveMatch}
                                                disabled={
                                                    subjectiveQueueLoading ||
                                                    subjectiveTopSix.length === 0 ||
                                                    (subjectiveTopSix.length > 0 &&
                                                        !teamAssignments
                                                            .slice(0, Math.min(6, subjectiveTopSix.length))
                                                            .every((v) => /^\d{1,5}$/.test(v)))
                                                }
                                                className="flex-1"
                                            >
                                                <Play className="w-4 h-4 mr-2"/>
                                                Assign & Start subjective match
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isLead && subjectiveActiveMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Active Subjective Scouters</CardTitle>
                                    <CardDescription>
                                        Scouters currently scouting in the active subjective match
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {subjectiveActiveMatch.participants && Object.keys(subjectiveActiveMatch.participants).filter(key => !/^\d+$/.test(key)).length > 0 ? (
                                        <ul className="space-y-2">
                                            {Object.entries(subjectiveActiveMatch.participants)
                                                .filter(([key]) => !/^\d+$/.test(key))
                                                .map(([key, participant]: [string, any], idx: number) => (
                                                <li
                                                    key={key}
                                                    className="flex items-center justify-between p-2 rounded-md border bg-secondary/50"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                                                            {participant.name?.charAt(0)?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">
                                                                {participant.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Team {participant.assignedTeam || "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {idx < 6 && (
                                                        <div
                                                            className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
                                                            Scouting
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No scouters in the active subjective match
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {!isInSubjectiveScouting && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Start Manual Scouting Session</CardTitle>
                                    <CardDescription>
                                        Enter the team number you're scouting and begin
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="team-number">Team Number</Label>
                                        <Input
                                            id="team-number"
                                            type="text"
                                            placeholder="Enter team number"
                                            value={teamNumber}
                                            onChange={(e) => setTeamNumber(e.target.value)}
                                        />
                                    </div>

                                    {isLead || !isLead ? (
                                        <Button
                                            onClick={() => startScouting(undefined, {manual: true})}
                                            className="w-full"
                                            size="lg"
                                            disabled={!teamNumber.trim()}
                                        >
                                            <Play className="w-4 h-4 mr-2"/>
                                            Start Scouting
                                        </Button>
                                    ) : (
                                        <div className="w-full text-center text-sm text-muted-foreground">
                                            You will be started automatically when the lead assigns a
                                            team to you.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Autonomous Notes</CardTitle>
                                    <CardDescription>
                                        Record observations during autonomous period (available
                                        throughout match)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Enter your notes here..."
                                        value={autonomousNotes}
                                        onChange={(e) => setAutonomousNotes(e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Autonomous Fuel</CardTitle>
                                    <CardDescription>
                                        Fuel scored during autonomous period (editable throughout match)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <Label className="text-base font-medium">
                                                Autonomous Fuel
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                Current: {autonomousFuel}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAutonomousFuel((prev) => Math.max(0, prev - 1))}
                                            >
                                                -1
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAutonomousFuel((prev) => prev + 1)}
                                            >
                                                +1
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAutonomousFuel((prev) => prev + 3)}
                                            >
                                                +3
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAutonomousFuel((prev) => prev + 5)}
                                            >
                                                +5
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAutonomousFuel((prev) => prev + 10)}
                                            >
                                                +10
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Auto Climb</CardTitle>
                                    <CardDescription>Can this team climb?</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={autoClimb === "yes" ? "default" : "outline"}
                                            onClick={() => setAutoClimb("yes")}
                                        >
                                            Yes
                                        </Button>
                                        <Button
                                            variant={autoClimb === "no" ? "default" : "outline"}
                                            onClick={() => setAutoClimb("no")}
                                        >
                                            No
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Teleop Notes</CardTitle>
                                    <CardDescription>
                                        Record observations during teleop period
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Enter your notes here..."
                                        value={teleopNotes}
                                        onChange={(e) => setTeleopNotes(e.target.value)}
                                        className="min-h-[120px]"
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Teleop Fuel</CardTitle>
                                    <CardDescription>
                                        Fuel scored during teleop period
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <Label className="text-base font-medium">
                                                Teleop Fuel
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                Current: {teleopFuel}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTeleopFuel((prev) => Math.max(0, prev - 1))}
                                            >
                                                -1
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTeleopFuel((prev) => prev + 1)}
                                            >
                                                +1
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTeleopFuel((prev) => prev + 3)}
                                            >
                                                +3
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTeleopFuel((prev) => prev + 5)}
                                            >
                                                +5
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTeleopFuel((prev) => prev + 10)}
                                            >
                                                +10
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Teleop Climb</CardTitle>
                                    <CardDescription>Did the team successfully climb?</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2 mb-4">
                                        <Button
                                            variant={teleopClimb === "yes" ? "default" : "outline"}
                                            onClick={() => setTeleopClimb("yes")}
                                        >
                                            Yes
                                        </Button>
                                        <Button
                                            variant={teleopClimb === "no" ? "default" : "outline"}
                                            onClick={() => setTeleopClimb("no")}
                                        >
                                            No
                                        </Button>
                                    </div>
                                    {teleopClimb === "yes" && (
                                        <div>
                                            <div className="font-medium mb-2">Climb Level</div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={climbLevel === "L1" ? "default" : "outline"}
                                                    onClick={() => setClimbLevel("L1")}
                                                >
                                                    L1
                                                </Button>
                                                <Button
                                                    variant={climbLevel === "L2" ? "default" : "outline"}
                                                    onClick={() => setClimbLevel("L2")}
                                                >
                                                    L2
                                                </Button>
                                                <Button
                                                    variant={climbLevel === "L3" ? "default" : "outline"}
                                                    onClick={() => setClimbLevel("L3")}
                                                >
                                                    L3
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Defense Score</CardTitle>
                                    <CardDescription>Rate the team's defensive performance</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2">
                                        <Select value={defenseScore} onValueChange={setDefenseScore}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select Score"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">0 - None</SelectItem>
                                                <SelectItem value="1">1 - Poor</SelectItem>
                                                <SelectItem value="2">2 - Fair</SelectItem>
                                                <SelectItem value="3">3 - Good</SelectItem>
                                                <SelectItem value="4">4 - Excellent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeMatch && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Shooting on the Move & Robot Tipped</CardTitle>
                                    <CardDescription>
                                        Select Yes or No for each
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4">
                                        <div className="font-medium mb-2">Shooting on the Move (SOTM)</div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant={sotm === "yes" ? "default" : "outline"}
                                                onClick={() => setSotm("yes")}
                                            >
                                                Yes
                                            </Button>
                                            <Button
                                                variant={sotm === "no" ? "default" : "outline"}
                                                onClick={() => setSotm("no")}
                                            >
                                                No
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-medium mb-2">Robot Tipped</div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant={robotTipped === "yes" ? "default" : "outline"}
                                                onClick={() => setRobotTipped("yes")}
                                            >
                                                Yes
                                            </Button>
                                            <Button
                                                variant={robotTipped === "no" ? "default" : "outline"}
                                                onClick={() => setRobotTipped("no")}
                                            >
                                                No
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isInSubjectiveScouting && subjectiveActiveMatch && (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Subjective Scouting - Team {subjectiveTeamNumber}</CardTitle>
                                        <CardDescription>
                                            Answer the following questions about this team's robot and strategy
                                        </CardDescription>
                                    </CardHeader>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Robot Performance and Strategy</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="autonomous-effectiveness" className="text-base font-medium">
                                                How effective is their robot during the Autonomous period?
                                            </Label>
                                            <Input
                                                id="autonomous-effectiveness"
                                                placeholder="e.g., Not Effective, Somewhat Effective, Very Effective"
                                                value={autonomousEffectiveness}
                                                onChange={(e) => setAutonomousEffectiveness(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="quick-score" className="text-base font-medium">
                                                Can their robot quickly score fuels?
                                            </Label>
                                            <Input
                                                id="quick-score"
                                                placeholder="e.g., Yes, No, or description"
                                                value={canQuicklyScore}
                                                onChange={(e) => setCanQuicklyScore(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="can-climb" className="text-base font-medium">
                                                Is their robot able to climb? If so, what level (L1, L2, L3)?
                                            </Label>
                                            <Input
                                                id="can-climb"
                                                placeholder="e.g., Yes - L1, No, or description"
                                                value={canClimb}
                                                onChange={(e) => setCanClimb(e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Team Dynamics</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="pressure-performance" className="text-base font-medium">
                                                Do they perform well under pressure and falter?
                                            </Label>
                                            <Input
                                                id="pressure-performance"
                                                placeholder="e.g., Perform well under pressure, Falter under pressure, Neutral"
                                                value={performanceUnderPressure}
                                                onChange={(e) => setPerformanceUnderPressure(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="team-focus" className="text-base font-medium">
                                                Do they focus on scoring, passing, defense, or a mix?
                                            </Label>
                                            <Input
                                                id="team-focus"
                                                placeholder="e.g., Scoring focused, Balanced mix, Defense oriented"
                                                value={teamFocus}
                                                onChange={(e) => setTeamFocus(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="driver-sync" className="text-base font-medium">
                                                How synchronized are their drivers and human players?
                                            </Label>
                                            <Input
                                                id="driver-sync"
                                                placeholder="e.g., Highly synchronized, Room for improvement, Needs work"
                                                value={driverSynchronization}
                                                onChange={(e) => setDriverSynchronization(e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Tactical Insights</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="defensive-strategy" className="text-base font-medium">
                                                How do they defend against scoring attempts (if they defend)?
                                            </Label>
                                            <Input
                                                id="defensive-strategy"
                                                placeholder="e.g., Aggressive pushing, Blocking strategy, Minimal defense"
                                                value={defensiveStrategy}
                                                onChange={(e) => setDefensiveStrategy(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="blocking-effectiveness" className="text-base font-medium">
                                                How effectively can they block or disrupt scoring (if they defend)?
                                            </Label>
                                            <Input
                                                id="blocking-effectiveness"
                                                placeholder="e.g., Very effective, Moderately effective, Ineffective"
                                                value={blockingEffectiveness}
                                                onChange={(e) => setBlockingEffectiveness(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="ally-cooperation" className="text-base font-medium">
                                                How well do they work their allies for combined strategies (constantly
                                                bumping or getting in their way)?
                                            </Label>
                                            <Input
                                                id="ally-cooperation"
                                                placeholder="e.g., Great teamwork, Often interferes, Gets in the way"
                                                value={allyCooperation}
                                                onChange={(e) => setAllyCooperation(e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Misc</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="defensive-skill" className="text-base font-medium">
                                                Do they seem experienced with playing defense?
                                            </Label>
                                            <Input
                                                id="defensive-skill"
                                                placeholder="e.g., Yes, No, A little"
                                                value={defensiveSkill}
                                                onChange={(e) => setDefensiveSkill(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="robot-reliability" className="text-base font-medium">
                                                Was the robot reliable during the entire match?
                                            </Label>
                                            <Input
                                                id="robot-reliability"
                                                placeholder="e.g., Dead, Stuck, Tipped"
                                                value={robotReliablity}
                                                onChange={(e) => setRobotReliability(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="robot-penalties" className="text-base font-medium">
                                                Did they receive any penalties?
                                            </Label>
                                            <Input
                                                id="robot-penalties"
                                                placeholder="e.g., Red Card, Yellow Card"
                                                value={robotPenalties}
                                                onChange={(e) => setRobotPenalties(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="auto-fuel" className="text-base font-medium">
                                                Did they score more than eight fuel?
                                            </Label>
                                            <Input
                                                id="auto-fuel"
                                                placeholder="e.g., Yes, No, 10+"
                                                value={autoFuel}
                                                onChange={(e) => setAutoFuel(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="auto-climb" className="text-base font-medium">
                                                Did they climb during auto?
                                            </Label>
                                            <Input
                                                id="auto-climb"
                                                placeholder="e.g., No, L1, L2, L3"
                                                value={autoClimb1}
                                                onChange={(e) => setAutoClimb1(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="teleop-passing" className="text-base font-medium">
                                                Can they pass?
                                            </Label>
                                            <Input
                                                id="teleop-passing"
                                                placeholder="e.g., Yes, No, Sometimes"
                                                value={teleopPassing}
                                                onChange={(e) => setTeleopPassing(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label htmlFor="game-sense" className="text-base font-medium">
                                                Do you think they have game sense?
                                            </Label>
                                            <Input
                                                id="game-sense"
                                                placeholder="e.g., Yes, No, A little"
                                                value={gameSense}
                                                onChange={(e) => setGameSense(e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Submit Subjective Scouting</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Button
                                            onClick={resetSubjectiveScouting}
                                            className="w-full"
                                        >
                                            Submit Subjective Scouting
                                        </Button>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Scouting;
