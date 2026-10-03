/**
 * Event date ranges used to identify and filter scouting data.
 * Windows are [start, end) in Pacific time (all events are in the PNW), so classification
 * doesn't depend on the viewer's timezone. PST is -08:00; DST began 2026-03-08 (-07:00).
 */
const EVENTS = [
    {label: "OSF", start: Date.parse("2026-03-06T00:00:00-08:00"), end: Date.parse("2026-03-08T00:00:00-08:00")},
    {label: "Clack", start: Date.parse("2026-03-26T00:00:00-07:00"), end: Date.parse("2026-03-29T00:00:00-07:00")},
    {label: "DCMP", start: Date.parse("2026-04-09T00:00:00-07:00"), end: Date.parse("2026-04-11T00:00:00-07:00")},
] as const;

/** "OSF" | "Clack" | "DCMP", or "Current" for anything outside every window */
export const getDataLabel = (timestamp: number | undefined | null): string =>
    EVENTS.find((e) => !!timestamp && timestamp >= e.start && timestamp < e.end)?.label ?? "Current";

const inEvent = (label: (typeof EVENTS)[number]["label"]) => (timestamp: number | undefined | null): boolean =>
    getDataLabel(timestamp) === label;

/** Timestamp (ms, from serverTimestamp) falls within the OSF window */
export const isOSFData = inEvent("OSF");
/** Timestamp (ms) falls within the Clack window */
export const isClackData = inEvent("Clack");
/** Timestamp (ms) falls within the DCMP window */
export const isDCMPData = inEvent("DCMP");

/** Split entries by the event their submittedAt falls in */
export const filterByEventType = <T extends { submittedAt?: number }>(
    entries: T[]
): { osf: T[]; clack: T[]; dcmp: T[]; current: T[] } => {
    const out = {osf: [] as T[], clack: [] as T[], dcmp: [] as T[], current: [] as T[]};
    entries.forEach((e) => out[getDataLabel(e.submittedAt).toLowerCase() as keyof typeof out].push(e));
    return out;
};

export const OSF_DATE_RANGE = "3/6/26 - 3/7/26";
export const CLACK_DATE_RANGE = "3/26/26 - 3/28/26";
export const DCMP_DATE_RANGE = "4/9/26 - 4/10/26";
