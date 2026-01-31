import {
  Users,
  Trophy,
  ClipboardCheck,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react";
import StatCard from "./StatCard";
import TeamCard from "./TeamCard";
import MatchesTable from "./MatchesTable";
import AllianceComparison from "./AllianceComparison";
import { useNavigate } from "react-router-dom";

const mockTeams = [
  {
    teamNumber: 254,
    teamName: "The Cheesy Poofs",
    ranking: 1,
    avgScore: 156,
    autoPoints: 45,
    teleopPoints: 92,
    climbSuccess: 95,
    status: "online" as const,
  },
  {
    teamNumber: 1678,
    teamName: "Citrus Circuits",
    ranking: 2,
    avgScore: 148,
    autoPoints: 42,
    teleopPoints: 88,
    climbSuccess: 90,
    status: "online" as const,
  },
  {
    teamNumber: 118,
    teamName: "Robonauts",
    ranking: 3,
    avgScore: 142,
    autoPoints: 38,
    teleopPoints: 85,
    climbSuccess: 88,
    status: "pending" as const,
  },
  {
    teamNumber: 971,
    teamName: "Spartan Robotics",
    ranking: 4,
    avgScore: 138,
    autoPoints: 35,
    teleopPoints: 82,
    climbSuccess: 85,
    status: "offline" as const,
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of scouting progress and statistics
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Go to Scouting button */}
        <button
          onClick={() => navigate("/scouting")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
               bg-primary text-primary-foreground
               hover:bg-primary/90 transition font-mono text-sm"
        >
          <Target className="w-4 h-4" />
          Scouting
        </button>

        {/* Match status */}
        <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm text-foreground">
            Match 43 • Live
          </span>
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Teams Scouted"
          value="32/48"
          change="+8 today"
          changeType="positive"
          icon={Users}
          subtitle="67% completion rate"
        />
        <StatCard
          title="Matches Played"
          value="42"
          change="6 remaining"
          changeType="neutral"
          icon={Trophy}
          subtitle="Qualification rounds"
        />
        <StatCard
          title="Data Points"
          value="1,284"
          change="+156"
          changeType="positive"
          icon={ClipboardCheck}
          subtitle="Total observations"
        />
        <StatCard
          title="Avg Match Score"
          value="138.5"
          change="+12.3%"
          changeType="positive"
          icon={TrendingUp}
          subtitle="All teams combined"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono font-bold text-foreground">Top Teams</h2>
            <button className="text-sm text-primary hover:underline">
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockTeams.map((team) => (
              <TeamCard key={team.teamNumber} {...team} />
            ))}
          </div>
        </div>

        {/* Alliance Comparison */}
        <div>
          <AllianceComparison />
        </div>
      </div>

      {/* Matches Table */}
      <MatchesTable />
    </div>
  );
};

export default Dashboard;
