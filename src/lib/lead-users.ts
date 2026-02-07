const LEAD_EMAILS = [
  "cv.raiderbot@gmail.com",
];

export const normalizeEmail = (email?: string) =>
  (email || "").trim().toLowerCase();

export const isLeadEmail = (email?: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return LEAD_EMAILS.map((e) => e.toLowerCase()).includes(normalized);
};

export default LEAD_EMAILS;
