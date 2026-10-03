import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type TbaMatch = {
  alliances: {
    red: { score: number };
    blue: { score: number };
  };
  score_breakdown?: {
    red?: { autoPoints?: number; teleopPoints?: number; endGamePoints?: number };
    blue?: { autoPoints?: number; teleopPoints?: number; endGamePoints?: number };
  };
};

type Side = "red" | "blue";

const EMPTY = { avgScore: 0, autoPoints: 0, teleopPoints: 0, winRate: 0 };

// Per-alliance averages over played matches (TBA marks unplayed scores as -1).
export const allianceStats = (matches: TbaMatch[]) => {
  const played = matches.filter((m) => m.alliances.red.score >= 0 && m.alliances.blue.score >= 0);
  const n = played.length;
  const side = (s: Side, o: Side) => n ? {
    avgScore: Math.round(played.reduce((t, m) => t + m.alliances[s].score, 0) / n),
    autoPoints: Math.round(played.reduce((t, m) => t + (m.score_breakdown?.[s]?.autoPoints || 0), 0) / n),
    teleopPoints: Math.round(played.reduce((t, m) => t + (m.score_breakdown?.[s]?.teleopPoints || 0), 0) / n),
    winRate: Math.round((played.filter((m) => m.alliances[s].score > m.alliances[o].score).length / n) * 100),
  } : EMPTY;
  return { red: side("red", "blue"), blue: side("blue", "red") };
};

const ComparisonBar = ({
  label,
  redValue,
  blueValue,
  unit = "",
}: {
  label: string;
  redValue: number;
  blueValue: number;
  unit?: string;
}) => {
  const total = redValue + blueValue;
  const redPercent = total ? (redValue / total) * 100 : 0;
  const bluePercent = total ? (blueValue / total) * 100 : 0;
  const diff = redValue - blueValue;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          {diff > 0 ? (
            <TrendingUp className="w-3 h-3 text-destructive" />
          ) : diff < 0 ? (
            <TrendingDown className="w-3 h-3 text-[hsl(var(--alliance-blue))]" />
          ) : (
            <Minus className="w-3 h-3 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {diff > 0 ? `+${diff}` : diff} {unit}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-destructive w-12 text-right">
          {redValue}{unit}
        </span>
        <div className="flex-1 h-3 flex rounded-full overflow-hidden bg-secondary">
          <div
            className="h-full bg-destructive transition-all duration-500"
            style={{ width: `${redPercent}%` }}
          />
          <div
            className="h-full bg-[hsl(var(--alliance-blue))] transition-all duration-500"
            style={{ width: `${bluePercent}%` }}
          />
        </div>
        <span className="font-mono text-sm text-[hsl(var(--alliance-blue))] w-12">
          {blueValue}{unit}
        </span>
      </div>
    </div>
  );
};

const AllianceComparison = ({
  matches,
  loading = false,
}: {
  matches: TbaMatch[];
  loading?: boolean;
}) => {
  const { red, blue } = useMemo(() => allianceStats(matches), [matches]);
  const redAlliance = loading ? EMPTY : red;
  const blueAlliance = loading ? EMPTY : blue;

  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-mono font-bold text-foreground">Alliance Comparison</h3>
          <p className="text-sm text-muted-foreground mt-1">Red vs Blue performance metrics</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Red</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--alliance-blue))]" />
            <span className="text-sm text-muted-foreground">Blue</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <ComparisonBar
          label="Average Score"
          redValue={redAlliance.avgScore}
          blueValue={blueAlliance.avgScore}
          unit="pts"
        />
        <ComparisonBar
          label="Auto Points"
          redValue={redAlliance.autoPoints}
          blueValue={blueAlliance.autoPoints}
          unit="pts"
        />
        <ComparisonBar
          label="Teleop Points"
          redValue={redAlliance.teleopPoints}
          blueValue={blueAlliance.teleopPoints}
          unit="pts"
        />
        <ComparisonBar
          label="Win Rate"
          redValue={redAlliance.winRate}
          blueValue={blueAlliance.winRate}
          unit="%"
        />
      </div>
    </div>
  );
};

export default AllianceComparison;
