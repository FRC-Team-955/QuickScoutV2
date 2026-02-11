import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AllianceStats {
  avgScore: number;
  autoPoints: number;
  teleopPoints: number;
  endgamePoints: number;
  winRate: number;
}

const redAlliance: AllianceStats = {
  avgScore: 142,
  autoPoints: 38,
  teleopPoints: 85,
  endgamePoints: 19,
  winRate: 72,
};

const blueAlliance: AllianceStats = {
  avgScore: 135,
  autoPoints: 42,
  teleopPoints: 78,
  endgamePoints: 15,
  winRate: 65,
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
  const redPercent = (redValue / total) * 100;
  const bluePercent = (blueValue / total) * 100;
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

const AllianceComparison = () => {
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
          label="Endgame Points"
          redValue={redAlliance.endgamePoints}
          blueValue={blueAlliance.endgamePoints}
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
