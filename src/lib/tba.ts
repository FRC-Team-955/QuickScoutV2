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
