/**
 * OSF Event Date Range: March 6, 2026 - March 7, 2026
 * Helper functions to identify and filter OSF data
 */

// OSF Event date range in milliseconds
const OSF_START = new Date(2026, 2, 6, 0, 0, 0).getTime(); // March 6, 2026 00:00:00
const OSF_END = new Date(2026, 2, 7, 23, 59, 59).getTime(); // March 7, 2026 23:59:59

/**
 * Check if a timestamp falls within the OSF date range
 * @param timestamp - Timestamp in milliseconds (from serverTimestamp)
 * @returns true if the timestamp is within OSF date range
 */
export const isOSFData = (timestamp: number | undefined | null): boolean => {
  if (!timestamp) return false;
  return timestamp >= OSF_START && timestamp <= OSF_END;
};

/**
 * Get label for data based on date range
 * @param timestamp - Timestamp in milliseconds
 * @returns "OSF" or "Current"
 */
export const getDataLabel = (timestamp: number | undefined | null): string => {
  return isOSFData(timestamp) ? "OSF" : "Current";
};

/**
 * Filter entries into OSF and current groups
 * @param entries - Array of entries with submittedAt field
 * @returns Object with osf and current arrays
 */
export const filterByEventType = <T extends { submittedAt?: number }>(
  entries: T[]
): { osf: T[]; current: T[] } => {
  return {
    osf: entries.filter((e) => isOSFData(e.submittedAt)),
    current: entries.filter((e) => !isOSFData(e.submittedAt)),
  };
};

/**
 * Get date range string for display
 */
export const OSF_DATE_RANGE = "3/6/26 - 3/7/26";

