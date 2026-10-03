import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {Input} from "@/components/ui/input";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog";
import {useAuth} from "@/contexts/AuthContext";
import {get, ref, remove} from "firebase/database";
import {db} from "@/lib/firebase";
import {CLACK_DATE_RANGE, DCMP_DATE_RANGE, GIRLS_GEN_DATE_RANGE, OSF_DATE_RANGE} from "@/lib/dateUtils";
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
import {Trash2} from "lucide-react";
import {toast} from "sonner";
import {
    buildCsv,
    EventType,
    MatchEntry,
    matchesSelectedEvent,
    matchStats,
    parseMatches,
    parsePitScouting,
    parseSubjective,
    PitScoutingEntry,
    SortBy,
    sortMatches,
    SubjectiveScoutingEntry,
} from "./analytics/data";
import {MatchReportCard, PitCard, StatGrid, SubjectiveCard, TeamNumberInput} from "./analytics/cards";

export type {MatchEntry, PitScoutingEntry, SubjectiveScoutingEntry} from "./analytics/data";

type DeleteTarget = {
    kind: "match" | "pit" | "subjective";
    id: string;
    path: string;
    label: string;
};

const Analytics = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("analytics");
    const [viewTab, setViewTab] = useState("all");
    const [sortBy, setSortBy] = useState<SortBy>("newest");
    const [teamNumberInput, setTeamNumberInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);
    const [pitScoutingEntries, setPitScoutingEntries] = useState<PitScoutingEntry[]>([]);
    const [pitTeamNumberInput, setPitTeamNumberInput] = useState("");
    const [subjectiveScoutingEntries, setSubjectiveScoutingEntries] = useState<SubjectiveScoutingEntry[]>([]);
    const [eventType, setEventType] = useState<EventType>("all");
    const [scouterSearchInput, setScouterSearchInput] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);

    const isLead = !!user?.isLead;

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (["dashboard", "scouting", "analytics", "pit-scouting", "matches", "opr", "leaderboard"].includes(tab)) navigate(`/${tab}`);
    };

    const handleDeleteConfirmed = async () => {
        // path comes from the keys the entry was read from (see dbPath); never delete without one
        if (!deleteTarget?.path || !isLead) return;

        try {
            setDeleting(true);
            await remove(ref(db, deleteTarget.path));

            const drop = <T extends { id: string }>(prev: T[]) => prev.filter((entry) => entry.id !== deleteTarget.id);
            if (deleteTarget.kind === "match") setMatchEntries(drop);
            else if (deleteTarget.kind === "pit") setPitScoutingEntries(drop);
            else setSubjectiveScoutingEntries(drop);

            toast("Scouting report deleted.");
        } catch (error) {
            console.error("Failed to delete scouting report:", error);
            toast("Failed to delete scouting report.");
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const deleteButton = (kind: DeleteTarget["kind"], entry: { id: string; path?: string | null }, label: string) => (
        isLead && entry.path ? (
            <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setDeleteTarget({kind, id: entry.id, path: entry.path, label})}
                aria-label="Delete scouting report"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        ) : null
    );
    const matchDelete = (e: MatchEntry) => deleteButton("match", e, `Team ${e.teamNumber} • Match ${e.matchKey.slice(-6)}`);
    const pitDelete = (e: PitScoutingEntry) => deleteButton("pit", e, `Team ${e.teamNumber} • Pit scouting`);
    const subjectiveDelete = (e: SubjectiveScoutingEntry) => deleteButton("subjective", e, `Team ${e.teamNumber} • Subjective scouting`);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [matches, pits, subjectives] = await Promise.all(
                    ["matches", "pitScouting", "subjectiveMatches"].map((path) => get(ref(db, path))),
                );
                setMatchEntries(parseMatches(matches.val()));
                setPitScoutingEntries(parsePitScouting(pits.val()));
                setSubjectiveScoutingEntries(parseSubjective(subjectives.val()));
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const sortedAndFiltered = useMemo(
        () => sortMatches(matchEntries.filter((e) => matchesSelectedEvent(e.submittedAt, eventType)), sortBy),
        [matchEntries, eventType, sortBy],
    );

    const teamNum = parseInt(teamNumberInput, 10);

    const teamSpecificData = useMemo(() => {
        const matches = sortedAndFiltered.filter((entry) => entry.teamNumber === teamNum);
        return matches.length ? {teamNum, matches, stats: matchStats(matches)} : null;
    }, [sortedAndFiltered, teamNum]);

    const filteredPitScoutingEntries = useMemo(
        () => pitScoutingEntries.filter((e) => matchesSelectedEvent(e.submittedAt, eventType)),
        [pitScoutingEntries, eventType],
    );

    const teamPitEntries = useMemo(
        () => filteredPitScoutingEntries.filter((e) => e.teamNumber === teamNum),
        [filteredPitScoutingEntries, teamNum],
    );

    const pitTabEntries = useMemo(() => {
        const n = parseInt(pitTeamNumberInput, 10);
        return isNaN(n) ? filteredPitScoutingEntries : filteredPitScoutingEntries.filter((e) => e.teamNumber === n);
    }, [filteredPitScoutingEntries, pitTeamNumberInput]);

    // newest first; empty/invalid team input = all teams
    const filteredSubjectiveScoutingEntries = useMemo(
        () => subjectiveScoutingEntries
            .filter((e) => matchesSelectedEvent(e.submittedAt, eventType) && (isNaN(teamNum) || Number(e.teamNumber) === teamNum))
            .sort((a, b) => b.submittedAt - a.submittedAt),
        [subjectiveScoutingEntries, eventType, teamNum],
    );

    const scouterData = useMemo(() => {
        const searchTerm = scouterSearchInput.trim().toLowerCase();
        if (!searchTerm) return null;
        const matches = sortedAndFiltered.filter((entry) => entry.scoutName.toLowerCase().includes(searchTerm));
        if (matches.length === 0) return null;
        return {
            scouterName: scouterSearchInput,
            matches,
            uniqueTeamCount: new Set(matches.map((m) => m.teamNumber)).size,
            stats: matchStats(matches),
        };
    }, [sortedAndFiltered, scouterSearchInput]);

    const bubbleData = useMemo(() => sortedAndFiltered.map((m) => ({
        x: m.score_teleop,
        y: m.score_auto,
        r: Math.max(3, (m.climbValue || 0) * 6),
        robotTipped: !!m.robotTipped,
        robotDead: !!m.robotDead,
        team: m.teamNumber,
        id: m.id,
    })), [sortedAndFiltered]);

    const handleExportAllData = () => {
        const blob = new Blob([buildCsv(matchEntries, pitScoutingEntries, subjectiveScoutingEntries)], {type: "text/csv;charset=utf-8;"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `QuickScout_Export_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const emptyState = (text: string) => (
        <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{text}</p>
        </div>
    );

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
                            <TabsTrigger value="scouter">Scouter Search</TabsTrigger>
                            <TabsTrigger value="bubble">Bubble Chart</TabsTrigger>
                            <TabsTrigger value="pit-scouting">Pit Scouting</TabsTrigger>
                            <TabsTrigger value="subjective">Subjective Scouting</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-3 py-4">
                            <span className="text-sm font-medium">Event Type:</span>
                            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Events</SelectItem>
                                    <SelectItem value="osf">OSF ({OSF_DATE_RANGE})</SelectItem>
                                    <SelectItem value="clack">Clack ({CLACK_DATE_RANGE})</SelectItem>
                                    <SelectItem value="dcmp">DCMP ({DCMP_DATE_RANGE})</SelectItem>
                                    <SelectItem value="girlsgen">Girls' Gen ({GIRLS_GEN_DATE_RANGE})</SelectItem>
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
                                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
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
                                                <CardTitle className="flex justify-between items-start gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xl">Team {entry.teamNumber}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <div className="bg-secondary px-2 py-1 rounded text-[10px] font-mono">
                                                            {entry.matchKey.slice(-6)}
                                                        </div>
                                                        {matchDelete(entry)}
                                                    </div>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                <div className="flex justify-between border-b border-border/50 pb-1">
                                                    <span className="text-muted-foreground">Scout:</span>
                                                    <span className="font-medium">{entry.scoutName}</span>
                                                </div>
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
                                <TeamNumberInput value={teamNumberInput} onChange={setTeamNumberInput}
                                                 placeholder="Enter team number" label="Team number"/>
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

                                    <StatGrid stats={teamSpecificData.stats}/>

                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Individual Match Reports</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {teamSpecificData.matches.map((entry) => (
                                                <MatchReportCard key={entry.id} entry={entry} by="team" action={matchDelete(entry)}/>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : emptyState(teamNumberInput ? "No match data found for this team" : "Enter a team number to view analytics")}

                            <h3 className="font-semibold text-lg mb-3">Subjective Scouting Data</h3>
                            {loading ? (
                                <p>Loading subjective scouting data...</p>
                            ) : teamNumberInput === "" ? (
                                emptyState("Enter a team number to view team subjective data")
                            ) : filteredSubjectiveScoutingEntries.length === 0 ? (
                                <p className="text-muted-foreground">No subjective scouting data found</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {filteredSubjectiveScoutingEntries.map((entry) => (
                                        <SubjectiveCard key={entry.id} entry={entry} action={subjectiveDelete(entry)}/>
                                    ))}
                                </div>
                            )}

                            <h3 className="font-semibold text-lg mb-3">Pit Scouting Data</h3>
                            {loading ? (
                                <p>Loading pit scouting data...</p>
                            ) : teamNumberInput === "" ? (
                                emptyState("Enter a team number to view team pit data")
                            ) : teamPitEntries.length === 0 ? (
                                <p className="text-muted-foreground">No pit scouting data found</p>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {teamPitEntries.map((entry) => (
                                        <PitCard key={entry.id} entry={entry} action={pitDelete(entry)}/>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="scouter" className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Enter scouter name"
                                    value={scouterSearchInput}
                                    onChange={(e) => setScouterSearchInput(e.target.value)}
                                    aria-label="Scouter name"
                                    className="w-64"
                                />
                            </div>

                            {scouterData ? (
                                <div className="space-y-4">
                                    <Card className="border-2 border-primary">
                                        <CardHeader>
                                            <CardTitle className="text-2xl">{scouterData.scouterName}</CardTitle>
                                            <p className="text-muted-foreground text-sm">{scouterData.matches.length} matches • {scouterData.uniqueTeamCount} unique teams</p>
                                        </CardHeader>
                                    </Card>

                                    <StatGrid stats={scouterData.stats}/>

                                    <div>
                                        <h3 className="font-semibold text-lg mb-3">Individual Match Reports</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {scouterData.matches.map((entry) => (
                                                <MatchReportCard key={entry.id} entry={entry} by="scouter" action={matchDelete(entry)}/>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : emptyState(scouterSearchInput ? "No data found for this scouter" : "Enter a scouter name to view analytics")}
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
                                                <ReTooltip
                                                    cursor={{strokeDasharray: '3 3'}}
                                                    content={({payload}) => {
                                                        if (!payload || payload.length === 0) return null;
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-background border border-border rounded shadow-md p-3 text-sm space-y-1">
                                                                <p className="font-bold text-base">Team {d.team}</p>
                                                                <p><span className="text-muted-foreground">Teleop:</span> {d.x}</p>
                                                                <p><span className="text-muted-foreground">Auto:</span> {d.y}</p>
                                                                <p><span className="text-muted-foreground">Climb:</span> {d.r > 3 ? d.r / 6 : 0}</p>
                                                                {d.robotTipped && <p className="text-red-500 font-semibold">⚠ Robot Tipped</p>}
                                                                {d.robotDead && <p className="text-black font-semibold">💀 Robot Dead</p>}
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                <Legend/>
                                                <Scatter
                                                    name="Scouts"
                                                    data={bubbleData}
                                                    fill="#00C853"
                                                    shape={(props: { cx?: number; cy?: number; payload?: (typeof bubbleData)[number] }) => {
                                                        const {cx, cy, payload} = props;
                                                        // black = dead robot, red = tipped, green = normal
                                                        const color = payload?.robotDead ? '#000000' : payload?.robotTipped ? '#FF5252' : '#2ECC71';
                                                        const radius = payload?.r || 6;
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
                                <TeamNumberInput value={pitTeamNumberInput} onChange={setPitTeamNumberInput}
                                                 placeholder="Enter team number (optional)" label="Pit scouting team number"/>
                            </div>

                            {loading || filteredPitScoutingEntries.length === 0 ? (
                                <Card>
                                    <CardContent className="py-8">
                                        <p className="text-center text-muted-foreground">
                                            {loading ? "Loading pit scouting data..." : "No pit scouting data available"}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-muted-foreground">Viewing {pitTabEntries.length} pit scouting entries</p>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {pitTabEntries.map((entry) => (
                                            <PitCard key={entry.id} entry={entry} action={pitDelete(entry)}/>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="subjective" className="space-y-4">
                            <div className="flex gap-2 items-center mb-4">
                                <TeamNumberInput value={teamNumberInput} onChange={setTeamNumberInput}
                                                 placeholder="Enter team number (optional)" label="Subjective team number"
                                                 className="max-w-xs"/>
                            </div>
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
                                        <SubjectiveCard key={entry.id} entry={entry} action={subjectiveDelete(entry)}/>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete scouting report</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span>Are you sure you want to delete this? This cannot be undone.</span>
                            {deleteTarget && <span className="block text-xs text-muted-foreground">{deleteTarget.label}</span>}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirmed}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting..." : "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Analytics;
