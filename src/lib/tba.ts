const TBA_BASE = "https://www.thebluealliance.com/api/v3";

export const getEventMatches = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}/matches`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    return res.json();
}

export const getEventTeams = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}/teams/keys`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    return res.json();
}

export const getNextUnplayedMatch = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}/matches`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    const matches = await res.json();
    // Find first match with null actual_time (not yet played)
    const nextMatch = matches.find((m: any) => m.actual_time === null);
    return nextMatch || null;
}

export const checkTBAHealth = async () => {
    const res = await fetch("https://www.thebluealliance.com/api/v3/status", {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });
    if (!res.ok) throw new Error("TBA down");
    return res.json();
};

export const getEventStatus = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    return res.json();
};

export const getEventMedia = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}/media`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    return res.json();
};

export const getEventWebcasts = async (eventKey: string) => {
    const res = await fetch(`${TBA_BASE}/event/${eventKey}`, {
        headers: {
            "X-TBA-Auth-Key":
                atob(
                    "MlhFTW10MWpDeTVpUFZFS2k5RXZCVDFYMmlKeEZGUUFZWVlsZ0I1N05hbGJQa0FCMTVsYmZiOVBUTjdvd3NaYQ==",
                ),
        },
    });

    if (!res.ok) {
        throw new Error(`TBA error ${res.status}`);
    }

    const event = await res.json();
    return event.webcasts ?? [];
};

export const buildStreamUrl = (webcast: { type: string; channel: string; file?: string }): string | null => {
    switch (webcast.type) {
        case "twitch":
            return `https://player.twitch.tv/?channel=${webcast.channel}&parent=${window.location.hostname}`;
        case "youtube":
            return `https://www.youtube.com/embed/${webcast.channel}`;
        case "livestream":
            return `https://livestream.com/events/${webcast.file}`;
        default:
            return null;
    }
};

export const getPlayoffMatchLabel = (matchKey: string, compLevel: string): string => {
    // Match key format: eventkey_sf1m1 (semifinal round 1, match 1)
    const parts = matchKey.split("_");
    if (parts.length < 2) return compLevel;
    
    const levelPart = parts[1];
    
    if (compLevel === "sf") {
        // sf1m1 -> SF Round 1
        const sfMatch = levelPart.match(/sf(\d+)m(\d+)/);
        if (sfMatch) {
            return `SF Round ${sfMatch[1]}`;
        }
    } else if (compLevel === "f") {
        // fm1 -> Match 1
        const fMatch = levelPart.match(/fm(\d+)/);
        if (fMatch) {
            return `Match ${fMatch[1]}`;
        }
    } else if (compLevel === "qf") {
        // qf1m1 -> QF Round 1
        const qfMatch = levelPart.match(/qf(\d+)m(\d+)/);
        if (qfMatch) {
            return `QF Round ${qfMatch[1]}`;
        }
    }
    
    return compLevel;
};

