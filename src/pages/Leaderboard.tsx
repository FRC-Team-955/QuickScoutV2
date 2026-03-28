import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useAuth} from "@/contexts/AuthContext";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {get, ref} from "firebase/database";
import {db} from "@/lib/firebase";
import {OSF_DATE_RANGE} from "@/lib/dateUtils";

type LeaderboardRow = {
    key: string;
    scoutName: string;
    matches: number;
    lastSubmitted: number;
    submittedAt: number;
};

const Leaderboard = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("leaderboard");
    const [eventType, setEventType] = useState("all");
    const [loading, setLoading] = useState(false);
    const [osfRows, setOsfRows] = useState<LeaderboardRow[]>([]);
    const [currentRows, setCurrentRows] = useState<LeaderboardRow[]>([]);

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

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                // Track all submissions per scout with their timestamps
                const submissions = new Map<
                    string,
                    Array<{ scoutName: string; submittedAt: number }>
                >();

                // Fetch normal matches data
                const matchesRef = ref(db, "matches");
                const matchesSnap = await get(matchesRef);

                if (matchesSnap.exists()) {
                    const matchesData = matchesSnap.val();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    Object.values(matchesData as Record<string, Record<string, any>>).forEach((matchValue) => {
                        const participantsRoot = matchValue?.participants || matchValue;
                        if (!participantsRoot || typeof participantsRoot !== "object") return;

                        Object.entries(participantsRoot).forEach(([participantId, data]) => {
                            // Skip numeric indices (array elements)
                            if (/^\d+$/.test(participantId)) return;
                            
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const dataObj = data as Record<string, any>;
                            if (!dataObj) return;

                            const hasSubmission =
                                dataObj.teamNumber != null ||
                                dataObj.submittedAt != null ||
                                dataObj.autonomous ||
                                dataObj.teleop ||
                                dataObj.endGame;
                            if (!hasSubmission) return;

                            const scoutName = String(dataObj.scoutName || dataObj.name || "").trim();
                            if (!scoutName) return;

                            const key = scoutName.toLowerCase();

                            const submittedAt =
                                typeof dataObj.submittedAt === "number"
                                    ? dataObj.submittedAt
                                    : Number(dataObj.submittedAt) || 0;

                            if (!submissions.has(key)) {
                                submissions.set(key, []);
                            }
                            submissions.get(key)!.push({ scoutName, submittedAt });
                        });
                    });
                }

                // Fetch subjective matches data
                const subjectiveRef = ref(db, "subjectiveMatches");
                const subjectiveSnap = await get(subjectiveRef);

                if (subjectiveSnap.exists()) {
                    const subjectiveData = subjectiveSnap.val();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    Object.values(subjectiveData as Record<string, Record<string, any>>).forEach((matchValue) => {
                        const participantsRoot = matchValue?.participants;
                        if (!participantsRoot || typeof participantsRoot !== "object") return;

                        Object.entries(participantsRoot).forEach(([participantId, data]) => {
                            // Skip numeric indices (array elements)
                            if (/^\d+$/.test(participantId)) return;
                            
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const dataObj = data as Record<string, any>;
                            if (!dataObj) return;

                            const scoutName = String(dataObj.scoutName || "").trim();
                            if (!scoutName) return;

                            const submittedAt =
                                typeof dataObj.submittedAt === "number"
                                    ? dataObj.submittedAt
                                    : Number(dataObj.submittedAt) || 0;

                            const key = scoutName.toLowerCase();

                            if (!submissions.has(key)) {
                                submissions.set(key, []);
                            }
                            submissions.get(key)!.push({ scoutName, submittedAt });
                        });
                    });
                }

                // Define OSF date range
                const OSF_START = new Date(2026, 2, 6, 0, 0, 0).getTime();
                const OSF_END = new Date(2026, 2, 7, 23, 59, 59).getTime();
                const isOSF = (timestamp: number) => timestamp >= OSF_START && timestamp <= OSF_END;

                // Aggregate submissions by event type
                const osfTally = new Map<string, LeaderboardRow>();
                const currentTally = new Map<string, LeaderboardRow>();

                submissions.forEach((subList, key) => {
                    const scoutName = subList[0]?.scoutName || "";
                    const osfSubs = subList.filter(s => isOSF(s.submittedAt));
                    const currentSubs = subList.filter(s => !isOSF(s.submittedAt));

                    // For OSF
                    if (osfSubs.length > 0) {
                        const lastSubmitted = Math.max(...osfSubs.map(s => s.submittedAt));
                        osfTally.set(key, {
                            key,
                            scoutName,
                            matches: osfSubs.length,
                            lastSubmitted,
                            submittedAt: lastSubmitted,
                        });
                    }

                    // For Current
                    if (currentSubs.length > 0) {
                        const lastSubmitted = Math.max(...currentSubs.map(s => s.submittedAt));
                        currentTally.set(key, {
                            key,
                            scoutName,
                            matches: currentSubs.length,
                            lastSubmitted,
                            submittedAt: lastSubmitted,
                        });
                    }
                });

                // Sort both boards
                const osfRows = Array.from(osfTally.values()).sort(
                    (a, b) => b.matches - a.matches || b.lastSubmitted - a.lastSubmitted
                );
                const currentRows = Array.from(currentTally.values()).sort(
                    (a, b) => b.matches - a.matches || b.lastSubmitted - a.lastSubmitted
                );

                setOsfRows(osfRows);
                setCurrentRows(currentRows);
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
                setOsfRows([]);
                setCurrentRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main
                className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
                style={{WebkitOverflowScrolling: "touch"}}
            >
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-mono font-bold text-foreground">
                                Leaderboard
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Matches scouted per person
                            </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {loading ? "Loading…" : `${osfRows.length + currentRows.length} scouts`}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Event Type:</span>
                        <Select value={eventType} onValueChange={setEventType}>
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

                    {loading ? (
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                Loading leaderboard…
                            </CardContent>
                        </Card>
                    ) : (osfRows.length === 0 && currentRows.length === 0) ? (
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                No submitted scouting data found yet.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* All Events - Show both boards */}
                            {eventType === "all" && (
                                <>
                                    {osfRows.length > 0 && (
                                        <Card>
                                            <CardHeader className="border-b border-border">
                                                <CardTitle className="text-lg font-mono">
                                                    OSF Scout Activity ({OSF_DATE_RANGE})
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[80px]">Rank</TableHead>
                                                                <TableHead>Scout</TableHead>
                                                                <TableHead className="text-right">
                                                                    Matches Scouted
                                                                </TableHead>
                                                                <TableHead className="text-right">
                                                                    Last Submission
                                                                </TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {osfRows.map((row, index) => (
                                                                <TableRow
                                                                    key={row.key}
                                                                    className={
                                                                        row.scoutName === user?.name
                                                                            ? "bg-primary/5"
                                                                            : undefined
                                                                    }
                                                                >
                                                                    <TableCell className="font-mono">
                                                                        {index + 1}
                                                                    </TableCell>
                                                                    <TableCell className="font-medium">
                                                                        {row.scoutName}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono">
                                                                        {row.matches}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                                        {row.lastSubmitted
                                                                            ? new Date(row.lastSubmitted).toLocaleString()
                                                                            : "—"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {currentRows.length > 0 && (
                                        <Card>
                                            <CardHeader className="border-b border-border">
                                                <CardTitle className="text-lg font-mono">
                                                    Current Event Scout Activity
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[80px]">Rank</TableHead>
                                                                <TableHead>Scout</TableHead>
                                                                <TableHead className="text-right">
                                                                    Matches Scouted
                                                                </TableHead>
                                                                <TableHead className="text-right">
                                                                    Last Submission
                                                                </TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {currentRows.map((row, index) => (
                                                                <TableRow
                                                                    key={row.key}
                                                                    className={
                                                                        row.scoutName === user?.name
                                                                            ? "bg-primary/5"
                                                                            : undefined
                                                                    }
                                                                >
                                                                    <TableCell className="font-mono">
                                                                        {index + 1}
                                                                    </TableCell>
                                                                    <TableCell className="font-medium">
                                                                        {row.scoutName}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono">
                                                                        {row.matches}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                                        {row.lastSubmitted
                                                                            ? new Date(row.lastSubmitted).toLocaleString()
                                                                            : "—"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}

                            {/* OSF Only */}
                            {eventType === "osf" && osfRows.length > 0 && (
                                <Card>
                                    <CardHeader className="border-b border-border">
                                        <CardTitle className="text-lg font-mono">
                                            OSF Scout Activity ({OSF_DATE_RANGE})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[80px]">Rank</TableHead>
                                                        <TableHead>Scout</TableHead>
                                                        <TableHead className="text-right">
                                                            Matches Scouted
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Last Submission
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {osfRows.map((row, index) => (
                                                        <TableRow
                                                            key={row.key}
                                                            className={
                                                                row.scoutName === user?.name
                                                                    ? "bg-primary/5"
                                                                    : undefined
                                                            }
                                                        >
                                                            <TableCell className="font-mono">
                                                                {index + 1}
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                {row.scoutName}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">
                                                                {row.matches}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                {row.lastSubmitted
                                                                    ? new Date(row.lastSubmitted).toLocaleString()
                                                                    : "—"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* OSF selected but no data */}
                            {eventType === "osf" && osfRows.length === 0 && (
                                <Card>
                                    <CardContent className="p-6 text-sm text-muted-foreground">
                                        No OSF scouting data found.
                                    </CardContent>
                                </Card>
                            )}

                            {/* Current Event Only */}
                            {eventType === "current" && currentRows.length > 0 && (
                                <Card>
                                    <CardHeader className="border-b border-border">
                                        <CardTitle className="text-lg font-mono">
                                            Current Event Scout Activity
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[80px]">Rank</TableHead>
                                                        <TableHead>Scout</TableHead>
                                                        <TableHead className="text-right">
                                                            Matches Scouted
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Last Submission
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {currentRows.map((row, index) => (
                                                        <TableRow
                                                            key={row.key}
                                                            className={
                                                                row.scoutName === user?.name
                                                                    ? "bg-primary/5"
                                                                    : undefined
                                                            }
                                                        >
                                                            <TableCell className="font-mono">
                                                                {index + 1}
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                {row.scoutName}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">
                                                                {row.matches}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                                {row.lastSubmitted
                                                                    ? new Date(row.lastSubmitted).toLocaleString()
                                                                    : "—"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Current Event selected but no data */}
                            {eventType === "current" && currentRows.length === 0 && (
                                <Card>
                                    <CardContent className="p-6 text-sm text-muted-foreground">
                                        No current event scouting data found.
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Leaderboard;

