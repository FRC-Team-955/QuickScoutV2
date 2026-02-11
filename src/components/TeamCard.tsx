import { Bot, Battery, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamCardProps {
  teamNumber: number;
  teamName: string;
  ranking: number;
  avgScore: number;
  autoPoints: number;
  teleopPoints: number;
  climbSuccess: number;
  status: "online" | "offline" | "pending";
}

const TeamCard = ({
  teamNumber,
  teamName,
  ranking,
  avgScore,
  autoPoints,
  teleopPoints,
  climbSuccess,
  status,
}: TeamCardProps) => {
  return (
    <div className="stat-card animate-fade-in hover:border-primary/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-foreground">{teamNumber}</h3>
            <p className="text-sm text-muted-foreground truncate max-w-[120px]">{teamName}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Rank</span>
          <p className="font-mono font-bold text-primary text-xl">#{ranking}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Avg Score</span>
          </div>
          <span className="font-mono font-semibold text-foreground">{avgScore}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-primary" />
              <span className="text-xs text-muted-foreground">Auto</span>
            </div>
            <span className="font-mono font-semibold text-foreground text-sm">{autoPoints}</span>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
              <Battery className="w-3 h-3 text-warning" />
              <span className="text-xs text-muted-foreground">Teleop</span>
            </div>
            <span className="font-mono font-semibold text-foreground text-sm">{teleopPoints}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Climb Success</span>
            <span className="font-mono text-xs text-foreground">{climbSuccess}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${climbSuccess}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <span
          className={cn(
            "status-badge",
            status === "online" && "status-online",
            status === "offline" && "status-offline",
            status === "pending" && "status-online"
          )}
        >
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "online" && "bg-success",
            status === "offline" && "bg-destructive",
            status === "pending" && "bg-success"
          )} />
          {status === "online" ? "Scouted" : status === "pending" ? "Completed" : "Not Scouted"}
        </span>
      </div>
    </div>
  );
};

export default TeamCard;
