import { useMemo } from "react";
import { cn } from "@/lib/utils";

type TbaMatch = {
  key: string;
  match_number: number;
  comp_level: "qm" | "qf" | "sf" | "f";
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  time?: number;
};

type MatchRow = {
  id: string;
  matchNumber: number;
  type: "Qualification" | "Playoff" | "Final";
  redAlliance: number[];
  blueAlliance: number[];
  redScore: number;
  blueScore: number;
  status: "completed" | "upcoming" | "live";
  time: string;
};

const levelLabel = (lvl: string): MatchRow["type"] => {
  if (lvl === "qm") return "Qualification";
  if (lvl === "qf" || lvl === "sf") return "Playoff";
  return "Final";
};

const formatTeams = (keys: string[]) =>
  keys.map((k) => Number(k.replace("frc", "")) || 0).filter(Boolean);

const formatTime = (time?: number) => {
  if (!time) return "TBD";
  return new Date(time * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const MatchesTable = ({
  matches,
  loading = false,
}: {
  matches: TbaMatch[];
  loading?: boolean;
}) => {
  const rows = useMemo<MatchRow[]>(() => {
    if (!matches.length) return [];
    const sorted = [...matches].sort(
      (a, b) =>
        (b.time ?? 0) - (a.time ?? 0) || b.match_number - a.match_number,
    );
    return sorted.slice(0, 4).map((match) => {
      const redScore = match.alliances.red.score;
      const blueScore = match.alliances.blue.score;
      const completed = redScore >= 0 && blueScore >= 0;
      return {
        id: match.key,
        matchNumber: match.match_number,
        type: levelLabel(match.comp_level),
        redAlliance: formatTeams(match.alliances.red.team_keys),
        blueAlliance: formatTeams(match.alliances.blue.team_keys),
        redScore: completed ? redScore : 0,
        blueScore: completed ? blueScore : 0,
        status: completed ? "completed" : "upcoming",
        time: formatTime(match.time),
      };
    });
  }, [matches]);

  return (
    <div className="stat-card !p-0 overflow-hidden animate-fade-in">
      <div className="p-5 border-b border-border">
        <h3 className="font-mono font-bold text-foreground">Recent Matches</h3>
        <p className="text-sm text-muted-foreground mt-1">Live match schedule and results</p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Type</th>
              <th>Red Alliance</th>
              <th>Blue Alliance</th>
              <th>Score</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((match) => (
              <tr key={match.id} className="group">
                <td>
                  <span className="font-mono font-semibold text-foreground">
                    #{match.matchNumber}
                  </span>
                </td>
                <td>
                  <span className="text-muted-foreground">{match.type}</span>
                </td>
                <td>
                  <div className="flex gap-1">
                    {match.redAlliance.map((team) => (
                      <span
                        key={team}
                        className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs font-mono rounded"
                      >
                        {team}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    {match.blueAlliance.map((team) => (
                      <span
                        key={team}
                        className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-mono rounded"
                      >
                        {team}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  {match.status === "completed" ? (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-mono font-semibold",
                        match.redScore > match.blueScore ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {match.redScore}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span className={cn(
                        "font-mono font-semibold",
                        match.blueScore > match.redScore ? "text-primary" : "text-muted-foreground"
                      )}>
                        {match.blueScore}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td>
                  <span
                    className={cn(
                      "status-badge",
                      match.status === "completed" && "status-online",
                      match.status === "live" && "status-pending",
                      match.status === "upcoming" && "bg-secondary text-muted-foreground"
                    )}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      match.status === "completed" && "bg-success",
                      match.status === "live" && "bg-warning animate-pulse",
                      match.status === "upcoming" && "bg-muted-foreground"
                    )} />
                    {match.status === "completed" ? "Completed" : match.status === "live" ? "Live" : "Upcoming"}
                  </span>
                </td>
                <td>
                  <span className="text-muted-foreground font-mono text-xs">{match.time}</span>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  No matches available yet.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  Loading matches...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MatchesTable;
