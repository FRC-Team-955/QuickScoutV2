import {Fragment, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useAuth} from "@/contexts/AuthContext";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {get, ref} from "firebase/database";
import {db} from "@/lib/firebase";
import {CLACK_DATE_RANGE, DCMP_DATE_RANGE, OSF_DATE_RANGE} from "@/lib/dateUtils";
import {Boards, buildBoards, collectSubmissions, LeaderboardRow} from "@/lib/leaderboard";

type EventType = "all" | "osf" | "clack" | "dcmp" | "current";

const BOARDS: { event: keyof Boards; title: string; empty: string }[] = [
    {event: "osf", title: `OSF Scout Activity (${OSF_DATE_RANGE})`, empty: "No OSF scouting data found."},
    {event: "clack", title: `Clack Scout Activity (${CLACK_DATE_RANGE})`, empty: "No Clack scouting data found."},
    {event: "dcmp", title: `DCMP Scout Activity (${DCMP_DATE_RANGE})`, empty: "No DCMP scouting data found."},
    {event: "current", title: "Current Event Scout Activity", empty: "No current event scouting data found."},
];

const EMPTY_BOARDS: Boards = {osf: [], clack: [], dcmp: [], current: []};
const TABS = new Set(["dashboard", "scouting", "pit-scouting", "analytics", "matches", "opr", "leaderboard"]);

const Leaderboard = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("leaderboard");
    const [eventType, setEventType] = useState<EventType>("all");
    const [loading, setLoading] = useState(false);
    const [boards, setBoards] = useState<Boards>(EMPTY_BOARDS);
    const [scoutCount, setScoutCount] = useState(0);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (TABS.has(tab)) navigate(`/${tab}`);
    };

    const renderLeaderboardCard = (title: string, rows: LeaderboardRow[]) => (
        <Card>
            <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-mono">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Rank</TableHead>
                                <TableHead>Scout</TableHead>
                                <TableHead className="text-right">Matches Scouted</TableHead>
                                <TableHead className="text-right">Last Submission</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, index) => (
                                <TableRow
                                    key={row.key}
                                    className={row.key === user?.name?.trim().toLowerCase() ? "bg-primary/5" : undefined}
                                >
                                    <TableCell className="font-mono">{index + 1}</TableCell>
                                    <TableCell className="font-medium">{row.scoutName}</TableCell>
                                    <TableCell className="text-right font-mono">{row.matches}</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {row.lastSubmitted ? new Date(row.lastSubmitted).toLocaleString() : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const [matchesSnap, subjectiveSnap] = await Promise.all([
                    get(ref(db, "matches")),
                    get(ref(db, "subjectiveMatches")),
                ]);
                const submissions = collectSubmissions(matchesSnap.val(), subjectiveSnap.val());
                setBoards(buildBoards(submissions));
                setScoutCount(submissions.size);
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
                setBoards(EMPTY_BOARDS);
                setScoutCount(0);
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
                            {loading ? "Loading…" : `${scoutCount} scouts`}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                    ) : scoutCount === 0 ? (
                        <Card>
                            <CardContent className="p-6 text-sm text-muted-foreground">
                                No submitted scouting data found yet.
                            </CardContent>
                        </Card>
                    ) : (
                        BOARDS.filter(({event}) => eventType === "all" ? boards[event].length > 0 : eventType === event).map(({event, title, empty}) =>
                            boards[event].length > 0 ? (
                                <Fragment key={event}>{renderLeaderboardCard(title, boards[event])}</Fragment>
                            ) : (
                                <Card key={event}>
                                    <CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent>
                                </Card>
                            ))
                    )}
                </div>
            </main>
        </div>
    );
};

export default Leaderboard;

