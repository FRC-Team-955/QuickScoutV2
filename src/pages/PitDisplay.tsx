import {useEffect, useMemo, useState} from "react";
import {ExternalLink, RefreshCw, Tv} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import {getEventMatches, getEventMedia, getEventStatus} from "@/lib/tba";

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

type TbaMedia = {
    type?: string;
    foreign_key?: string;
    preferred?: boolean;
    details?: Record<string, unknown> | null;
};

const EVENT_KEY = "2026orore";

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

const formatTeams = (keys: string[]) =>
    keys
        .map((k) => Number(k.replace("frc", "")))
        .filter(Boolean)
        .join(", ");

const formatMatchTime = (match: TbaMatch) => {
    const timestamp = match.actual_time ?? match.predicted_time ?? match.time;
    if (!timestamp) return "TBD";
    return new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
    });
};

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

const getStreamVideoId = (media: TbaMedia[]) => {
    const sorted = [...media].sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)));
    const item = sorted.find((entry) => entry.type === "youtube" && entry.foreign_key);
    return item?.foreign_key || null;
};

const PitDisplay = () => {
    const [matches, setMatches] = useState<TbaMatch[]>([]);
    const [status, setStatus] = useState<any | null>(null);
    const [media, setMedia] = useState<TbaMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [matchData, statusData, mediaData] = await Promise.all([
                    getEventMatches(EVENT_KEY),
                    getEventStatus(EVENT_KEY),
                    getEventMedia(EVENT_KEY),
                ]);

                if (!mounted) return;

                const sortedMatches = [...(matchData || [])].sort((a: TbaMatch, b: TbaMatch) => {
                    const levelDiff =
                        (compLevelOrder[a.comp_level] ?? 99) - (compLevelOrder[b.comp_level] ?? 99);
                    return levelDiff || a.match_number - b.match_number;
                });

                setMatches(sortedMatches);
                setStatus(statusData || null);
                setMedia(mediaData || []);
            } catch (err) {
                console.error("Failed to load pit display data", err);
                if (mounted) {
                    setMatches([]);
                    setStatus(null);
                    setMedia([]);
                    setError("Unable to load TBA match data right now.");
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
    }, [refreshCount]);

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

    const currentMatch = currentIndex >= 0 ? matches[currentIndex] : null;
    const streamVideoId = useMemo(() => getStreamVideoId(media), [media]);
    const streamUrl = streamVideoId
        ? `https://www.youtube.com/embed/${streamVideoId}?autoplay=1&playsinline=1&mute=0&rel=0&modestbranding=1`
        : null;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="mx-auto max-w-[1800px] p-4 md:p-6 lg:p-8">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Local display</p>
                        <h1 className="text-3xl md:text-4xl font-mono font-bold">PitDisplay</h1>
                        <p className="text-muted-foreground">Event {EVENT_KEY}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="px-3 py-1">
                            {loading ? "Loading matches" : currentMatch ? `Current: ${levelLabel(currentMatch.comp_level)} ${currentMatch.match_number}` : "No current match"}
                        </Badge>
                        <Button variant="outline" onClick={() => setRefreshCount((count) => count + 1)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {error && (
                    <Card className="mb-6 border-destructive/40">
                        <CardContent className="p-4 text-destructive">{error}</CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6 items-start">
                    <section className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-3">
                                    <span className="font-mono text-xl">Match Window</span>
                                    <Badge variant="outline">Top-left summary</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {currentMatch ? (
                                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm uppercase tracking-wide text-muted-foreground">Current match</p>
                                                <h2 className="text-2xl font-mono font-bold">
                                                    {levelLabel(currentMatch.comp_level)} {currentMatch.match_number}
                                                </h2>
                                                <p className="text-sm text-muted-foreground">{currentMatch.key}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Scheduled / live time</p>
                                                <p className="text-lg font-mono font-semibold">{formatMatchTime(currentMatch)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                                                <p className="text-xs uppercase tracking-wide text-red-400 mb-1">Red Alliance</p>
                                                <p className="text-sm">
                                                    Teams: <span className="font-medium">{formatTeams(currentMatch.alliances.red.team_keys)}</span>
                                                </p>
                                                <p className="text-sm">
                                                    Score: <span className="font-mono font-semibold">{currentMatch.alliances.red.score >= 0 ? currentMatch.alliances.red.score : "TBD"}</span>
                                                </p>
                                            </div>

                                            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                                                <p className="text-xs uppercase tracking-wide text-blue-400 mb-1">Blue Alliance</p>
                                                <p className="text-sm">
                                                    Teams: <span className="font-medium">{formatTeams(currentMatch.alliances.blue.team_keys)}</span>
                                                </p>
                                                <p className="text-sm">
                                                    Score: <span className="font-mono font-semibold">{currentMatch.alliances.blue.score >= 0 ? currentMatch.alliances.blue.score : "TBD"}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                                        {loading ? "Loading current match…" : "No match information available yet."}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="font-mono text-xl">Two Before / Two After</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {visibleMatches.length > 0 ? (
                                        visibleMatches.map(({match, relativeIndex}) => {
                                            const isCurrent = relativeIndex === 0;
                                            return (
                                                <div
                                                    key={match.key}
                                                    className={cn(
                                                        "rounded-lg border p-4 space-y-3 transition-colors",
                                                        isCurrent
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border bg-card",
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                                {relativeIndex < 0 ? `${Math.abs(relativeIndex)} previous` : relativeIndex > 0 ? `${relativeIndex} ahead` : "Current"}
                                                            </p>
                                                            <h3 className="font-mono text-lg font-bold">
                                                                {levelLabel(match.comp_level)} {match.match_number}
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground">{formatMatchTime(match)}</p>
                                                        </div>
                                                        {isCurrent && <Badge>Now</Badge>}
                                                    </div>

                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <span className="text-red-400">Red</span>
                                                            <span className="text-right font-medium">
                                                                {formatTeams(match.alliances.red.team_keys)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <span className="text-blue-400">Blue</span>
                                                            <span className="text-right font-medium">
                                                                {formatTeams(match.alliances.blue.team_keys)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm">
                                                            <span className="text-muted-foreground">Scores</span>
                                                            <span className="font-mono">
                                                                R {match.alliances.red.score >= 0 ? match.alliances.red.score : "TBD"} / B {match.alliances.blue.score >= 0 ? match.alliances.blue.score : "TBD"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="md:col-span-2 rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                                            {loading ? "Loading match window…" : "No matches to show."}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="space-y-4 sticky top-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 font-mono text-xl">
                                    <Tv className="h-5 w-5" />
                                    Livestream
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {streamUrl ? (
                                    <div className="space-y-3">
                                        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                                            <div className="aspect-video w-full">
                                                <iframe
                                                    className="h-full w-full"
                                                    src={streamUrl}
                                                    title="TBA Livestream"
                                                    allow="autoplay; encrypted-media; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm text-muted-foreground">
                                                Stream sourced from TBA media
                                            </p>
                                            <Button variant="outline" asChild>
                                                <a href={`https://www.youtube.com/watch?v=${streamVideoId}`} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Open Stream
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                                        No livestream was found for this event in TBA media.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="font-mono text-xl">Display Notes</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm text-muted-foreground">
                                <p>This page is local-only and does not use Firebase.</p>
                                <p>It refreshes the match list every 30 seconds.</p>
                                <p>If the stream does not auto-start with sound, the browser may require a manual click.</p>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default PitDisplay;

