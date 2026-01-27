import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, Plus, Minus, Play, Pause, Bell, Search, User, LogOut, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


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
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [phase, setPhase] = useState<ScoutingPhase>("idle");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [teamNumber, setTeamNumber] = useState("");
  
  // Autonomous data
  const [autonomousNotes, setAutonomousNotes] = useState("");
  const [autonomousFuel, setAutonomousFuel] = useState(0);
  const [canClimb, setCanClimb] = useState(false);
  
  // Transition shift fuel tracking
  const [transitionFuel, setTransitionFuel] = useState(0);
  
  // Alliance shift fuel tracking
  const [allianceShiftFuel, setAllianceShiftFuel] = useState([0, 0, 0, 0]);
  
  // End game data
  const [endGameNotes, setEndGameNotes] = useState("");
  const [didClimb, setDidClimb] = useState(false);
  const [climbLevel, setClimbLevel] = useState("");

  
  // Track when autonomous ends to show climb button for 5 seconds
  const [showClimbButton, setShowClimbButton] = useState(false);
  const climbButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cancel confirmation state
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const startScouting = () => {
    if (!teamNumber.trim()) {
      alert("Please enter a team number");
      return;
    }
    setPhase("autonomous");
    setTimeRemaining(PHASE_DURATIONS.AUTONOMOUS);
    setIsTimerRunning(true);
    // Reset all data
    setAutonomousNotes("");
    setAutonomousFuel(0);
    setCanClimb(false);
    setAllianceShiftFuel([0, 0, 0, 0]);
    setEndGameNotes("");
    setDidClimb(false);
  };


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

  const addFuel = () => {
    if (isTransitionPhase) {
      setTransitionFuel((prev) => prev + 1);
    } else {
      const shiftIndex = getCurrentAllianceShiftIndex();
      if (shiftIndex >= 0) {
        setAllianceShiftFuel((prev) => {
          const newFuel = [...prev];
          newFuel[shiftIndex] = newFuel[shiftIndex] + 1;
          return newFuel;
        });
      }
    }
  };

  const removeFuel = () => {
    if (isTransitionPhase) {
      setTransitionFuel((prev) => Math.max(0, prev - 1));
    } else {
      const shiftIndex = getCurrentAllianceShiftIndex();
      if (shiftIndex >= 0 && allianceShiftFuel[shiftIndex] > 0) {
        setAllianceShiftFuel((prev) => {
          const newFuel = [...prev];
          newFuel[shiftIndex] = newFuel[shiftIndex] - 1;
          return newFuel;
        });
      }
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

  const resetScouting = () => {
    setPhase("idle");
    setIsTimerRunning(false);
    setTimeRemaining(0);
    setTeamNumber("");
    setAutonomousNotes("");
    setAutonomousFuel(0);
    setCanClimb(false);
    setTransitionFuel(0);
    setAllianceShiftFuel([0, 0, 0, 0]);
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
  const isTransitionPhase = phase === "transition";
  const isAllianceShiftPhase = phase === "alliance_shift_1" || phase === "alliance_shift_2" || phase === "alliance_shift_3" || phase === "alliance_shift_4";
  const isEndGamePhase = phase === "end_game";
  const isComplete = phase === "complete";
  const isActivePhase = phase !== "idle" && phase !== "complete";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search teams, matches, data..."
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{user?.name || "Scout"}</p>
                  <p className="text-xs text-muted-foreground">Team {user?.teamNumber || 955}</p>
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
                <h2 className="font-mono font-bold text-foreground text-2xl">Scouting</h2>
                <p className="text-muted-foreground mt-1">Scout for Team 955</p>
              </div>
            </div>

            {/* Start Scouting Card */}
            {phase === "idle" && (
              <Card>
                <CardHeader>
                  <CardTitle>Start Scouting Session</CardTitle>
                  <CardDescription>Enter the team number you're scouting and begin</CardDescription>
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
                  <Button onClick={startScouting} className="w-full" size="lg" disabled={!teamNumber.trim()}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Scouting
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Timer Card */}
            {isActivePhase && (
              <Card className={isTimerRunning ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        {getPhaseName(phase)}
                        {teamNumber && (
                          <span className="text-sm font-normal text-muted-foreground">
                            - Team {teamNumber}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {isTimerRunning
                          ? "Timer is running"
                          : phase === "complete"
                          ? "Scouting session complete"
                          : "Timer paused - click resume to continue"}
                      </CardDescription>
                    </div>
                    {!isComplete && (
                      <Button
                        onClick={handleCancelClick}
                        variant={cancelConfirm ? "destructive" : "outline"}
                        size="sm"
                        className={cancelConfirm ? "bg-destructive hover:bg-destructive/90" : ""}
                      >
                        <X className="w-4 h-4 mr-2" />
                        {cancelConfirm ? "Are you sure? Click again to cancel" : "Cancel Scouting"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div
                      className={`text-6xl font-mono font-bold ${
                        isTimerRunning ? "text-primary" : "text-muted-foreground"
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
                    ) : !isComplete && (
                      <Button
                        onClick={resumeTimer}
                        variant="outline"
                        className="mt-4"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Resume Timer
                      </Button>
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
                  <CardDescription>Record observations during autonomous period (available throughout match)</CardDescription>
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
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Autonomous Fuel</CardTitle>
                    <CardDescription>Fuel scored during autonomous period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="autonomous-fuel">Fuel Scored</Label>
                      <Input
                        id="autonomous-fuel"
                        type="number"
                        min="0"
                        value={autonomousFuel}
                        onChange={(e) => setAutonomousFuel(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Climb Capability - Show during autonomous and 5 seconds after autonomous ends */}
            {(isAutonomousPhase || (isTransitionPhase && timeRemaining >= PHASE_DURATIONS.TRANSITION - 5)) && (
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

            {/* Transition Phase - Fuel tracking */}
            {isTransitionPhase && (
              <Card>
                <CardHeader>
                  <CardTitle>Transition Shift Fuel Tracking</CardTitle>
                  <CardDescription>Track fuel scored during transition shift</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base font-medium">
                          Transition Shift Fuel
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Current: {transitionFuel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={removeFuel}
                          disabled={transitionFuel === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={addFuel}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Alliance Shift Phase Content */}
            {isAllianceShiftPhase && (
              <Card>
                <CardHeader>
                  <CardTitle>Alliance Shift Fuel Tracking</CardTitle>
                  <CardDescription>
                    Track fuel scored during {getPhaseName(phase).toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label className="text-base font-medium">
                          {getPhaseName(phase)} Fuel
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Current: {allianceShiftFuel[getCurrentAllianceShiftIndex()]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={removeFuel}
                          disabled={allianceShiftFuel[getCurrentAllianceShiftIndex()] === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={addFuel}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* End Game Phase Content */}
            {isEndGamePhase && (
        <>
          {/* End Game Notes */}
          <Card>
            <CardHeader>
              <CardTitle>End Game Notes</CardTitle>
              <CardDescription>
                Record observations during end game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter your notes here..."
                value={endGameNotes}
                onChange={(e) => setEndGameNotes(e.target.value)}
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

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
                    setDidClimb(checked)
                    if (!checked) setClimbLevel("")
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
                <Select
                  value={climbLevel}
                  onValueChange={setClimbLevel}
                >
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
                      <p className="text-sm text-muted-foreground">Autonomous Fuel</p>
                      <p className="text-2xl font-bold">{autonomousFuel}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Transition Fuel</p>
                      <p className="text-2xl font-bold">{transitionFuel}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Alliance Fuel</p>
                      <p className="text-2xl font-bold">
                        {allianceShiftFuel.reduce((a, b) => a + b, 0)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Fuel</p>
                      <p className="text-2xl font-bold">
                        {autonomousFuel + transitionFuel + allianceShiftFuel.reduce((a, b) => a + b, 0)}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Can Climb</p>
                      <p className="text-2xl font-bold">{canClimb ? "Yes" : "No"}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Did Climb</p>
                      <p className="text-2xl font-bold">{didClimb ? "Yes" : "No"}</p>
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
