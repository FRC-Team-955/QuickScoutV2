const NEXUS_BASE = "https://frc.nexus/api/v1";

export const NEXUS_API_KEY = atob("SGxvLU9sUjduLWRMUHlTYlB2cFMtcEhCRzFB");
// When switching events, also update TBA_EVENT_KEY in tba.ts.
export const NEXUS_EVENT_KEY = "2026johnson";

export const nexusFetch = async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
	const res = await fetch(`${NEXUS_BASE}${path}`, {
		...init,
		headers: {
			"Nexus-Api-Key": NEXUS_API_KEY,
			...(init.headers ?? {}),
		},
	});

	if (!res.ok) {
		throw new Error(`Nexus error ${res.status}`);
	}

	return res.json() as Promise<T>;
};

export type NexusMatch = {
	key?: string;
	label: string;
	status?: string | null;
	redTeams?: string[];
	blueTeams?: string[];
	times?: {
		estimatedQueueTime?: number | null;
	};
};

export type NexusEventStatusResponse = {
	eventKey: string;
	dataAsOfTime?: number;
	nowQueuing: string | null;
	matches: NexusMatch[];
	announcements?: unknown[];
	partsRequests?: unknown[];
};

export const getEventLiveStatus = (eventKey: string = NEXUS_EVENT_KEY): Promise<NexusEventStatusResponse> =>
	nexusFetch<NexusEventStatusResponse>(`/event/${eventKey}`);

export const getCurrentQueuingMatch = async (eventKey: string = NEXUS_EVENT_KEY): Promise<string | null> =>
	(await getEventLiveStatus(eventKey)).nowQueuing ?? null;
