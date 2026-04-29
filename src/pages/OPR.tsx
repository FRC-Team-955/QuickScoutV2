import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Calendar} from "lucide-react";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Button} from "@/components/ui/button";

import {TBA_EVENT_KEY, getEventMatches} from "@/lib/tba";
import {get, ref, set} from "firebase/database";
import {db} from "@/lib/firebase";

type TbaMatch = {
    key: string;
    match_number: number;
    comp_level: "qm" | "qf" | "sf" | "f";
    alliances: {
        red: { team_keys: string[]; score: number };
        blue: { team_keys: string[]; score: number };
    };
    time?: number;
};

// notPlaying structure in Firebase:
// matchNotPlayeds/{eventKey}/{matchKey}/{teamKey} = true | null (deleted)

const OPR = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("opr");

    const [eventKey, setEventKey] = useState(TBA_EVENT_KEY);
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState<TbaMatch[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [oprs, setOprs] = useState<Record<string, number>>({});

    // notPlaying: { [matchKey]: Set<teamKey> }
    const [notPlaying, setNotPlaying] = useState<Record<string, Set<string>>>({});

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === "dashboard") navigate("/dashboard");
        if (tab === "scouting") navigate("/scouting");
        if (tab === "pit-scouting") navigate("/pit-scouting");
        if (tab === "analytics") navigate("/analytics");
        if (tab === "matches") navigate("/matches");
        if (tab === "opr") navigate("/opr");
        if (tab === "leaderboard") navigate("/leaderboard");
    };

    // Load matches from TBA
    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const data = await getEventMatches(eventKey);
                data.sort((a: TbaMatch, b: TbaMatch) =>
                    (a.time ?? 0) - (b.time ?? 0) || a.match_number - b.match_number
                );
                setMatches(data);
            } catch (err) {
                console.error("Failed to load TBA matches", err);
                setMatches([]);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [eventKey]);

    // Load saved notPlaying state from Firebase
    useEffect(() => {
        const loadNotPlayeds = async () => {
            try {
                const NotPlayedsRef = ref(db, `matchNotPlayeds/${eventKey}`);
                const snap = await get(NotPlayedsRef);
                if (!snap.exists()) return;

                const raw = snap.val() as Record<string, Record<string, boolean>>;
                const parsed: Record<string, Set<string>> = {};
                Object.entries(raw).forEach(([matchKey, teams]) => {
                    parsed[matchKey] = new Set(Object.keys(teams).filter(k => teams[k]));
                });
                setNotPlaying(parsed);
            } catch (err) {
                console.error("Failed to load match NotPlayeds", err);
            }
        };
        loadNotPlayeds();
    }, [eventKey]);

    // Toggle a team's not-playing state for a specific match
    const toggleNotPlaying = async (matchKey: string, teamKey: string) => {
        const current = notPlaying[matchKey] ?? new Set<string>();
        const isAbsent = current.has(teamKey);

        // Optimistic local update
        setNotPlaying(prev => {
            const updated = new Set(prev[matchKey] ?? []);
            if (isAbsent) {
                updated.delete(teamKey);
            } else {
                updated.add(teamKey);
            }
            return {...prev, [matchKey]: updated};
        });

        // Persist to Firebase
        try {
            const teamRef = ref(db, `matchNotPlayeds/${eventKey}/${matchKey}/${teamKey}`);
            await set(teamRef, isAbsent ? null : true);
        } catch (err) {
            console.error("Failed to save NotPlayed", err);
            // Revert on failure
            setNotPlaying(prev => {
                const reverted = new Set(prev[matchKey] ?? []);
                if (isAbsent) {
                    reverted.add(teamKey);
                } else {
                    reverted.delete(teamKey);
                }
                return {...prev, [matchKey]: reverted};
            });
        }
    };

    const levelLabel = (lvl: string) => {
        if (lvl === "qm") return "Qual";
        if (lvl === "qf") return "Quarterfinal";
        if (lvl === "sf") return "Semifinal";
        if (lvl === "f") return "Final";
        return lvl;
    };

    const calculateOPRs = () => {
        // let N = number of teams, let M be number of matches
        // create a matrix Q with 2M rows, N cols. set to all zeores
        // each match has 2 teams of 3; for  each team in each match, theres is a row in the matrix
        // insert up to 3 1s in that row, where the column aligns with the team number. Do not put a 1 if firebase matchNotPlayed says no

        // create a 1x2M vector with team scores, call it S

        // solve Q*x=S, by least squares; OPRs = x
        // render it i guess

        // Collect all unique team keys across all matches
        const teamSet = new Set<string>();
        matches.forEach(m => {
            m.alliances.red.team_keys.forEach(t => teamSet.add(t));
            m.alliances.blue.team_keys.forEach(t => teamSet.add(t));
        });
        const teams = Array.from(teamSet).sort();
        const teamIndex: Record<string, number> = {};
        teams.forEach((t, i) => { teamIndex[t] = i; });

        const N = teams.length;

        // Only use matches that have been played (score >= 0)
        const playedMatches = matches.filter(
            m => m.alliances.red.score >= 0 && m.alliances.blue.score >= 0
        );
        const M = playedMatches.length;

        if (M === 0 || N === 0) {
            setOprs({});
            return;
        }

        // Q is 2M x N (flat row-major), S is length 2M
        const Q: number[] = new Array(2 * M * N).fill(0);
        const S: number[] = new Array(2 * M).fill(0);

        playedMatches.forEach((m, matchIdx) => {
            const absent = notPlaying[m.key] ?? new Set<string>();

            // Red alliance row = matchIdx * 2
            const redRow = matchIdx * 2;
            m.alliances.red.team_keys.forEach(tk => {
                if (!absent.has(tk) && teamIndex[tk] !== undefined) {
                    Q[redRow * N + teamIndex[tk]] = 1;
                }
            });
            S[redRow] = m.alliances.red.score;

            // Blue alliance row = matchIdx * 2 + 1
            const blueRow = matchIdx * 2 + 1;
            m.alliances.blue.team_keys.forEach(tk => {
                if (!absent.has(tk) && teamIndex[tk] !== undefined) {
                    Q[blueRow * N + teamIndex[tk]] = 1;
                }
            });
            S[blueRow] = m.alliances.blue.score;
        });

        // Solve Q*x = S via normal equations: (Q^T * Q) * x = Q^T * S
        // Compute Q^T * Q  (N x N)
        const QtQ: number[] = new Array(N * N).fill(0);
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                let sum = 0;
                for (let r = 0; r < 2 * M; r++) {
                    sum += Q[r * N + i] * Q[r * N + j];
                }
                QtQ[i * N + j] = sum;
            }
        }

        // Compute Q^T * S  (N x 1)
        const QtS: number[] = new Array(N).fill(0);
        for (let i = 0; i < N; i++) {
            let sum = 0;
            for (let r = 0; r < 2 * M; r++) {
                sum += Q[r * N + i] * S[r];
            }
            QtS[i] = sum;
        }

        // Gaussian elimination with partial pivoting to solve QtQ * x = QtS
        // Augmented matrix [QtQ | QtS]
        const aug: number[][] = Array.from({length: N}, (_, i) =>
            [...QtQ.slice(i * N, i * N + N), QtS[i]]
        );

        for (let col = 0; col < N; col++) {
            // Find pivot
            let maxRow = col;
            for (let row = col + 1; row < N; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                    maxRow = row;
                }
            }
            [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

            if (Math.abs(aug[col][col]) < 1e-10) continue; // singular column, skip

            for (let row = 0; row < N; row++) {
                if (row === col) continue;
                const factor = aug[row][col] / aug[col][col];
                for (let k = col; k <= N; k++) {
                    aug[row][k] -= factor * aug[col][k];
                }
            }
        }

        // Extract solution
        const result: Record<string, number> = {};
        teams.forEach((t, i) => {
            result[t] = aug[i][i] !== 0 ? aug[i][N] / aug[i][i] : 0;
        });

        setOprs(result);
    };

    const filtered = matches.filter((m) => {
        if (filter !== "all" && m.comp_level !== filter) return false;
        return true;
    });

    const sortedOprEntries = Object.entries(oprs).sort(([, a], [, b]) => b - a);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main className="md:ml-64 min-h-screen overflow-auto">
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-mono font-bold">Matches</h1>
                            <p className="text-muted-foreground">Event {eventKey}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button onClick={calculateOPRs}>
                                Calculate OPR
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={filter} onValueChange={setFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="qm">Qual</SelectItem>
                                    <SelectItem value="qf">Quarterfinal</SelectItem>
                                    <SelectItem value="sf">Semifinal</SelectItem>
                                    <SelectItem value="f">Final</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* OPR Results Table */}
                    {sortedOprEntries.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-mono text-lg">OPR Results</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                    {sortedOprEntries.map(([teamKey, opr], rank) => (
                                        <div
                                            key={teamKey}
                                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm font-mono"
                                        >
                                            <span className="text-muted-foreground text-xs mr-1">#{rank + 1}</span>
                                            <span className="font-semibold">{teamKey.replace("frc", "")}</span>
                                            <span className="text-primary ml-2">{opr.toFixed(1)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {loading && <p className="text-muted-foreground">Loading matches…</p>}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {!loading &&
                            filtered.map((m) => {
                                const absent = notPlaying[m.key] ?? new Set<string>();
                                return (
                                    <Card key={m.key}>
                                        <CardHeader>
                                            <CardTitle className="flex items-center justify-between">
                                                <span>
                                                    {levelLabel(m.comp_level)} {m.match_number}
                                                </span>
                                                <Calendar className="w-4 h-4 text-muted-foreground"/>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm space-y-2">
                                            {/* Red Alliance */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-400 w-10 shrink-0 text-xs">Red</span>
                                                <div className="grid grid-cols-3 gap-1 flex-1">
                                                    {m.alliances.red.team_keys.map((teamKey) => {
                                                        const teamNum = teamKey.replace("frc", "");
                                                        const isAbsent = absent.has(teamKey);
                                                        return (
                                                            <Button
                                                                key={teamKey}
                                                                size="sm"
                                                                variant={isAbsent ? "destructive" : "outline"}
                                                                className={`w-full text-xs transition-all ${
                                                                    isAbsent
                                                                        ? "opacity-60 line-through"
                                                                        : "border-red-400/40 hover:border-red-400"
                                                                }`}
                                                                onClick={() => toggleNotPlaying(m.key, teamKey)}
                                                            >
                                                                {teamNum}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                                <span className="w-10 text-right shrink-0 text-xs font-mono">
                                                    {m.alliances.red.score >= 0 ? m.alliances.red.score : "—"}
                                                </span>
                                            </div>

                                            {/* Blue Alliance */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-400 w-10 shrink-0 text-xs">Blue</span>
                                                <div className="grid grid-cols-3 gap-1 flex-1">
                                                    {m.alliances.blue.team_keys.map((teamKey) => {
                                                        const teamNum = teamKey.replace("frc", "");
                                                        const isAbsent = absent.has(teamKey);
                                                        return (
                                                            <Button
                                                                key={teamKey}
                                                                size="sm"
                                                                variant={isAbsent ? "destructive" : "outline"}
                                                                className={`w-full text-xs transition-all ${
                                                                    isAbsent
                                                                        ? "opacity-60 line-through"
                                                                        : "border-blue-400/40 hover:border-blue-400"
                                                                }`}
                                                                onClick={() => toggleNotPlaying(m.key, teamKey)}
                                                            >
                                                                {teamNum}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                                <span className="w-10 text-right shrink-0 text-xs font-mono">
                                                    {m.alliances.blue.score >= 0 ? m.alliances.blue.score : "—"}
                                                </span>
                                            </div>

                                            {/* Absent summary */}
                                            {absent.size > 0 && (
                                                <p className="text-xs text-destructive/80 mt-1">
                                                    Did not play: {[...absent].map(k => k.replace("frc", "")).join(", ")}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OPR;
