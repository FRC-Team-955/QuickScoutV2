import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useAuth} from "@/contexts/AuthContext";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {get, ref} from "firebase/database";
import {db} from "@/lib/firebase";

type LeaderboardRow = {
    key: string;
    scoutName: string;
    matches: number;
    lastSubmitted: number;
};

const Leaderboard = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("leaderboard");
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<LeaderboardRow[]>([]);

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
                const tally = new Map<
                    string,
                    { scoutName: string; matches: number; lastSubmitted: number }
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

                            const current = tally.get(key) || {
                                scoutName,
                                matches: 0,
                                lastSubmitted: 0,
                            };
                            current.matches += 1;
                            current.lastSubmitted = Math.max(current.lastSubmitted, submittedAt);
                            current.scoutName = scoutName; // Always use the found name
                            tally.set(key, current);
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

                            const current = tally.get(key) || {
                                scoutName,
                                matches: 0,
                                lastSubmitted: 0,
                            };
                            current.matches += 1;
                            current.lastSubmitted = Math.max(current.lastSubmitted, submittedAt);
                            current.scoutName = scoutName; // Always use the found name
                            tally.set(key, current);
                        });
                    });
                }

                const nextRows: LeaderboardRow[] = Array.from(tally.entries()).map(
                    ([key, value]) => ({
                        key,
                        scoutName: value.scoutName,
                        matches: value.matches,
                        lastSubmitted: value.lastSubmitted,
                    }),
                );

                nextRows.sort(
                    (a, b) =>
                        b.matches - a.matches || b.lastSubmitted - a.lastSubmitted,
                );
                setRows(nextRows);
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const filteredRows = useMemo(() => {
        return rows;
    }, [rows]);

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
                            {loading ? "Loading…" : `${filteredRows.length} scouts`}
                        </div>
                    </div>

                    <Card>
                        <CardHeader className="border-b border-border">
                            <CardTitle className="text-lg font-mono">
                                Scout Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-6 text-sm text-muted-foreground">
                                    Loading leaderboard…
                                </div>
                            ) : filteredRows.length === 0 ? (
                                <div className="p-6 text-sm text-muted-foreground">
                                    No submitted scouting data found yet.
                                </div>
                            ) : (
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
                                            {filteredRows.map((row, index) => (
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
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default Leaderboard;

