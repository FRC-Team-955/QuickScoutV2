const NEXUS_BASE = "https://frc.nexus/api/v1";

export const NEXUS_API_KEY = atob("SGxvLU9sUjduLWRMUHlTYlB2cFMtcEhCRzFB");

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

export const getEventLiveStatus = async (eventKey: string): Promise<NexusEventStatusResponse> => {
	return nexusFetch<NexusEventStatusResponse>(`/event/${eventKey}`);
};

export const getCurrentQueuingMatch = async (eventKey: string): Promise<string | null> => {
	const status = await nexus.getEventLiveStatus(eventKey);
	return status.nowQueuing ?? null;
};

export const nexus = {
	base: NEXUS_BASE,
	apiKey: NEXUS_API_KEY,
	fetch: nexusFetch,
	getEventLiveStatus,
	getCurrentQueuingMatch,
};



