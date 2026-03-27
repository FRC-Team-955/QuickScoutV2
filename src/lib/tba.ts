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

