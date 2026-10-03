const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const TBA_AUTH_KEY = atob("MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==");

// When switching events, also update NEXUS_EVENT_KEY in nexus.ts.
export const TBA_EVENT_KEY = "2026joh";

export type TbaMatch = {
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

export type Webcast = { type: string; channel: string; file?: string };

const tbaFetch = async (path: string) => {
    const res = await fetch(`${TBA_BASE}${path}`, {headers: {"X-TBA-Auth-Key": TBA_AUTH_KEY}});
    if (!res.ok) throw new Error(`TBA error ${res.status}`);
    return res.json();
};

export const getEventMatches = (eventKey: string) => tbaFetch(`/event/${eventKey}/matches`);
export const getEventTeams = (eventKey: string) => tbaFetch(`/event/${eventKey}/teams/keys`);
export const getEventStatus = (eventKey: string) => tbaFetch(`/event/${eventKey}`);
export const checkTBAHealth = () => tbaFetch("/status");

export const levelLabel = (lvl: string) =>
    ({qm: "Qual", qf: "Quarterfinal", sf: "Semifinal", f: "Final"})[lvl] ?? lvl;

export const buildStreamUrl = (webcast?: Webcast | null): string | null => {
    switch (webcast?.type) {
        case "twitch":
            return `https://player.twitch.tv/?channel=${webcast.channel}&parent=${window.location.hostname}`;
        case "youtube":
            return `https://www.youtube.com/embed/${webcast.channel}?autoplay=1&playsinline=1&mute=0&rel=0&modestbranding=1`;
        case "livestream":
            return `https://livestream.com/accounts/${webcast.channel}/events/${webcast.file}`;
        default:
            return null;
    }
};

export const isEmbeddable = (webcast?: Webcast | null) => webcast?.type === "youtube" || webcast?.type === "twitch";

// Prefer YouTube, then Twitch, then anything else we can link to.
export const pickWebcast = (webcasts: Webcast[] = []): Webcast | null =>
    webcasts.find((w) => w.type === "youtube") ??
    webcasts.find((w) => w.type === "twitch") ??
    webcasts.find((w) => buildStreamUrl(w)) ??
    null;

export const getPlayoffMatchLabel = (matchKey: string, compLevel: string): string => {
    // eventkey_sf1m1 -> "SF Round 1", eventkey_qf2m1 -> "QF Round 2", eventkey_f1m2 -> "Match 2"
    const levelPart = matchKey.split("_")[1] ?? "";
    if (compLevel === "f") {
        const m = levelPart.match(/^f\d*m(\d+)$/);
        return m ? `Match ${m[1]}` : compLevel;
    }
    const m = levelPart.match(/^(sf|qf)(\d+)m\d+$/);
    return m && m[1] === compLevel ? `${compLevel.toUpperCase()} Round ${m[2]}` : compLevel;
};
