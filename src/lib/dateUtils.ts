/**
 * Event date ranges used to identify and filter scouting data.
 * Windows are [start, end) in Pacific time (all events are in the PNW), so classification
 * doesn't depend on the viewer's timezone. PST is -08:00; DST began 2026-03-08 (-07:00).
 */
const EVENTS = [
    {key: "osf", label: "OSF", start: Date.parse("2026-03-06T00:00:00-08:00"), end: Date.parse("2026-03-08T00:00:00-08:00")},
    {key: "clack", label: "Clack", start: Date.parse("2026-03-26T00:00:00-07:00"), end: Date.parse("2026-03-29T00:00:00-07:00")},
    {key: "dcmp", label: "DCMP", start: Date.parse("2026-04-09T00:00:00-07:00"), end: Date.parse("2026-04-11T00:00:00-07:00")},
    {key: "girlsgen", label: "Girls' Gen", start: Date.parse("2026-10-03T00:00:00-07:00"), end: Date.parse("2026-10-04T00:00:00-07:00")},
] as const;

export type EventKey = (typeof EVENTS)[number]["key"] | "current";

const findEvent = (timestamp: number | undefined | null) =>
    EVENTS.find((e) => !!timestamp && timestamp >= e.start && timestamp < e.end);

/** Display label ("OSF", "Girls' Gen", ...), or "Current" for anything outside every window */
export const getDataLabel = (timestamp: number | undefined | null): string => findEvent(timestamp)?.label ?? "Current";

/** Stable key for filters/boards ("osf", "girlsgen", ...), or "current" */
export const getEventKey = (timestamp: number | undefined | null): EventKey => findEvent(timestamp)?.key ?? "current";

const inEvent = (label: (typeof EVENTS)[number]["label"]) => (timestamp: number | undefined | null): boolean =>
    getDataLabel(timestamp) === label;

/** Timestamp (ms, from serverTimestamp) falls within the OSF window */
export const isOSFData = inEvent("OSF");
/** Timestamp (ms) falls within the Clack window */
export const isClackData = inEvent("Clack");
/** Timestamp (ms) falls within the DCMP window */
export const isDCMPData = inEvent("DCMP");

/** Split entries by the event their submittedAt falls in */
export const filterByEventType = <T extends { submittedAt?: number }>(entries: T[]): Record<EventKey, T[]> => {
    const out = {osf: [], clack: [], dcmp: [], girlsgen: [], current: []} as Record<EventKey, T[]>;
    entries.forEach((e) => out[getEventKey(e.submittedAt)].push(e));
    return out;
};

export const OSF_DATE_RANGE = "3/6/26 - 3/7/26";
export const CLACK_DATE_RANGE = "3/26/26 - 3/28/26";
export const DCMP_DATE_RANGE = "4/9/26 - 4/10/26";
export const GIRLS_GEN_DATE_RANGE = "10/3/26";
