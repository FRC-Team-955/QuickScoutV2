import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Input} from "@/components/ui/input";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {get, ref} from "firebase/database";
import {db} from "@/lib/firebase";
import {isOSFData, OSF_DATE_RANGE} from "@/lib/dateUtils";
import {
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip as ReTooltip,
    XAxis,
    YAxis,
    ZAxis,
} from "recharts";

type Filters = {
    sortBy:
        | "newest"
        | "highest_score_auto"
        | "highest_score_teleop"
        | "highest_total_score"
        | "highest_climb"
        | "best_defense";
};

export type MatchEntry = {
    id: string;
    matchKey: string;
    station: string;
    teamNumber: number;
    scoutName: string;
    score_auto: number;
    score_teleop: number;
    total_score: number;
    climb: string;
    climbValue: number;
    defense_rating: string;
    defense_rating_value: number;
    robotTipped?: boolean;
    robotDead?: boolean;
    submittedAt: number;
};

export type PitScoutingEntry = {
    id: string;
    teamNumber: number;
    scoutName: string;
    scoutId: string;
    responses: Record<string, unknown>;
    submittedAt: number;
};

export type SubjectiveScoutingEntry = {
    id: string;
    matchId: string;
    teamNumber: string;
    scoutName: string;
    userId: string;
    robotPerformance: {
        autonomousEffectiveness: string;
        canQuicklyScore: string;
        canClimb: string;
        climbLevel?: string | null;
    };
    teamDynamics: {
        performanceUnderPressure: string;
        teamFocus: string;
        driverSynchronization: string;
    };
    tacticalInsights: {
        defensiveStrategy: string;
        blockingEffectiveness: string;
        allyCooperation: string;
    };
    misc?: {
        defensiveSkill?: string;
        robotReliability?: string;
        robotPenalties?: string;
        autoFuel?: string;
        autoClimb?: string;
        teleopPassing?: string;
        gameSense?: string;
    };
    submittedAt: number;
};

const Analytics = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("analytics");
    const [viewTab, setViewTab] = useState("all");
    const [sortBy, setSortBy] = useState<Filters["sortBy"]>("newest");
    const [teamNumberInput, setTeamNumberInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);
    const [pitScoutingEntries, setPitScoutingEntries] = useState<PitScoutingEntry[]>([]);
    const [pitTeamNumberInput, setPitTeamNumberInput] = useState("");
    const [subjectiveScoutingEntries, setSubjectiveScoutingEntries] = useState<SubjectiveScoutingEntry[]>([]);
    const [eventType, setEventType] = useState<"all" | "osf" | "current">("all");

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === "dashboard") navigate("/dashboard");
        if (tab === "scouting") navigate("/scouting");
        if (tab === "analytics") navigate("/analytics");
        if (tab === "pit-scouting") navigate("/pit-scouting");
        if (tab === "matches") navigate("/matches");
        if (tab === "leaderboard") navigate("/leaderboard");
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch match scouting data
                const matchesRef = ref(db, "matches");
                const snap = await get(matchesRef);

                if (!snap.exists()) {
                    console.log("No data found at 'matches' path");
                    setMatchEntries([]);
                } else {
                    const matchesData = snap.val();
                    const allEntries: MatchEntry[] = [];
                    console.log("All Match IDs in DB:", Object.keys(matchesData));

                    const parseClimbValue = (val: unknown): { climbValue: number; climbDisplay: string } => {
                        if (val === null || val === undefined) {
                            return {climbValue: 0, climbDisplay: "N/A"};
                        }

                        if (typeof val === 'number' && !isNaN(val)) {
                            if (val > 0) {
                                return {climbValue: val, climbDisplay: `L${val}`};
                            }
                            return {climbValue: 0, climbDisplay: "N/A"};
                        }

                        if (typeof val === 'string') {
                            const s = val.trim();
                            const match = s.match(/(?:L|Level|level|level_|lvl|LVL)?\s*_?\s*([1-3])/i);
                            if (match) {
                                const num = parseInt(match[1], 10);
                                return {climbValue: num, climbDisplay: `L${num}`};
                            }
                            const digitMatch = s.match(/^([1-3])$/);
                            if (digitMatch) {
                                const num = parseInt(digitMatch[1], 10);
                                return {climbValue: num, climbDisplay: `L${num}`};
                            }
                        }

                        return {climbValue: 0, climbDisplay: "N/A"};
                    };

                    const parseDefenseRating = (val: unknown): { defenseValue: number; defenseDisplay: string } => {
                        const defenseMap: { [key: string]: string } = {
                            "1": "1 - Poor",
                            "2": "2 - Fair",
                            "3": "3 - Good",
                            "4": "4 - Excellent",
                        };

                        if (val === null || val === undefined) {
                            return {defenseValue: 0, defenseDisplay: "N/A"};
                        }

                        if (typeof val === 'number' && !isNaN(val)) {
                            if (val > 0 && val <= 4) {
                                return {defenseValue: val, defenseDisplay: defenseMap[String(val)]};
                            }
                            return {defenseValue: 0, defenseDisplay: "N/A"};
                        }

                        if (typeof val === 'string') {
                            const s = val.trim();
                            const match = s.match(/^([1-4])/);
                            if (match) {
                                const num = parseInt(match[1], 10);
                                return {defenseValue: num, defenseDisplay: defenseMap[match[1]]};
                            }
                            if (defenseMap[s]) {
                                const num = parseInt(s, 10);
                                return {defenseValue: num, defenseDisplay: defenseMap[s]};
                            }
                        }

                        return {defenseValue: 0, defenseDisplay: "N/A"};
                    };

                    Object.entries(matchesData).forEach(([matchKey, matchValue]: [string, Record<string, unknown>]) => {
                        const participantsRoot = matchValue.participants || matchValue;

                        if (typeof participantsRoot !== 'object') return;

                        Object.entries(participantsRoot).forEach(([stationId, data]: [string, Record<string, unknown>]) => {
                            if (!data || typeof data !== 'object' || !data.teamNumber) return;

                            const teamNum = parseInt(String(data.teamNumber));
                            const autoScore = ((data.autonomous as Record<string, unknown>)?.score as number) || ((data.autonomous as Record<string, unknown>)?.fuel as number) || 0;
                            const teleopScore = ((data.teleop as Record<string, unknown>)?.score as number) || ((data.teleop as Record<string, unknown>)?.fuel as number) || 0;

                            const climbRaw = (data.teleop as Record<string, unknown>)?.climbLevel ?? 0;
                            const {climbValue, climbDisplay} = parseClimbValue(climbRaw);

                            const defenseRaw = (data.teleop as Record<string, unknown>)?.defenseScore ?? 0;
                            const {defenseValue, defenseDisplay} = parseDefenseRating(defenseRaw);

                            const robotTippedRaw = (data as Record<string, unknown>)?.robotTipped ?? false;
                            const robotTipped = robotTippedRaw === true || String(robotTippedRaw).toLowerCase() === "yes";

                            const robotDeadRaw = (data as Record<string, unknown>)?.robotDead ?? false;
                            const robotDead = robotDeadRaw === true || String(robotDeadRaw).toLowerCase() === "yes";

                            allEntries.push({
                                id: `${matchKey}_${stationId}_${(data.submittedAt as number) || Math.random()}`,
                                matchKey: matchKey,
                                station: stationId,
                                teamNumber: teamNum,
                                scoutName: (data.scoutName as string) || "Unknown",
                                score_auto: autoScore,
                                score_teleop: teleopScore,
                                total_score: autoScore + teleopScore,
                                climb: climbDisplay,
                                climbValue: climbValue,
                                defense_rating: defenseDisplay,
                                defense_rating_value: defenseValue,
                                robotTipped,
                                robotDead,
                                submittedAt: (data.submittedAt as number) || 0
                            });
                        });
                    });

                    console.log(`Successfully parsed ${allEntries.length} individual reports.`);
                    setMatchEntries(allEntries);
                }

                // Fetch pit scouting data
                const pitScoutingRef = ref(db, "pitScouting");
                const pitSnap = await get(pitScoutingRef);

                if (!pitSnap.exists()) {
                    console.log("No pit scouting data found");
                    setPitScoutingEntries([]);
                } else {
                    const pitData = pitSnap.val();
                    const allPitEntries: PitScoutingEntry[] = [];

                    // pitData structure: { dateStr: { teamNumber: { userId: { teamNumber, scoutName, scoutId, submittedAt, responses } } } }
                    Object.entries(pitData).forEach(([dateStr, dateValue]: [string, Record<string, unknown>]) => {
                        if (!dateValue || typeof dateValue !== 'object') return;

                        Object.entries(dateValue).forEach(([teamNum, teamValue]: [string, Record<string, unknown>]) => {
                            if (!teamValue || typeof teamValue !== 'object') return;

                            Object.entries(teamValue).forEach(([userId, entryValue]: [string, Record<string, unknown>]) => {
                                if (!entryValue || typeof entryValue !== 'object') return;

                                allPitEntries.push({
                                    id: `${dateStr}_${teamNum}_${userId}`,
                                    teamNumber: (entryValue.teamNumber as number) || parseInt(teamNum, 10) || 0,
                                    scoutName: (entryValue.scoutName as string) || "Unknown",
                                    scoutId: (entryValue.scoutId as string) || userId || "",
                                    responses: (entryValue.responses as Record<string, unknown>) || {},
                                    submittedAt: (entryValue.submittedAt as number) || 0,
                                });
                            });
                        });
                    });

                    console.log(`Successfully loaded ${allPitEntries.length} pit scouting entries.`);
                    setPitScoutingEntries(allPitEntries);
                }

                // Fetch subjective scouting data
                const subjectiveRef = ref(db, "subjectiveMatches");
                const subjectiveSnap = await get(subjectiveRef);

                if (!subjectiveSnap.exists()) {
                    console.log("No subjective scouting data found");
                    setSubjectiveScoutingEntries([]);
                } else {
                    const subjectiveData = subjectiveSnap.val();
                    const allSubjectiveEntries: SubjectiveScoutingEntry[] = [];

                    // subjectiveData structure: { matchId: { participants: { userId: { data } } } }
                    Object.entries(subjectiveData).forEach(([matchId, matchValue]: [string, Record<string, unknown>]) => {
                        if (!matchValue || typeof matchValue !== 'object') return;

                        const participants = matchValue.participants as Record<string, unknown> | undefined;
                        if (!participants || typeof participants !== 'object') return;

                        Object.entries(participants).forEach(([userId, participantValue]: [string, Record<string, unknown>]) => {
                            // Skip numeric indices (array elements) - only process actual userId keys
                            if (/^\d+$/.test(userId)) return;

                            if (!participantValue || typeof participantValue !== 'object') return;

                            const teamNumber = (participantValue.teamNumber as string)?.trim();
                            const scoutName = (participantValue.scoutName as string)?.trim();

                            if (!teamNumber || !scoutName) {
                                console.debug(`Skipping subjective entry ${matchId}_${userId}: missing team number or scout name`);
                                return;
                            }

                            const robotPerf = participantValue.robotPerformance as Record<string, unknown> || {};
                            const teamDyn = participantValue.teamDynamics as Record<string, unknown> || {};
                            const tactical = participantValue.tacticalInsights as Record<string, unknown> || {};
                            const misc = participantValue.misc as Record<string, unknown> || {};

                            allSubjectiveEntries.push({
                                id: `${matchId}_${userId}`,
                                matchId,
                                teamNumber: teamNumber,
                                scoutName: scoutName,
                                userId,
                                robotPerformance: {
                                    autonomousEffectiveness: (robotPerf.autonomousEffectiveness as string) || "",
                                    canQuicklyScore: (robotPerf.canQuicklyScore as string) || "",
                                    canClimb: (robotPerf.canClimb as string) || "",
                                    climbLevel: (robotPerf.climbLevel as string | null) || null,
                                },
                                teamDynamics: {
                                    performanceUnderPressure: (teamDyn.performanceUnderPressure as string) || "",
                                    teamFocus: (teamDyn.teamFocus as string) || "",
                                    driverSynchronization: (teamDyn.driverSynchronization as string) || "",
                                },
                                tacticalInsights: {
                                    defensiveStrategy: (tactical.defensiveStrategy as string) || "",
                                    blockingEffectiveness: (tactical.blockingEffectiveness as string) || "",
                                    allyCooperation: (tactical.allyCooperation as string) || "",
                                },
                                  misc: {
                                      defensiveSkill: (misc.defensiveSkill as string) || "",
                                      robotReliability: (misc.robotReliability as string) || (misc.robotReliablity as string) || "",
                                      robotPenalties: (misc.robotPenalties as string) || "",
                                      autoFuel: (misc.autoFuel as string) || "",
                                      autoClimb: (misc.autoClimb as string) || (misc.autoClimb1 as string) || "",
                                      teleopPassing: (misc.teleopPassing as string) || "",
                                      gameSense: (misc.gameSense as string) || "",
                                  },
                                submittedAt: (participantValue.submittedAt as number) || 0,
                            });
                        });
                    });

                    console.log(`Successfully loaded ${allSubjectiveEntries.length} subjective scouting entries.`);
                    setSubjectiveScoutingEntries(allSubjectiveEntries);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const sortedAndFiltered = useMemo(() => {
        let filtered = matchEntries;
        
        // Filter by event type
        if (eventType === "osf") {
            filtered = filtered.filter(e => isOSFData(e.submittedAt));
        } else if (eventType === "current") {
            filtered = filtered.filter(e => !isOSFData(e.submittedAt));
        }
        
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case "newest":
                    return b.submittedAt - a.submittedAt;
                case "highest_score_auto":
                    return b.score_auto - a.score_auto;
                case "highest_score_teleop":
                    return b.score_teleop - a.score_teleop;
                case "highest_total_score":
                    return b.total_score - a.total_score;
                case "highest_climb":
                    return (b.climbValue || 0) - (a.climbValue || 0);
                case "best_defense":
                    return (b.defense_rating_value || 0) - (a.defense_rating_value || 0);
                default:
                    return 0;
            }
        });
    }, [matchEntries, sortBy, eventType]);

    const teamSpecificData = useMemo(() => {
        const teamNum = parseInt(teamNumberInput);
        if (isNaN(teamNum)) return null;

        let teamMatches = matchEntries.filter(entry => entry.teamNumber === teamNum);
        
        // Filter by event type
        if (eventType === "osf") {
            teamMatches = teamMatches.filter(e => isOSFData(e.submittedAt));
        } else if (eventType === "current") {
            teamMatches = teamMatches.filter(e => !isOSFData(e.submittedAt));
        }

        if (teamMatches.length === 0) return null;

        const autoScores = teamMatches.map(m => m.score_auto);
        const teleopScores = teamMatches.map(m => m.score_teleop);
        const totalScores = teamMatches.map(m => m.total_score);
        const climbScores = teamMatches.map(m => m.climbValue || 0);
        const defenseRatings = teamMatches.map(m => m.defense_rating_value || 0);

        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const max = (arr: number[]) => Math.max(...arr);
        const min = (arr: number[]) => Math.min(...arr);

        return {
            teamNum,
            matches: teamMatches,
            stats: {
                autoScore: {avg: avg(autoScores), max: max(autoScores), min: min(autoScores)},
                teleopScore: {avg: avg(teleopScores), max: max(teleopScores), min: min(teleopScores)},
                totalScore: {avg: avg(totalScores), max: max(totalScores), min: min(totalScores)},
                climb: {avg: avg(climbScores), max: max(climbScores), min: min(climbScores)},
                defense: {avg: avg(defenseRatings), max: max(defenseRatings), min: min(defenseRatings)},
            }
        };
    }, [matchEntries, teamNumberInput, eventType]);

    const filteredPitScoutingEntries = useMemo(() => {
        let filtered = pitScoutingEntries;
        
        // Filter by event type
        if (eventType === "osf") {
            filtered = filtered.filter(e => isOSFData(e.submittedAt));
        } else if (eventType === "current") {
            filtered = filtered.filter(e => !isOSFData(e.submittedAt));
        }
        
        return filtered;
    }, [pitScoutingEntries, eventType]);

    const filteredSubjectiveScoutingEntries = useMemo(() => {
        let filtered = subjectiveScoutingEntries;
        
        // Filter by event type
        if (eventType === "osf") {
            filtered = filtered.filter(e => isOSFData(e.submittedAt));
        } else if (eventType === "current") {
            filtered = filtered.filter(e => !isOSFData(e.submittedAt));
        }
        
        return filtered;
    }, [subjectiveScoutingEntries, eventType]);

    const bubbleData = useMemo(() => {
        return sortedAndFiltered.map((m) => ({
            x: m.score_teleop,
            y: m.score_auto,
            r: Math.max(3, (m.climbValue || 0) * 6),
            robotTipped: !!m.robotTipped,
            robotDead: !!m.robotDead,
            team: m.teamNumber,
            id: m.id,
        }));
    }, [sortedAndFiltered]);

    const handleExportAllData = () => {
        // Helper: escape a single CSV field according to RFC4180 (double-quote, double internal quotes)
        const escapeField = (v: unknown) => {
            if (v === null || v === undefined) return "";
            const s = String(v);
            // keep line breaks (spreadsheet apps like Excel/Sheets will display multi-line cells)
            return `"${s.replace(/"/g, '""')}"`;
        };

        // Build a CSV section with a title, header row and rows (array of arrays)
        const buildSection = (title: string, headers: string[], rows: Array<Array<unknown>>) => {
            const out: string[] = [];
            // section title in first column to make it obvious when opening raw CSV
            out.push(escapeField(title));
            out.push(headers.map(escapeField).join(","));
            rows.forEach((r) => out.push(r.map(escapeField).join(",")));
            out.push(""); // blank line after section
            return out;
        };

        const lines: string[] = [];

        // Match Scouting
        const matchHeaders = [
            "Match Key",
            "Station",
            "Team Number",
            "Scout Name",
            "Auto Score",
            "Teleop Score",
            "Total Score",
            "Climb",
            "Defense Rating",
            "Robot Tipped",
            "Robot Dead",
            "Submitted At (PST)"
        ];
        const matchRows = matchEntries.map((entry) => [
            entry.matchKey,
            entry.station,
            entry.teamNumber,
            entry.scoutName,
            entry.score_auto,
            entry.score_teleop,
            entry.total_score,
            entry.climb,
            entry.defense_rating,
            entry.robotTipped ? "Yes" : "No",
            entry.robotDead ? "Yes" : "No",
            new Date(entry.submittedAt).toLocaleString([], {timeZone: "America/Los_Angeles"})
        ] as Array<unknown>);

        lines.push(...buildSection("MATCH SCOUTING DATA", matchHeaders, matchRows));

        // Pit Scouting
        const pitHeaders = ["Team Number", "Scout Name", "Scout ID", "Submitted At (PST)", "Responses (multi-line JSON) "];
        const pitRows = pitScoutingEntries.map((entry) => {
            // pretty-print responses JSON for readability (multi-line field)
            let prettyResponses: string;
            try {
                prettyResponses = JSON.stringify(entry.responses || {}, null, 2);
            } catch (e) {
                prettyResponses = String(entry.responses || "");
            }
            return [
                entry.teamNumber,
                entry.scoutName,
                entry.scoutId,
                new Date(entry.submittedAt).toLocaleString([], {timeZone: "America/Los_Angeles"}),
                prettyResponses
            ] as Array<unknown>;
        });
        lines.push(...buildSection("PIT SCOUTING DATA", pitHeaders, pitRows));

        // Subjective Scouting
        const subjHeaders = [
            "Match ID",
            "Team Number",
            "Scout Name",
            "Submitted At (PST)",
            "Subjective Summary (multi-line)"
        ];
        const subjRows = subjectiveScoutingEntries.map((entry) => {
            // build a readable multi-line summary per subjective entry
            const parts: string[] = [];
            parts.push("=== Section 1: Robot Performance & Strategy ===");
            parts.push(`Autonomous Effectiveness: ${entry.robotPerformance.autonomousEffectiveness || ""}`);
            parts.push(`Can Quickly Score: ${entry.robotPerformance.canQuicklyScore || ""}`);
            parts.push(`Can Climb: ${entry.robotPerformance.canClimb || ""}`);
            if (entry.robotPerformance.climbLevel) parts.push(`Climb Level: ${entry.robotPerformance.climbLevel}`);
            parts.push("");
            parts.push("=== Section 2: Team Dynamics ===");
            parts.push(`Performance Under Pressure: ${entry.teamDynamics.performanceUnderPressure || ""}`);
            parts.push(`Team Focus: ${entry.teamDynamics.teamFocus || ""}`);
            parts.push(`Driver Synchronization: ${entry.teamDynamics.driverSynchronization || ""}`);
            parts.push("");
            parts.push("=== Section 3: Tactical Insights ===");
            parts.push(`Defensive Strategy: ${entry.tacticalInsights.defensiveStrategy || ""}`);
            parts.push(`Blocking Effectiveness: ${entry.tacticalInsights.blockingEffectiveness || ""}`);
            parts.push(`Ally Cooperation: ${entry.tacticalInsights.allyCooperation || ""}`);

            const summary = parts.join("\n");

            return [
                entry.matchId,
                entry.teamNumber,
                entry.scoutName,
                new Date(entry.submittedAt).toLocaleString([], {timeZone: "America/Los_Angeles"}),
                summary
            ] as Array<unknown>;
        });
        lines.push(...buildSection("SUBJECTIVE SCOUTING DATA", subjHeaders, subjRows));

        const csvContent = lines.join("\r\n");
        const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `QuickScout_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main className="md:ml-64 min-h-screen max-h-screen overflow-auto">
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6 space-y-4">
                    <div>
                        <h2 className="font-mono font-bold text-2xl">Match Analytics</h2>
                        <p className="text-muted-foreground">View all match data or search for a specific team</p>
                    </div>

                    <Tabs value={viewTab} onValueChange={setViewTab} className="w-full">
                        <TabsList>
                            <TabsTrigger value="all">All Matches</TabsTrigger>
                            <TabsTrigger value="team">Team Search</TabsTrigger>
                            <TabsTrigger value="bubble">Bubble Chart</TabsTrigger>
                            <TabsTrigger value="pit-scouting">Pit Scouting</TabsTrigger>
                            <TabsTrigger value="subjective">Subjective Scouting</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-3 py-4">
                            <span className="text-sm font-medium">Event Type:</span>
                            <Select value={eventType} onValueChange={(v: any) => setEventType(v)}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Events</SelectItem>
                                    <SelectItem value="osf">OSF ({OSF_DATE_RANGE})</SelectItem>
                                    <SelectItem value="current">Current Event</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <TabsContent value="all" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-muted-foreground">Viewing {sortedAndFiltered.length} individual
                                    reports</p>
                                <div className="flex gap-2">
                                    <Button onClick={handleExportAllData} variant="outline">
                                        Export All Data
                                    </Button>
                                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as Filters["sortBy"])}>
                                        <SelectTrigger className="w-[220px]">
                                            <SelectValue placeholder="Sort by"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Newest First</SelectItem>
                                            <SelectItem value="highest_total_score">Highest Total Score</SelectItem>
                                            <SelectItem value="highest_score_auto">Highest Auto</SelectItem>
                                            <SelectItem value="highest_climb">Highest Climb</SelectItem>
                                            <SelectItem value="best_defense">Best Defense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {loading ? (
                                    <p>Loading scouted matches...</p>
                                ) : (
                                    sortedAndFiltered.map((entry) => (
                                        <Card key={entry.id} className="overflow-hidden border-l-4 border-l-primary">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex justify-between items-start">
                                                    <div className="flex flex-col">
                                                        <span className="text-xl">Team {entry.teamNumber}</span>
                                                    </div>
                                                    <div
                                                        className="bg-secondary px-2 py-1 rounded text-[10px] font-mono">
                                                        {entry.matchKey.slice(-6)}
                                                    </div>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                <div className="flex justify-between border-b border-border/50 pb-1">
                                                    <span className="text-muted-foreground">Scout:</span>
                                                    <span className="font-medium">{entry.scoutName}</span>
                                                </div>
                                                {/* Section 4: Misc */}
                                                {entry.misc && (
                                                    <div className="pt-4">
                                                        <h4 className="font-semibold text-sm mb-3 text-primary">Section 4: Misc</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Defensive Skill</p>
                                                                <p className="text-foreground mt-1">{entry.misc.defensiveSkill || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Robot Reliability</p>
                                                                <p className="text-foreground mt-1">{entry.misc.robotReliability || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Robot Penalties</p>
                                                                <p className="text-foreground mt-1">{entry.misc.robotPenalties || "N/A"}</p>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="p-3 bg-muted rounded border border-border">
                                                                    <p className="font-semibold">Auto Fuel</p>
                                                                    <p className="text-foreground mt-1">{entry.misc.autoFuel || "N/A"}</p>
                                                                </div>
                                                                <div className="p-3 bg-muted rounded border border-border">
                                                                    <p className="font-semibold">Auto Climb</p>
                                                                    <p className="text-foreground mt-1">{entry.misc.autoClimb || "N/A"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Teleop Passing</p>
                                                                <p className="text-foreground mt-1">{entry.misc.teleopPassing || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Game Sense</p>
                                                                <p className="text-foreground mt-1">{entry.misc.gameSense || "N/A"}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 pt-1">
                                                    <div className="bg-primary/5 p-2 rounded">
                                                        <p className="text-[10px] uppercase text-muted-foreground">Auto</p>
                                                        <p className="text-lg font-bold">{entry.score_auto}</p>
                                                    </div>
                                                    <div className="bg-primary/5 p-2 rounded">
                                                        <p className="text-[10px] uppercase text-muted-foreground">Teleop</p>
                                                        <p className="text-lg font-bold">{entry.score_teleop}</p>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center pt-1">
                                                    <span>Climb: <strong>{entry.climb}</strong></span>
                                                    <span>Defense: <strong>{entry.defense_rating}</strong></span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="team" className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Enter team number"
                                    value={teamNumberInput}
                                    onChange={(e) => setTeamNumberInput(e.target.value.replace(/\D/g, ""))}
                                    onKeyDown={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.altKey) return;
                                        const allowedKeys = ["Backspace", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Delete"];
                                        if (allowedKeys.includes(e.key)) return;
                                        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                                    }}
                                    className="w-49"
                                    aria-label="Team number"
                                />
                            </div>

                            {teamSpecificData ? (
                                <div className="space-y-4">
                                    <Card className="border-2 border-primary">
                                        <CardHeader>
                                            <CardTitle className="text-2xl">Team {teamSpecificData.teamNum}</CardTitle>
                                            <p className="text-muted-foreground text-sm">{teamSpecificData.matches.length} matches
                                                scouted</p>
                                        </CardHeader>
                                    </Card>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Auto Score</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Average</p>
                                                    <p className="text-2xl font-bold">{teamSpecificData.stats.autoScore.avg.toFixed(1)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Max</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.autoScore.max}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Min</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.autoScore.min}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Teleop Score</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Average</p>
                                                    <p className="text-2xl font-bold">{teamSpecificData.stats.teleopScore.avg.toFixed(1)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Max</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.teleopScore.max}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Min</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.teleopScore.min}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Total Score</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Average</p>
                                                    <p className="text-2xl font-bold">{teamSpecificData.stats.totalScore.avg.toFixed(1)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Max</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.totalScore.max}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Min</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.totalScore.min}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Climb</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Average</p>
                                                    <p className="text-2xl font-bold">{teamSpecificData.stats.climb.avg.toFixed(1)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Max</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.climb.max}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Min</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.climb.min}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Defense Rating</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Average</p>
                                                    <p className="text-2xl font-bold">{teamSpecificData.stats.defense.avg.toFixed(1)}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Max</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.defense.max}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Min</p>
                                                        <p className="text-lg font-semibold">{teamSpecificData.stats.defense.min}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Individual Match Reports</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {teamSpecificData.matches.map((entry) => (
                                                <Card key={entry.id} className="border-l-4 border-l-primary">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="flex justify-between items-start">
                                                            <span
                                                                className="text-lg">Match {entry.matchKey.slice(-6)}</span>
                                                            <span
                                                                className="text-xs bg-secondary px-2 py-1 rounded">{entry.station}</span>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="text-sm space-y-2">
                                                        <div
                                                            className="flex justify-between border-b border-border/50 pb-1">
                                                            <span className="text-muted-foreground">Scout:</span>
                                                            <span className="font-medium">{entry.scoutName}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Auto</p>
                                                                <p className="font-semibold">{entry.score_auto}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Teleop</p>
                                                                <p className="font-semibold">{entry.score_teleop}</p>
                                                            </div>
                                                        </div>
                                                        <div className="pt-2 border-t space-y-1">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Total:</span>
                                                                <span className="font-bold">{entry.total_score}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Climb:</span>
                                                                <span className="font-semibold">{entry.climb}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Defense:</span>
                                                                <span
                                                                    className="font-semibold">{entry.defense_rating}</span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64">
                                    <p className="text-muted-foreground">
                                        {teamNumberInput ? "No data found for this team" : "Enter a team number to view analytics"}
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="bubble" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Bubble Chart</CardTitle>
                                    <p className="text-sm text-muted-foreground">X = Teleop Points, Y = Auto Points,
                                        Size = Teleop Climb</p>
                                </CardHeader>
                                <CardContent>
                                    <div style={{width: '100%', height: 480}}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ScatterChart>
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis type="number" dataKey="x" name="Teleop Points" unit=""/>
                                                <YAxis type="number" dataKey="y" name="Auto Points" unit=""/>
                                                <ZAxis dataKey="r" range={[50, 400]}/>
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                <ReTooltip cursor={{strokeDasharray: '3 3'}}
                                                           formatter={((value: any, name: any) => [value, name]) as any} />
                                                <Legend/>
                                                <Scatter
                                                    name="Scouts"
                                                    data={bubbleData}
                                                    fill="#00C853"
                                                    shape={(props: any) => {
                                                        const {cx, cy, payload} = props as any;
                                                        let color = '#2ECC71'; // Green for normal
                                                        if (payload?.robotDead) {
                                                            color = '#000000'; // Black for dead robot
                                                        } else if (payload?.robotTipped) {
                                                            color = '#FF5252'; // Red for tipped
                                                        }
                                                        const radius = (payload?.r as number) || 6;
                                                        return (
                                                            <g>
                                                                <circle cx={cx} cy={cy} r={radius} fill={color}
                                                                        fillOpacity={0.7} stroke="#fff"
                                                                        strokeWidth={1}/>
                                                                <text x={cx} y={cy} textAnchor="middle"
                                                                      dominantBaseline="central" fontSize={10}
                                                                      fill="#000">{payload?.team}</text>
                                                            </g>
                                                        );
                                                    }}
                                                />
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="pit-scouting" className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Enter team number (optional)"
                                    value={pitTeamNumberInput}
                                    onChange={(e) => setPitTeamNumberInput(e.target.value.replace(/\D/g, ""))}
                                    onKeyDown={(e) => {
                                        if (e.ctrlKey || e.metaKey || e.altKey) return;
                                        const allowedKeys = ["Backspace", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Delete"];
                                        if (allowedKeys.includes(e.key)) return;
                                        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                                    }}
                                    className="w-49"
                                    aria-label="Pit scouting team number"
                                />
                            </div>

                            {loading ? (
                                <Card>
                                    <CardContent className="py-8">
                                        <p className="text-center text-muted-foreground">Loading pit scouting
                                            data...</p>
                                    </CardContent>
                                </Card>
                            ) : filteredPitScoutingEntries.length === 0 ? (
                                <Card>
                                    <CardContent className="py-8">
                                        <p className="text-center text-muted-foreground">No pit scouting data
                                            available</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-muted-foreground">
                                            Viewing {pitTeamNumberInput
                                            ? filteredPitScoutingEntries.filter(e => e.teamNumber === parseInt(pitTeamNumberInput)).length
                                            : filteredPitScoutingEntries.length} pit scouting entries
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {(pitTeamNumberInput
                                                ? filteredPitScoutingEntries.filter(e => e.teamNumber === parseInt(pitTeamNumberInput))
                                                : filteredPitScoutingEntries
                                        ).map((entry) => {
                                            const formatKey = (key: string) => {
                                                return key
                                                    .replace(/-/g, "_")
                                                    .split("_")
                                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                    .join(" ");
                                            };

                                            const formatValue = (value: unknown) => {
                                                if (value === null || value === undefined) return "N/A";
                                                if (typeof value === "boolean") return value ? "Yes" : "No";
                                                if (typeof value === "object") return JSON.stringify(value);
                                                return String(value).trim();
                                            };

                                            // Organize responses by category
                                            const robotFunctions = new Map<string, unknown>();
                                            const robotCapabilities = new Map<string, unknown>();
                                            const autos = new Map<string, unknown>();
                                            const drivebase = new Map<string, unknown>();
                                            const strategyNotes = new Map<string, unknown>();

                                            Object.entries(entry.responses).forEach(([key, value]) => {
                                                if (value === null || value === undefined || (typeof value === "boolean" && !value)) return;

                                                if (key.includes("intake") || key.includes("climb")) {
                                                    robotFunctions.set(key, value);
                                                } else if (key.includes("defense") || key.includes("shooter") || key.includes("fuel-hopper") || key.includes("bps") || key.includes("under-trench") || key.includes("over-bump") || key.includes("shoot-on") || key.includes("pass-fuel")) {
                                                    robotCapabilities.set(key, value);
                                                } else if (key.includes("auto")) {
                                                    autos.set(key, value);
                                                } else if (key.includes("dimension") || key.includes("special-detail")) {
                                                    drivebase.set(key, value);
                                                } else if (key.includes("strength") || key.includes("weakness") || key.includes("feature") || key.includes("note")) {
                                                    strategyNotes.set(key, value);
                                                }
                                            });

                                            return (
                                                <Card key={entry.id} className="overflow-hidden">
                                                    <CardHeader
                                                        className="bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
                                                        <CardTitle className="flex justify-between items-start">
                                                            <div className="flex flex-col gap-1">
                                                                <span
                                                                    className="text-2xl font-bold">Team {entry.teamNumber}</span>
                                                                <span
                                                                    className="text-xs text-muted-foreground">Scout: {entry.scoutName}</span>
                                                            </div>
                                                            <div
                                                                className="bg-secondary px-3 py-1 rounded text-xs font-mono">
                                                                {new Date(entry.submittedAt).toLocaleDateString([], {timeZone: "America/Los_Angeles"})}
                                                            </div>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="pt-4 space-y-4">
                                                        {robotFunctions.size > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-2 text-primary">Robot
                                                                    Functions</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    {Array.from(robotFunctions.entries()).map(([key, value]) => (
                                                                        <div key={key}
                                                                             className="flex items-center gap-2 py-1">
                                                                            <div
                                                                                className="w-2 h-2 rounded-full bg-primary flex-shrink-0"/>
                                                                            <span
                                                                                className="font-medium">{formatKey(key)}</span>
                                                                            {typeof value === "boolean" ? null : <span
                                                                                className="text-muted-foreground">({formatValue(value)})</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {robotCapabilities.size > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-2 text-primary">Robot
                                                                    Capabilities</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    {Array.from(robotCapabilities.entries()).map(([key, value]) => (
                                                                        <div key={key}
                                                                             className="flex justify-between items-center py-1 px-2 bg-secondary/40 rounded">
                                                                            <span
                                                                                className="font-medium">{formatKey(key)}</span>
                                                                            <span
                                                                                className="font-semibold text-primary">{formatValue(value)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {autos.size > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-2 text-primary">Autonomous</h4>
                                                                <div className="space-y-1 text-sm">
                                                                    {Array.from(autos.entries()).map(([key, value]) => (
                                                                        <div key={key}
                                                                             className="flex items-center gap-2 py-1">
                                                                            <div
                                                                                className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"/>
                                                                            <span
                                                                                className="font-medium">{formatKey(key)}</span>
                                                                            {typeof value === "boolean" ? null : <span
                                                                                className="text-muted-foreground ml-auto">({formatValue(value)})</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {drivebase.size > 0 && (
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-2 text-primary">Drivebase</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    {Array.from(drivebase.entries()).map(([key, value]) => (
                                                                        <div key={key}
                                                                             className="p-3 bg-muted rounded border border-border">
                                                                            <p className="font-semibold text-foreground">{formatKey(key)}</p>
                                                                            <p className="text-foreground mt-2">{formatValue(value)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {strategyNotes.size > 0 && (
                                                            <div className="pt-2 border-t border-border">
                                                                <h4 className="font-semibold text-sm mb-2 text-primary">Strategy
                                                                    & Notes</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    {Array.from(strategyNotes.entries()).map(([key, value]) => (
                                                                        <div key={key}
                                                                             className="p-3 bg-muted rounded border border-border">
                                                                            <p className="font-semibold text-foreground">{formatKey(key)}</p>
                                                                            <p className="text-foreground mt-2 whitespace-pre-wrap">{formatValue(value)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="subjective" className="space-y-4">
                            <div>
                                <p className="text-muted-foreground">Viewing {filteredSubjectiveScoutingEntries.length} subjective
                                    scouting entries</p>
                            </div>

                            {loading ? (
                                <p>Loading subjective scouting data...</p>
                            ) : filteredSubjectiveScoutingEntries.length === 0 ? (
                                <p className="text-muted-foreground">No subjective scouting data found</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredSubjectiveScoutingEntries.map((entry) => (
                                        <Card key={entry.id} className="overflow-hidden border-l-4 border-l-accent">
                                            <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5 pb-3">
                                                <CardTitle className="flex justify-between items-start">
                                                    <div className="flex flex-col gap-1">
                                                        <span
                                                            className="text-2xl font-bold">Team {entry.teamNumber}</span>
                                                        <span
                                                            className="text-xs text-muted-foreground">Scout: {entry.scoutName}</span>
                                                    </div>
                                                    <div className="bg-secondary px-3 py-1 rounded text-xs font-mono">
                                                        {new Date(entry.submittedAt).toLocaleDateString([], {timeZone: "America/Los_Angeles"})}
                                                    </div>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4 space-y-4">
                                                {/* Section 1: Robot Performance and Strategy */}
                                                <div className="border-b pb-4">
                                                    <h4 className="font-semibold text-sm mb-3 text-primary">Section 1:
                                                        Robot Performance and Strategy</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Autonomous Effectiveness</p>
                                                            <p className="text-foreground mt-1">{entry.robotPerformance.autonomousEffectiveness || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Can Quickly Score Fuels</p>
                                                            <p className="text-foreground mt-1">{entry.robotPerformance.canQuicklyScore || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Can Climb</p>
                                                            <div className="text-foreground mt-1">
                                                                <p>{entry.robotPerformance.canClimb || "N/A"}</p>
                                                                {entry.robotPerformance.climbLevel && (
                                                                    <p className="text-xs text-muted-foreground mt-1">Level: {entry.robotPerformance.climbLevel}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 2: Team Dynamics */}
                                                <div className="border-b pb-4">
                                                    <h4 className="font-semibold text-sm mb-3 text-primary">Section 2:
                                                        Team Dynamics</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Performance Under Pressure</p>
                                                            <p className="text-foreground mt-1">{entry.teamDynamics.performanceUnderPressure || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Team Focus</p>
                                                            <p className="text-foreground mt-1">{entry.teamDynamics.teamFocus || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Driver Synchronization</p>
                                                            <p className="text-foreground mt-1">{entry.teamDynamics.driverSynchronization || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 3: Tactical Insights */}
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-3 text-primary">Section 3:
                                                        Tactical Insights</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Defensive Strategy</p>
                                                            <p className="text-foreground mt-1">{entry.tacticalInsights.defensiveStrategy || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Blocking Effectiveness</p>
                                                            <p className="text-foreground mt-1">{entry.tacticalInsights.blockingEffectiveness || "N/A"}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted rounded border border-border">
                                                            <p className="font-semibold">Ally Cooperation</p>
                                                            <p className="text-foreground mt-1">{entry.tacticalInsights.allyCooperation || "N/A"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Section 4: Misc (new subjective prompts) */}
                                                {entry.misc && (
                                                    <div className="pt-4 border-t border-border">
                                                        <h4 className="font-semibold text-sm mb-3 text-primary">Section 4: Misc</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Defensive Skill</p>
                                                                <p className="text-foreground mt-1">{entry.misc.defensiveSkill || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Robot Reliability</p>
                                                                <p className="text-foreground mt-1">{entry.misc.robotReliability || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Robot Penalties</p>
                                                                <p className="text-foreground mt-1">{entry.misc.robotPenalties || "N/A"}</p>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="p-3 bg-muted rounded border border-border">
                                                                    <p className="font-semibold">Auto Fuel</p>
                                                                    <p className="text-foreground mt-1">{entry.misc.autoFuel || "N/A"}</p>
                                                                </div>
                                                                <div className="p-3 bg-muted rounded border border-border">
                                                                    <p className="font-semibold">Auto Climb</p>
                                                                    <p className="text-foreground mt-1">{entry.misc.autoClimb || "N/A"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Teleop Passing</p>
                                                                <p className="text-foreground mt-1">{entry.misc.teleopPassing || "N/A"}</p>
                                                            </div>
                                                            <div className="p-3 bg-muted rounded border border-border">
                                                                <p className="font-semibold">Game Sense</p>
                                                                <p className="text-foreground mt-1">{entry.misc.gameSense || "N/A"}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default Analytics;

