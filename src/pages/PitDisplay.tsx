import {useEffect, useMemo, useState} from "react";
import {LogOut} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {cn} from "@/lib/utils";
import {getEventMatches, getEventWebcasts, getEventStatus, buildStreamUrl, getPlayoffMatchLabel} from "@/lib/tba";
import {useAuth} from "@/contexts/AuthContext";

type TbaMatch = {
    key: string;
    match_number: number;
    comp_level: "qm" | "qf" | "sf" | "f";
    alliances: {
        red: { team_keys: string[]; score: number };
        blue: { team_keys: string[]; score: number };
    };
    actual_time?: number | null;
    predicted_time?: number | null;
    time?: number;
};

const EVENT_KEY = "2026inwas";

const compLevelOrder: Record<string, number> = {
    qm: 0,
    qf: 1,
    sf: 2,
    f: 3,
};

const levelLabel = (lvl: string) => {
    if (lvl === "qm") return "Qual";
    if (lvl === "qf") return "Quarterfinal";
    if (lvl === "sf") return "Semifinal";
    if (lvl === "f") return "Final";
    return lvl;
};

const getMatchLabel = (match: TbaMatch) => {
    if (match.comp_level === "sf" || match.comp_level === "f" || match.comp_level === "qf") {
        const label = getPlayoffMatchLabel(match.key, match.comp_level);
        return label;
    }
    return `${levelLabel(match.comp_level)} ${match.match_number}`;
};

const areTeamsPopulated = (match: TbaMatch): boolean => {
    // Check if both red and blue teams have actual team identifiers
    const redTeams = match.alliances.red.team_keys || [];
    const blueTeams = match.alliances.blue.team_keys || [];
    
    // Teams should be populated with actual team numbers (e.g., "frc1234")
    // If either side has no teams or incomplete teams, show TBD
    const hasValidRedTeams = redTeams.length > 0 && redTeams.every((team) => team && typeof team === "string" && team.startsWith("frc"));
    const hasValidBlueTeams = blueTeams.length > 0 && blueTeams.every((team) => team && typeof team === "string" && team.startsWith("frc"));
    
    return hasValidRedTeams && hasValidBlueTeams;
};

const formatTeams = (keys: string[]) =>
    keys
        .map((k) => Number(k.replace("frc", "")))
        .filter(Boolean)
        .join(", ") || "—";

const extractMatchKey = (value: unknown): string | null => {
    if (typeof value === "string" && /_(qm|qf|sf|f)\d+$/i.test(value)) {
        return value;
    }

    if (!value || typeof value !== "object") return null;

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = extractMatchKey(item);
            if (nested) return nested;
        }
        return null;
    }

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (key === "current_match_key" || key === "next_match_key" || key === "last_match_key") {
            const nested = extractMatchKey(nestedValue);
            if (nested) return nested;
        }

        const nested = extractMatchKey(nestedValue);
        if (nested) return nested;
    }

    return null;
};

const PitDisplay = () => {
    const {logout} = useAuth();
    const navigate = useNavigate();
    const [matches, setMatches] = useState<TbaMatch[]>([]);
    const [status, setStatus] = useState<Record<string, unknown> | null>(null);
    const [webcasts, setWebcasts] = useState<{ type: string; channel: string; file?: string }[]>([]);
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
        const timer = window.setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setLoading(true);
            try {
                const [matchData, statusData, webcastData] = await Promise.all([
                    getEventMatches(EVENT_KEY),
                    getEventStatus(EVENT_KEY),
                    getEventWebcasts(EVENT_KEY),
                ]);

                if (!mounted) return;

                const sortedMatches = [...(matchData || [])].sort((a: TbaMatch, b: TbaMatch) => {
                    const levelDiff =
                        (compLevelOrder[a.comp_level] ?? 99) - (compLevelOrder[b.comp_level] ?? 99);
                    return levelDiff || a.match_number - b.match_number;
                });

                setMatches(sortedMatches);
                setStatus(statusData || null);
                setWebcasts(webcastData || []);
            } catch (err) {
                console.error("Failed to load pit display data", err);
                if (mounted) {
                    setMatches([]);
                    setStatus(null);
                    setWebcasts([]);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();
        const interval = window.setInterval(load, 30000);

        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
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

    const streamUrl = useMemo(() => {
        if (!webcasts.length) return null;
        const webcast = webcasts[0];
        const url = buildStreamUrl(webcast);
        if (!url) return null;
        
        // Add YouTube embed parameters if it's a YouTube URL
        if (webcast.type === "youtube") {
            return `${url}?autoplay=1&playsinline=1&mute=0&rel=0&modestbranding=1`;
        }
        
        return url;
    }, [webcasts]);

    const isEmbeddable = useMemo(() => {
        return webcasts.length > 0 && (webcasts[0].type === "youtube" || webcasts[0].type === "twitch");
    }, [webcasts]);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="max-w-[1800px] mx-auto px-6 py-6 flex items-start justify-between relative">
                    <div className="space-y-2 flex-1 text-center">
                        <h1 className="text-4xl font-bold font-mono">Team 955 - Pit Display</h1>
                        <p className="text-3xl text-muted-foreground font-mono">
                            {currentTime.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                timeZone: "America/Los_Angeles",
                            })}
                        </p>
                        <p className="text-lg text-muted-foreground">Event: {EVENT_KEY}</p>
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
            <main className="flex-1 flex flex-col overflow-hidden">
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
                                                <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/50">
                                                    <span className="text-muted-foreground text-sm">Score</span>
                                                    <span className="font-mono text-sm">
                                                        {areTeamsPopulated(match) ? (
                                                            <>R {match.alliances.red.score >= 0 ? match.alliances.red.score : "—"} / B {match.alliances.blue.score >= 0 ? match.alliances.blue.score : "—"}</>
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
                        {isEmbeddable && streamUrl ? (
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
                                    Open Stream: {webcasts[0]?.type.toUpperCase()}
                                </a>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                {loading ? "Loading stream…" : "No stream available"}
                            </div>
                        )}
                    </section>
                </div>

                {/* Bottom: Queue */}
                <section
                    className="h-32 border-t border-border bg-card/50 flex items-center justify-center text-muted-foreground rounded-t-lg">
                    {/* Queue section placeholder - API not yet implemented */}
                </section>
            </main>
        </div>
    );
};

export default PitDisplay;




