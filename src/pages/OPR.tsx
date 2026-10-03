import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Calendar} from "lucide-react";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Button} from "@/components/ui/button";

import {TBA_EVENT_KEY, getEventMatches, levelLabel, type TbaMatch} from "@/lib/tba";
import {computeOPRs} from "@/lib/opr";
import {get, ref, set} from "firebase/database";
import {db} from "@/lib/firebase";

const ALLIANCES = [
    {color: "red", label: "Red", labelClass: "text-red-400", borderClass: "border-red-400/40 hover:border-red-400"},
    {color: "blue", label: "Blue", labelClass: "text-blue-400", borderClass: "border-blue-400/40 hover:border-blue-400"},
] as const;

// notPlaying structure in Firebase:
// matchNotPlayeds/{eventKey}/{matchKey}/{teamKey} = true | null (deleted)

const OPR = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("opr");

    const eventKey = TBA_EVENT_KEY;
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState<TbaMatch[]>([]);
    const [filter, setFilter] = useState<string>("all");
    const [oprs, setOprs] = useState<Record<string, number>>({});

    // notPlaying: { [matchKey]: Set<teamKey> }
    const [notPlaying, setNotPlaying] = useState<Record<string, Set<string>>>({});

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        navigate(`/${tab}`);
    };

    // Load matches from TBA
    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                const data = await getEventMatches(eventKey);
                // Unscheduled (time == null) playoff matches go last, not first
                data.sort((a: TbaMatch, b: TbaMatch) =>
                    (a.time ?? Number.MAX_SAFE_INTEGER) - (b.time ?? Number.MAX_SAFE_INTEGER) || a.match_number - b.match_number
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
                const snap = await get(ref(db, `matchNotPlayeds/${eventKey}`));
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

    const setAbsent = (matchKey: string, teamKey: string, absent: boolean) =>
        setNotPlaying(prev => {
            const updated = new Set(prev[matchKey]);
            if (absent) updated.add(teamKey);
            else updated.delete(teamKey);
            return {...prev, [matchKey]: updated};
        });

    // Toggle a team's not-playing state for a specific match (optimistic, reverted on failure)
    const toggleNotPlaying = async (matchKey: string, teamKey: string) => {
        const isAbsent = notPlaying[matchKey]?.has(teamKey) ?? false;
        setAbsent(matchKey, teamKey, !isAbsent);
        try {
            await set(ref(db, `matchNotPlayeds/${eventKey}/${matchKey}/${teamKey}`), isAbsent ? null : true);
        } catch (err) {
            console.error("Failed to save NotPlayed", err);
            setAbsent(matchKey, teamKey, isAbsent);
        }
    };

    const calculateOPRs = () => setOprs(computeOPRs(matches, notPlaying));

    const filtered = matches.filter((m) => filter === "all" || m.comp_level === filter);

    const sortedOprEntries = Object.entries(oprs).sort(([, a], [, b]) => b - a);

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main className="md:ml-64 min-h-screen overflow-auto">
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-mono font-bold">OPR</h1>
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
                                            {ALLIANCES.map(({color, label, labelClass, borderClass}) => (
                                                <div key={color} className="flex items-center gap-2">
                                                    <span className={`${labelClass} w-10 shrink-0 text-xs`}>{label}</span>
                                                    <div className="grid grid-cols-3 gap-1 flex-1">
                                                        {m.alliances[color].team_keys.map((teamKey) => {
                                                            const isAbsent = absent.has(teamKey);
                                                            return (
                                                                <Button
                                                                    key={teamKey}
                                                                    size="sm"
                                                                    variant={isAbsent ? "destructive" : "outline"}
                                                                    className={`w-full text-xs transition-all ${
                                                                        isAbsent ? "opacity-60 line-through" : borderClass
                                                                    }`}
                                                                    onClick={() => toggleNotPlaying(m.key, teamKey)}
                                                                >
                                                                    {teamKey.replace("frc", "")}
                                                                </Button>
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="w-10 text-right shrink-0 text-xs font-mono">
                                                        {m.alliances[color].score >= 0 ? m.alliances[color].score : "—"}
                                                    </span>
                                                </div>
                                            ))}

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
