import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
}

interface StatCardProps1 {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
  onClick?: () => void;
}

const StatCard = ({ title, value, change, changeType = "neutral", icon: Icon, subtitle, }: StatCardProps) => {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              changeType === "positive" && "bg-success/20 text-success",
              changeType === "negative" && "bg-destructive/20 text-destructive",
              changeType === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label mt-1">{title}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
};

const StatCard1 = ({ title, value, change, changeType = "neutral", icon: Icon, subtitle, onClick }: StatCardProps1) => {
  return (
    <div className="stat-card animate-fade-in" onClick={onClick}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              changeType === "positive" && "bg-success/20 text-success",
              changeType === "negative" && "bg-destructive/20 text-destructive",
              changeType === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label mt-1">{title}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
};

export { StatCard, StatCard1 };
