import {useEffect, useMemo, useState} from "react";
import {LogOut} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {cn} from "@/lib/utils";
import {
    buildStreamUrl,
    getEventMatches,
    getEventStatus,
    getPlayoffMatchLabel,
    isEmbeddable,
    levelLabel,
    pickWebcast,
    TBA_EVENT_KEY,
    type TbaMatch,
    type Webcast,
} from "@/lib/tba";
import {getEventLiveStatus, NEXUS_EVENT_KEY, type NexusEventStatusResponse} from "@/lib/nexus";
import {useAuth} from "@/contexts/AuthContext";

const TEAM_NUMBER = "955";

const compLevelOrder: Record<string, number> = {qm: 0, qf: 1, sf: 2, f: 3};

// Both alliances must be fully populated with real "frcNNNN" keys; otherwise show TBD.
const areTeamsPopulated = (match: TbaMatch): boolean =>
    [match.alliances.red, match.alliances.blue].every(
        (a) => a.team_keys?.length > 0 && a.team_keys.every((team) => typeof team === "string" && team.startsWith("frc")),
    );

const getMatchSortTime = (match: TbaMatch): number =>
    match.actual_time ?? match.predicted_time ?? match.time ?? Number.MAX_SAFE_INTEGER;

const sortMatches = (matches: TbaMatch[]) =>
    [...matches].sort((a, b) =>
        getMatchSortTime(a) - getMatchSortTime(b) ||
        (compLevelOrder[a.comp_level] ?? 99) - (compLevelOrder[b.comp_level] ?? 99) ||
        a.match_number - b.match_number ||
        a.key.localeCompare(b.key),
    );

const getMatchLabel = (match: TbaMatch) => {
    if (match.comp_level === "qm") return `${levelLabel(match.comp_level)} ${match.match_number}`;
    return areTeamsPopulated(match) ? getPlayoffMatchLabel(match.key, match.comp_level) : "TBD";
};

const formatTeams = (keys: string[]) =>
    keys
        .map((k) => Number(k.replace("frc", "")))
        .filter(Boolean)
        .join(", ") || "—";

const isTeamInMatch = (teams: string[] | undefined, teamNumber: string) =>
    (teams ?? []).some((team) => String(team).replace(/^frc/i, "") === teamNumber);

// Nexus times are epoch ms; tolerate epoch seconds too.
const getEstimatedQueueTimeMs = (estimatedQueueTime?: number | null): number | null =>
    estimatedQueueTime == null ? null : estimatedQueueTime < 10_000_000_000 ? estimatedQueueTime * 1000 : estimatedQueueTime;

const formatCountdown = (ms: number | null): string => {
    if (ms == null) return "ETA unavailable";

    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    if (totalSeconds === 0) return "Queuing now";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    return `${seconds}s`;
};

// Depth-first search for the first TBA match key (e.g. 2026joh_qm12, 2026joh_sf1m1) anywhere in value.
const extractMatchKey = (value: unknown): string | null => {
    if (typeof value === "string") return /_(qm|(qf|sf|f)\d+m)\d+$/i.test(value) ? value : null;
    if (!value || typeof value !== "object") return null;
    for (const nested of Object.values(value)) {
        const found = extractMatchKey(nested);
        if (found) return found;
    }
    return null;
};

// Apply each settled result independently so one failing endpoint keeps the last good data for the others.
const applySettled = <T,>(result: PromiseSettledResult<T>, apply: (value: T) => void, what: string) => {
    if (result.status === "fulfilled") apply(result.value);
    else console.warn(`Failed to load ${what}`, result.reason);
};

const PitDisplay = () => {
    const {logout} = useAuth();
    const navigate = useNavigate();
    const [matches, setMatches] = useState<TbaMatch[]>([]);
    const [status, setStatus] = useState<Record<string, unknown> | null>(null);
    const [webcasts, setWebcasts] = useState<Webcast[]>([]);
    const [nexusStatus, setNexusStatus] = useState<NexusEventStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/login", {replace: true});
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            const [matchData, eventData, queueData] = await Promise.allSettled([
                getEventMatches(TBA_EVENT_KEY),
                getEventStatus(TBA_EVENT_KEY),
                getEventLiveStatus(NEXUS_EVENT_KEY),
            ]);
            if (!mounted) return;

            applySettled(matchData, (data) => setMatches(sortMatches(data ?? [])), "TBA matches");
            applySettled(eventData, (data) => {
                setStatus(data ?? null);
                setWebcasts(data?.webcasts ?? []);
            }, "TBA event");
            applySettled(queueData, (data) => setNexusStatus(data ?? null), "Nexus queue data");
            setLoading(false);
        };

        load();
        const interval = window.setInterval(load, 30000);

        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const tick = window.setInterval(() => setCurrentTime(new Date()), 1000);
        return () => window.clearInterval(tick);
    }, []);

    const currentMatchKey = useMemo(() => extractMatchKey(status), [status]);

    const currentIndex = useMemo(() => {
        if (!matches.length) return -1;

        if (currentMatchKey) {
            const keyedIndex = matches.findIndex((match) => match.key === currentMatchKey);
            if (keyedIndex >= 0) return keyedIndex;
        }

        const firstUpcoming = matches.findIndex((match) => match.actual_time == null);
        if (firstUpcoming >= 0) return firstUpcoming;

        return matches.length - 1;
    }, [currentMatchKey, matches]);

    const visibleMatches = useMemo(() => {
        if (!matches.length || currentIndex < 0) return [];
        const start = Math.max(0, currentIndex - 2);
        const end = Math.min(matches.length, currentIndex + 3);
        return matches.slice(start, end).map((match, index) => ({
            match,
            relativeIndex: start + index - currentIndex,
        }));
    }, [currentIndex, matches]);

    const webcast = useMemo(() => pickWebcast(webcasts), [webcasts]);
    const streamUrl = buildStreamUrl(webcast);

    const queueEntry = useMemo(() => {
        if (!nexusStatus?.matches?.length) return null;

        const teamMatches = nexusStatus.matches.filter(
            (match) =>
                isTeamInMatch(match.redTeams, TEAM_NUMBER) ||
                isTeamInMatch(match.blueTeams, TEAM_NUMBER),
        );

        if (!teamMatches.length) return null;

        const nextMatch =
            teamMatches.find((match) => (match.status ?? "").trim().toLowerCase() !== "on field") ?? teamMatches[0];

        const etaMs = getEstimatedQueueTimeMs(nextMatch.times?.estimatedQueueTime);
        const allianceColor = isTeamInMatch(nextMatch.redTeams, TEAM_NUMBER) ? "Red" : "Blue";

        return {match: nextMatch, etaMs, allianceColor};
    }, [nexusStatus]);

    const queueCountdownMs = queueEntry?.etaMs != null ? queueEntry.etaMs - currentTime.getTime() : null;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="max-w-[1800px] mx-auto px-6 py-6 flex items-start justify-between relative">
                    <div className="space-y-2 flex-1 text-center">
                        <div className="flex items-center justify-center gap-4">
                            <h1 className="text-4xl font-bold font-mono">Team 955</h1>
                            <p className="text-4xl font-bold font-mono">-</p>
                            <p className="text-4xl font-bold font-mono">
                                {currentTime.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                            </p>
                        </div>
                        <p className="text-lg text-muted-foreground">Event: {TBA_EVENT_KEY}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleLogout}
                        className="h-10 w-10 absolute right-6"
                    >
                        <LogOut className="h-5 w-5"/>
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex gap-4 p-4 overflow-hidden">
                    {/* Left: Match Schedule */}
                    <section className="w-80 flex flex-col overflow-auto border border-border rounded-lg p-4">
                        {visibleMatches.length > 0 ? (
                            <div className="space-y-3">
                                {visibleMatches.map(({match, relativeIndex}) => {
                                    const isCurrent = relativeIndex === 0;
                                    return (
                                        <div
                                            key={match.key}
                                            className={cn(
                                                "rounded-lg border p-4 space-y-3 transition-colors",
                                                isCurrent
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-card/50",
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="font-mono font-bold text-base">
                                                    {getMatchLabel(match)}
                                                </h3>
                                                {isCurrent && <Badge className="text-xs">Now</Badge>}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-red-400 font-medium text-sm">Red</span>
                                                    <span className="text-right text-sm">
                                                        {areTeamsPopulated(match) ? formatTeams(match.alliances.red.team_keys) : "TBD"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-blue-400 font-medium text-sm">Blue</span>
                                                    <span className="text-right text-sm">
                                                        {areTeamsPopulated(match) ? formatTeams(match.alliances.blue.team_keys) : "TBD"}
                                                    </span>
                                                </div>
                                                <div
                                                    className="flex justify-between items-center gap-2 pt-2 border-t border-border/50">
                                                    <span className="text-muted-foreground text-sm">Score</span>
                                                    <span className="font-mono text-sm">
                                                        {areTeamsPopulated(match) ? (
                                                            <>R {match.alliances.red.score >= 0 ? match.alliances.red.score : "—"} /
                                                                B {match.alliances.blue.score >= 0 ? match.alliances.blue.score : "—"}</>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                {loading ? "Loading matches…" : "No matches available"}
                            </div>
                        )}
                    </section>

                    {/* Right: Livestream */}
                    <section className="flex-1 flex flex-col overflow-hidden border border-border rounded-lg bg-black">
                        {isEmbeddable(webcast) && streamUrl ? (
                            <iframe
                                className="w-full h-full"
                                src={streamUrl}
                                title="TBA Livestream"
                                allow="autoplay; encrypted-media; picture-in-picture"
                                allowFullScreen
                            />
                        ) : streamUrl ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <a
                                    href={streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline"
                                >
                                    Open Stream: {webcast.type.toUpperCase()}
                                </a>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                {loading ? "Loading stream…" : "No stream available"}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* Bottom: Queue */}
            <section
                className="border-t border-border bg-card/50 flex items-center justify-center text-foreground py-8">
                <div className="px-4">
                    <p className="text-3xl font-bold font-mono text-center">
                        {queueEntry ? (
                            `Team 955's next match is ${queueEntry.match.label}${queueEntry.match.status ? ` - ${queueEntry.match.status}` : ""} - ${queueEntry.allianceColor} Bumpers - Queued in ${formatCountdown(queueCountdownMs)}`
                        ) : loading ? (
                            "Loading queue…"
                        ) : (
                            "Team 955 doesn't have any future matches scheduled yet"
                        )}
                    </p>
                </div>
            </section>
        </div>
    );
};

export default PitDisplay;

