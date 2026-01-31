import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clock,
  Plus,
  Minus,
  Play,
  Pause,
  Bell,
  Search,
  User,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import { useQueue } from "@/hooks/use-queue";
import { subscribeToUserAssignment } from "@/lib/queue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDatabase,
  ref,
  set,
  serverTimestamp,
  remove,
} from "firebase/database";
import { get } from "firebase/database";

const PHASE_DURATIONS = {
  AUTONOMOUS: 20,
  TRANSITION: 10,
  ALLIANCE_SHIFT: 25,
  END_GAME: 30,
};

type ScoutingPhase =
  | "idle"
  | "autonomous"
  | "transition"
  | "alliance_shift_1"
  | "alliance_shift_2"
  | "alliance_shift_3"
  | "alliance_shift_4"
  | "end_game"
  | "complete";

const Scouting = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("scouting");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "dashboard") {
      navigate("/");
    } else if (tab === "scouting") {
      navigate("/scouting");
    } else if (tab === "analytics") {
      navigate("/analytics");
    } else if (tab === "matches") {
      navigate("/matches");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // queue + role helpers
  const isLeadName = (name?: string) => !!name && /\blead\b/i.test(name);
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
  } = useQueue(user ? { id: user.id, name: user.name } : null);
  const isLead = isLeadName(user?.name);

  const handleQueueToggle = async () => {
    try {
      if (isInQueue) {
        await leave();
      } else {
        await join();
      }
    } catch (err) {
      console.error(err);
      alert((err as Error)?.message || "Queue error");
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

  const setAssignment = (index: number, value: string) => {
    setTeamAssignments((prev) => {
      const copy = [...prev];
      copy[index] = value.replace(/[^0-9]/g, "").slice(0, 5); // numeric, max 5 digits
      return copy;
    });
  };

  const validAssignment = (s: string) => /^\d{1,5}$/.test(s);
  const handleStartMatch = async () => {
    try {
      // prevent starting if another match is already active
      if (activeMatch) {
        alert("A match is already running — end it before starting a new one.");
        return;
      }

      // for active slots, require an assignment if there's someone queued
      const required = Math.min(6, topSix.length);
      const assigned = teamAssignments.slice(0, required);
      const invalid = assigned.some((v) => !validAssignment(v));
      if (required > 0 && invalid) {
        alert(
          "Please enter valid team numbers for the active slots (numbers only)",
        );
        return;
      }

      const matchId = await start(assigned);
      alert(`Match started — id: ${matchId}`);
      // clear inputs after start
      setTeamAssignments(["", "", "", "", "", ""]);
    } catch (err) {
      console.error(err);
      alert((err as Error)?.message || "Failed to start match");
    }
  };

  const handleEndMatch = async () => {
    try {
      if (!activeMatch?.id) return alert("No active match to end");
      await endMatch(activeMatch.id);
    } catch (err) {
      console.error(err);
      alert((err as Error)?.message || "Failed to end match");
    }
  };

  const [phase, setPhase] = useState<ScoutingPhase>("idle");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [teamNumber, setTeamNumber] = useState("");

  // Autonomous data
  const [autonomousNotes, setAutonomousNotes] = useState("");
  const [autonomousFuel, setAutonomousFuel] = useState(0);
  const [canClimb, setCanClimb] = useState(false);

  // Teleop fuel tracking
  const [teleopNotes, setTeleopNotes] = useState("");
  const [teleopFuel, setTeleopFuel] = useState(0);

  // End game data
  const [endGameNotes, setEndGameNotes] = useState("");
  const [didClimb, setDidClimb] = useState(false);
  const [climbLevel, setClimbLevel] = useState("");
  const [defenseScore, setDefenseScore] = useState("");

  // Track when autonomous ends to show climb button for 5 seconds
  const [showClimbButton, setShowClimbButton] = useState(false);
  const climbButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel confirmation state
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentMatchIdRef = useRef<string | null>(null);
  const assignedTeamRef = useRef<string | null>(null);

  const matchEndedHandledRef = useRef(false);

  const getPhaseDuration = (currentPhase: ScoutingPhase): number => {
    switch (currentPhase) {
      case "autonomous":
        return PHASE_DURATIONS.AUTONOMOUS;
      case "transition":
        return PHASE_DURATIONS.TRANSITION;
      case "alliance_shift_1":
      case "alliance_shift_2":
      case "alliance_shift_3":
      case "alliance_shift_4":
        return PHASE_DURATIONS.ALLIANCE_SHIFT;
      case "end_game":
        return PHASE_DURATIONS.END_GAME;
      default:
        return 0;
    }
  };

  const getPhaseName = (currentPhase: ScoutingPhase): string => {
    switch (currentPhase) {
      case "autonomous":
        return "Autonomous Period";
      case "transition":
        return "Transition Shift";
      case "alliance_shift_1":
        return "Alliance Shift 1";
      case "alliance_shift_2":
        return "Alliance Shift 2";
      case "alliance_shift_3":
        return "Alliance Shift 3";
      case "alliance_shift_4":
        return "Alliance Shift 4";
      case "end_game":
        return "End Game";
      default:
        return "";
    }
  };

  const advancePhase = useCallback(() => {
    setPhase((current) => {
      let nextPhase: ScoutingPhase;
      let nextDuration: number = 0;

      switch (current) {
        case "autonomous":
          nextPhase = "transition";
          nextDuration = PHASE_DURATIONS.TRANSITION;
          break;
        case "transition":
          nextPhase = "alliance_shift_1";
          nextDuration = PHASE_DURATIONS.ALLIANCE_SHIFT;
          break;
        case "alliance_shift_1":
          nextPhase = "alliance_shift_2";
          nextDuration = PHASE_DURATIONS.ALLIANCE_SHIFT;
          break;
        case "alliance_shift_2":
          nextPhase = "alliance_shift_3";
          nextDuration = PHASE_DURATIONS.ALLIANCE_SHIFT;
          break;
        case "alliance_shift_3":
          nextPhase = "alliance_shift_4";
          nextDuration = PHASE_DURATIONS.ALLIANCE_SHIFT;
          break;
        case "alliance_shift_4":
          nextPhase = "end_game";
          nextDuration = PHASE_DURATIONS.END_GAME;
          break;
        case "end_game":
          nextPhase = "complete";
          break;
        default:
          return current;
      }

      // Auto-start the next phase timer
      if (nextPhase !== "complete") {
        setTimeout(() => {
          setTimeRemaining(nextDuration);
          setIsTimerRunning(true);
        }, 100);
      }

      return nextPhase;
    });
  }, []);

  // Show climb button for 5 seconds when phase changes to transition
  useEffect(() => {
    if (phase === "transition") {
      // Clear any existing timeout first
      if (climbButtonTimeoutRef.current) {
        clearTimeout(climbButtonTimeoutRef.current);
        climbButtonTimeoutRef.current = null;
      }
      // Show the button immediately
      setShowClimbButton(true);
      // Hide it after 5 seconds
      climbButtonTimeoutRef.current = setTimeout(() => {
        setShowClimbButton(false);
        climbButtonTimeoutRef.current = null;
      }, 5000);
    } else {
      // Hide button when phase changes away from transition
      setShowClimbButton(false);
      if (climbButtonTimeoutRef.current) {
        clearTimeout(climbButtonTimeoutRef.current);
        climbButtonTimeoutRef.current = null;
      }
    }
  }, [phase]);

  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            advancePhase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerRunning, timeRemaining, advancePhase]);

  const startScouting = (teamNum?: string) => {
    const effectiveTeam = (
      typeof teamNum === "string" ? teamNum : teamNumber
    ).trim();
    if (!effectiveTeam) {
      alert("Please enter a team number");
      return;
    }

    // ensure UI reflects the team number immediately
    if (teamNum) setTeamNumber(String(teamNum));

    setPhase("autonomous");
    setTimeRemaining(PHASE_DURATIONS.AUTONOMOUS);
    setIsTimerRunning(true);
    // Reset all data
    setAutonomousNotes("");
    setAutonomousFuel(0);
    setCanClimb(false);
    setTeleopNotes("");
    setTeleopFuel(0);
    setDefenseScore("");
    setEndGameNotes("");
    setDidClimb(false);
  };

  // Auto-start when assigned by a lead: subscribe to our /users/{id}/currentAssignment
  const lastProcessedAssignmentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;

    const unsub = subscribeToUserAssignment(user.id, (assignment) => {
      if (!assignment) {
        if (!matchEndedHandledRef.current && phase !== "idle") {
          matchEndedHandledRef.current = true;
          alert(
            "The lead has signaled the end of the match. Please finish and submit your scouting.",
          );
        }
        return;
      }

      currentMatchIdRef.current = assignment.matchId;
      assignedTeamRef.current = String(assignment.teamNumber);

      matchEndedHandledRef.current = false;

      if (phase === "idle") {
        startScouting(String(assignment.teamNumber));
      }
    });

    return unsub;
  }, [user?.id, phase]);

  const pauseTimer = () => {
    setIsTimerRunning(false);
  };

  const resumeTimer = () => {
    setIsTimerRunning(true);
  };

  const getCurrentAllianceShiftIndex = (): number => {
    switch (phase) {
      case "alliance_shift_1":
        return 0;
      case "alliance_shift_2":
        return 1;
      case "alliance_shift_3":
        return 2;
      case "alliance_shift_4":
        return 3;
      default:
        return -1;
    }
  };
  useEffect(() => {
    if (phase !== "complete" || !activeMatch?.id || !user?.id) return;

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
          (p: any) => !p.submittedAt,
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
  }, [phase, activeMatch?.id, user?.id, endMatch]);

  const addFuel = () => {
    if (isAutonomousPhase) {
      setAutonomousFuel((prev) => prev + 1);
    } else if (isTeleopPhase) {
      setTeleopFuel((prev) => prev + 1);
    }
  };

  const removeFuel = () => {
    if (isAutonomousPhase) {
      setAutonomousFuel((prev) => Math.max(0, prev - 1));
    } else if (isTeleopPhase) {
      setTeleopFuel((prev) => Math.max(0, prev - 1));
    }
  };

  const handleCancelClick = () => {
    if (!cancelConfirm) {
      // First click - show confirmation
      setCancelConfirm(true);
      // Reset confirmation after 3 seconds if not clicked again
      if (cancelTimeoutRef.current) {
        clearTimeout(cancelTimeoutRef.current);
      }
      cancelTimeoutRef.current = setTimeout(() => {
        setCancelConfirm(false);
      }, 3000);
    } else {
      // Second click - actually cancel
      resetScouting();
      setCancelConfirm(false);
      if (cancelTimeoutRef.current) {
        clearTimeout(cancelTimeoutRef.current);
        cancelTimeoutRef.current = null;
      }
    }
  };

  const resetScouting = async () => {
    try {
      const matchId = currentMatchIdRef.current;
      const assignedTeam = assignedTeamRef.current;

      if (!matchId || !user?.id || !assignedTeam) {
        console.warn("resetScouting: missing matchId, user, or assignedTeam");
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
          canClimb,
        },

        teleop: {
          fuel: teleopFuel,
          notes: teleopNotes,
        },

        endGame: {
          didClimb,
          climbLevel: didClimb ? climbLevel : null,
          defenseScore,
          notes: endGameNotes,
        },
      });
      await remove(ref(db, `users/${user.id}/currentAssignment`));
    } catch (err) {
      console.error("Failed to submit scouting data:", err);
      alert("Failed to save scouting data. Please notify a lead.");
    }

    setPhase("idle");
    setIsTimerRunning(false);
    setTimeRemaining(0);
    setTeamNumber("");
    setAutonomousNotes("");
    setAutonomousFuel(0);
    setCanClimb(false);
    setTeleopFuel(0);
    setTeleopNotes("");
    setDefenseScore("");
    setEndGameNotes("");
    setDidClimb(false);
    setShowClimbButton(false);
    setCancelConfirm(false);

    if (climbButtonTimeoutRef.current) {
      clearTimeout(climbButtonTimeoutRef.current);
      climbButtonTimeoutRef.current = null;
    }
    if (cancelTimeoutRef.current) {
      clearTimeout(cancelTimeoutRef.current);
      cancelTimeoutRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isAutonomousPhase = phase === "autonomous";
  const isTeleopPhase =
    phase === "transition" ||
    phase === "alliance_shift_1" ||
    phase === "alliance_shift_2" ||
    phase === "alliance_shift_3" ||
    phase === "alliance_shift_4" ||
    phase === "end_game";
  const isTransitionPhase = phase === "transition";
  const isAllianceShiftPhase =
    phase === "alliance_shift_1" ||
    phase === "alliance_shift_2" ||
    phase === "alliance_shift_3" ||
    phase === "alliance_shift_4";
  const isEndGamePhase = phase === "end_game";
  const isComplete = phase === "complete";
  const isActivePhase = phase !== "idle" && phase !== "complete";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <main
        className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Drawer>
                  <DrawerTrigger>
                    <button className="p-2">
                      <Menu className="w-5 h-5" />
                    </button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <MobileSidebarContent
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                    />
                  </DrawerContent>
                </Drawer>
              </div>
              <div className="hidden md:block relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search teams, matches, data..."
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.name || "Scout"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team {user?.teamNumber || 955}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono font-bold text-foreground text-2xl">
                  Scouting
                </h2>
                <p className="text-muted-foreground mt-1">Scout for Team 955</p>
              </div>
            </div>

            {(isLead || (phase === "idle" && !activeMatch)) && (
              /* Match Queue (lead: start match, others: join queue) */
              <Card>
                <CardHeader>
                  <CardTitle>Match Queue</CardTitle>
                  <CardDescription>
                    First 6 in the queue will be selected to start scouting
                    (real-time)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* queue list + status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Live queue — ordered by join time
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Active slots: 6
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
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
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
                                You are in the active 6
                              </div>
                            )}

                            {/* Lead preview: show assigned team number for active slots */}
                            {isLead && idx < 6 && teamAssignments[idx] && (
                              <div className="text-sm px-2 py-1 rounded-md bg-amber-50 text-amber-700">
                                Team {teamAssignments[idx]}
                              </div>
                            )}

                            {idx < 6 && (
                              <div className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary">
                                Active
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Lead: team-number assignment inputs */}
                  {isLead && (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-6">
                            #{i + 1}
                          </label>
                          <Input
                            aria-label={`Team number ${i + 1}`}
                            value={teamAssignments[i]}
                            onChange={(e) => setAssignment(i, e.target.value)}
                            className="w-28"
                            placeholder="team #"
                            inputMode="numeric"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 items-center">
                    {!isLead ? (
                      phase === "idle" && !activeMatch ? (
                        <Button
                          onClick={handleQueueToggle}
                          disabled={queueLoading}
                          className="flex-1"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {isInQueue ? "Leave queue" : "Join queue"}
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
                        <Play className="w-4 h-4 mr-2" />
                        Assign & Start match
                      </Button>
                    )}

                    <div className="w-48 text-right text-sm text-muted-foreground">
                      {isLead ? (
                        <div>
                          Lead controls — assign teams to the active 6 and start
                          match
                        </div>
                      ) : (
                        <div>
                          {isInTopSix
                            ? "You're in the active 6"
                            : "First 6 will be selected automatically"}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Start Scouting Card */}
            {phase === "idle" && (
              <Card>
                <CardHeader>
                  <CardTitle>Start Scouting Session</CardTitle>
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

                  {isLead ? (
                    <Button
                      onClick={() => startScouting()}
                      className="w-full"
                      size="lg"
                      disabled={!teamNumber.trim()}
                    >
                      <Play className="w-4 h-4 mr-2" />
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

            {isActivePhase && (
              <Card>
                <CardHeader>
                  <div className="flex-1">
                    <CardTitle>
                      <span
                        className="text-2xl sm:text-[1.25rem] font-mono font-bold whitespace-normal leading-snug block"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {getPhaseName(phase)}
                      </span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isTimerRunning
                        ? "Timer is running"
                        : isComplete
                          ? "Scouting session complete"
                          : "Timer paused - click resume to continue"}
                    </CardDescription>
                  </div>

                  <div className="ml-4 flex flex-col items-end justify-start shrink-0">
                    {teamNumber && (
                      <div className="text-sm font-normal text-muted-foreground mb-2 whitespace-nowrap">
                        Team {teamNumber}
                      </div>
                    )}
                    {!isComplete && (
                      <div className="hidden sm:block">
                        <Button
                          onClick={handleCancelClick}
                          variant={cancelConfirm ? "destructive" : "outline"}
                          size="sm"
                          className={`${
                            cancelConfirm
                              ? "bg-destructive hover:bg-destructive/90"
                              : ""
                          } whitespace-normal text-left leading-tight flex items-center gap-2 h-auto py-2 max-w-[320px]`}
                        >
                          <span className="flex-shrink-0">
                            <X className="w-4 h-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            {cancelConfirm
                              ? "Are you sure? Click again to cancel"
                              : "Cancel Scouting"}
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Mobile: show cancel button below header so it doesn't overflow */}
                  {!isComplete && (
                    <div className="sm:hidden mb-4">
                      <Button
                        onClick={handleCancelClick}
                        variant={cancelConfirm ? "destructive" : "outline"}
                        size="sm"
                        className={`w-full ${cancelConfirm ? "bg-destructive hover:bg-destructive/90" : ""} whitespace-normal text-center leading-tight flex items-center justify-center gap-2 h-auto py-2`}
                      >
                        <span className="flex-shrink-0">
                          <X className="w-4 h-4" />
                        </span>
                        <span>
                          {cancelConfirm
                            ? "Are you sure? Click again to cancel"
                            : "Cancel Scouting"}
                        </span>
                      </Button>
                    </div>
                  )}
                  <div className="text-center py-4">
                    <div
                      className={`text-6xl font-mono font-bold ${
                        isTimerRunning
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                    {isTimerRunning ? (
                      <Button
                        onClick={pauseTimer}
                        variant="outline"
                        className="mt-4"
                        size="sm"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Timer
                      </Button>
                    ) : (
                      !isComplete && (
                        <Button
                          onClick={resumeTimer}
                          variant="outline"
                          className="mt-4"
                          size="sm"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Resume Timer
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Autonomous Notes - Available throughout match */}
            {isActivePhase && (
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

            {/* Autonomous Phase Content */}
            {isAutonomousPhase && (
              <Card>
                <CardHeader>
                  <CardTitle>Autonomous Fuel</CardTitle>
                  <CardDescription>
                    Fuel scored during autonomous period
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={removeFuel}
                        disabled={autonomousFuel === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={addFuel}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Teleop Notes - Available throughout match */}
            {isActivePhase && (
              <Card>
                <CardHeader>
                  <CardTitle>Teleop Notes</CardTitle>
                  <CardDescription>
                    Record observations during teleop period (available
                    throughout match)
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

            {/* Climb Capability - Show during autonomous and 5 seconds after autonomous ends */}
            {(isAutonomousPhase ||
              (isTransitionPhase &&
                timeRemaining >= PHASE_DURATIONS.TRANSITION - 5)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Climb Capability</CardTitle>
                  <CardDescription>Can this team climb?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can-climb"
                      checked={canClimb}
                      onCheckedChange={setCanClimb}
                    />
                    <Label htmlFor="can-climb" className="cursor-pointer">
                      {canClimb ? "Yes, can climb" : "No, cannot climb"}
                    </Label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Teleop Phase - Fuel tracking */}
            {isTeleopPhase && (
              <Card>
                <CardHeader>
                  <CardTitle>Teleop Fuel</CardTitle>
                  <CardDescription>
                    Fuel scored during transition, alliance shifts, and end game
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={removeFuel}
                        disabled={teleopFuel === 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={addFuel}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isEndGamePhase && (
              <>
                {/* Climb Completion */}
                <Card>
                  <CardHeader>
                    <CardTitle>Climb Completion</CardTitle>
                    <CardDescription>
                      Did the team successfully climb?
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="did-climb"
                        checked={didClimb}
                        onCheckedChange={(checked) => {
                          setDidClimb(checked);
                          if (!checked) setClimbLevel("");
                        }}
                      />
                      <Label htmlFor="did-climb" className="cursor-pointer">
                        {didClimb
                          ? "Yes, climbed successfully"
                          : "No, did not climb"}
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Climb Level Dropdown */}
                {didClimb && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Climb Level</CardTitle>
                      <CardDescription>
                        Select the achieved climb level
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={climbLevel} onValueChange={setClimbLevel}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L1">L1</SelectItem>
                          <SelectItem value="L2">L2</SelectItem>
                          <SelectItem value="L3">L3</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                )}
                {/* Defense Score */}
                <Card>
                  <CardHeader>
                    <CardTitle>Defense Score</CardTitle>
                    <CardDescription>
                      Rate the team's defensive performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={defenseScore}
                      onValueChange={setDefenseScore}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select score" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Poor</SelectItem>
                        <SelectItem value="2">2 - Fair</SelectItem>
                        <SelectItem value="3">3 - Good</SelectItem>
                        <SelectItem value="4">4 - Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Complete State */}
            {isComplete && (
              <Card>
                <CardHeader>
                  <CardTitle>Scouting Complete!</CardTitle>
                  <CardDescription>
                    All phases completed for Team {teamNumber}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Autonomous Fuel
                      </p>
                      <p className="text-2xl font-bold">{autonomousFuel}</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Auto Climb?
                      </p>
                      <p className="text-2xl font-bold">
                        {canClimb ? "Yes" : "No"}
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Teleop Fuel
                      </p>
                      <p className="text-2xl font-bold">{teleopFuel}</p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Teleop Climb?
                      </p>
                      <p className="text-2xl font-bold">
                        {didClimb ? "Yes" : "No"}
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Total Fuel
                      </p>
                      <p className="text-2xl font-bold">
                        {autonomousFuel + teleopFuel}
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Climb Level
                      </p>
                      <p className="text-2xl font-bold">
                        {didClimb ? climbLevel || "N/A" : "N/A"}
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Defense Score
                      </p>
                      <p className="text-2xl font-bold">
                        {defenseScore || "N/A"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={resetScouting}
                    variant="outline"
                    className="w-full"
                  >
                    Start New Scouting Session
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scouting;
