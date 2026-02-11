import { useEffect, useMemo, useState } from "react";
import { Users, Trophy, TrendingUp } from "lucide-react";
import { StatCard, StatCard1 } from "../components/StatCard";
import TeamCard from "../components/TeamCard";
import MatchesTable from "../components/MatchesTable";
import AllianceComparison from "../components/AllianceComparison";
import { useNavigate } from "react-router-dom";
import { getEventMatches } from "@/lib/tba";
import { db } from "@/lib/firebase";
import { get, ref } from "firebase/database";

type TbaMatch = {
  key: string;
  match_number: number;
  comp_level: "qm" | "qf" | "sf" | "f";
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  score_breakdown?: {
    red?: { autoPoints?: number; teleopPoints?: number; endGamePoints?: number };
    blue?: { autoPoints?: number; teleopPoints?: number; endGamePoints?: number };
  };
  time?: number;
};

type ScoutingEntry = {
  teamNumber: number;
  autoPoints: number;
  teleopPoints: number;
  didClimb: boolean;
  submittedAt: number;
};

type TeamStat = {
  teamNumber: number;
  teamName: string;
  ranking: number;
  avgScore: number;
  autoPoints: number;
  teleopPoints: number;
  climbSuccess: number;
  status: "online" | "offline" | "pending";
};

const extractScoutingEntries = (matchesData: Record<string, any>) => {
  const entries: ScoutingEntry[] = [];

  Object.values(matchesData).forEach((matchValue) => {
    const participantsRoot = matchValue?.participants || matchValue;
    if (!participantsRoot || typeof participantsRoot !== "object") return;

    Object.values(participantsRoot as Record<string, any>).forEach((data) => {
      if (!data || typeof data !== "object") return;

      const hasSubmission =
        data.teamNumber != null ||
        data.submittedAt != null ||
        data.autonomous ||
        data.teleop ||
        data.endGame;
      if (!hasSubmission) return;

      const teamNumber = Number.parseInt(String(data.teamNumber), 10);
      if (!Number.isFinite(teamNumber)) return;

      const autoPoints =
        Number(data.autonomous?.score) || Number(data.autonomous?.fuel) || 0;
      const teleopPoints =
        Number(data.teleop?.score) || Number(data.teleop?.fuel) || 0;
      const didClimb = Boolean(data.endGame?.didClimb);
      const submittedAt =
        typeof data.submittedAt === "number"
          ? data.submittedAt
          : Number(data.submittedAt) || 0;

      entries.push({
        teamNumber,
        autoPoints,
        teleopPoints,
        didClimb,
        submittedAt,
      });
    });
  });

  return entries;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const eventKey = "2025wayak";
  const [tbaMatches, setTbaMatches] = useState<TbaMatch[]>([]);
  const [tbaLoading, setTbaLoading] = useState(false);
  const [scoutingEntries, setScoutingEntries] = useState<ScoutingEntry[]>([]);
  const [scoutingLoading, setScoutingLoading] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      setTbaLoading(true);
      try {
        const data = await getEventMatches(eventKey);
        setTbaMatches(data || []);
      } catch (err) {
        console.error("Failed to load TBA matches", err);
        setTbaMatches([]);
      } finally {
        setTbaLoading(false);
      }
    };

    fetchMatches();
  }, [eventKey]);

  useEffect(() => {
    const fetchScouting = async () => {
      setScoutingLoading(true);
      try {
        const snap = await get(ref(db, "matches"));
        if (!snap.exists()) {
          setScoutingEntries([]);
          return;
        }
        const entries = extractScoutingEntries(snap.val() || {});
        setScoutingEntries(entries);
      } catch (err) {
        console.error("Failed to load scouting data", err);
        setScoutingEntries([]);
      } finally {
        setScoutingLoading(false);
      }
    };

    fetchScouting();
  }, []);

  const playedMatches = useMemo(
    () =>
      tbaMatches.filter(
        (m) => m.alliances.red.score >= 0 && m.alliances.blue.score >= 0,
      ),
    [tbaMatches],
  );

  const eventTeamCount = useMemo(() => {
    const teams = new Set<string>();
    tbaMatches.forEach((match) => {
      match.alliances.red.team_keys.forEach((team) => teams.add(team));
      match.alliances.blue.team_keys.forEach((team) => teams.add(team));
    });
    return teams.size;
  }, [tbaMatches]);

  const teamsScoutedSet = useMemo(() => {
    const teams = new Set<number>();
    scoutingEntries.forEach((entry) => teams.add(entry.teamNumber));
    return teams;
  }, [scoutingEntries]);

  const teamsScoutedToday = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const startMs = dayStart.getTime();
    const teams = new Set<number>();
    scoutingEntries.forEach((entry) => {
      if (entry.submittedAt >= startMs) teams.add(entry.teamNumber);
    });
    return teams.size;
  }, [scoutingEntries]);

  const completionRate = useMemo(() => {
    if (!eventTeamCount) return 0;
    return (teamsScoutedSet.size / eventTeamCount) * 100;
  }, [eventTeamCount, teamsScoutedSet]);

  const avgMatchScore = useMemo(() => {
    if (!playedMatches.length) return 0;
    const total = playedMatches.reduce(
      (sum, match) => sum + match.alliances.red.score + match.alliances.blue.score,
      0,
    );
    return total / playedMatches.length;
  }, [playedMatches]);

  const topTeams = useMemo<TeamStat[]>(() => {
    const byTeam = new Map<
      number,
      { auto: number; teleop: number; climb: number; count: number }
    >();

    scoutingEntries.forEach((entry) => {
      const current = byTeam.get(entry.teamNumber) || {
        auto: 0,
        teleop: 0,
        climb: 0,
        count: 0,
      };
      current.auto += entry.autoPoints;
      current.teleop += entry.teleopPoints;
      current.climb += entry.didClimb ? 1 : 0;
      current.count += 1;
      byTeam.set(entry.teamNumber, current);
    });

    const sorted = Array.from(byTeam.entries())
      .map(([teamNumber, stats]) => {
        const count = stats.count || 1;
        const autoAvg = stats.auto / count;
        const teleopAvg = stats.teleop / count;
        const avgScore = autoAvg + teleopAvg;
        const climbSuccess = Math.round((stats.climb / count) * 100);
        const status = count >= 3 ? "online" : "pending";
        return {
          teamNumber,
          teamName: `Team ${teamNumber}`,
          ranking: 0,
          avgScore: Number(avgScore.toFixed(1)),
          autoPoints: Number(autoAvg.toFixed(1)),
          teleopPoints: Number(teleopAvg.toFixed(1)),
          climbSuccess,
          status,
        } as TeamStat;
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    return sorted.slice(0, 4).map((team, index) => ({
      ...team,
      ranking: index + 1,
    }));
  }, [scoutingEntries]);

  const teamsScoutedLabel = scoutingLoading
    ? "—"
    : `${teamsScoutedSet.size}/${eventTeamCount || "—"}`;
  const matchesPlayedLabel = tbaLoading ? "—" : `${playedMatches.length}`;
  const avgMatchScoreLabel = tbaLoading
    ? "—"
    : avgMatchScore.toFixed(1);

  const matchesRemaining = Math.max(
    0,
    (tbaMatches.length || 0) - playedMatches.length,
  );
  return (
    <div className="space-y-6">
      {/* Header */}
      {/* <div className="flex items-center gap-3"> */}
        {/* Go to Scouting button */}
        {/* <button
          onClick={() => navigate("/scouting")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
               bg-primary text-primary-foreground
               hover:bg-primary/90 transition font-mono text-sm"
        >
          <Target className="w-4 h-4" />
          Scouting
        </button> */}

        {/* Match status */}
        {/* <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-lg">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm text-foreground">
            Match 43 • Live
          </span>
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </div> */}
      {/* </div> */}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard1
          title="TO GO TO SCOUTING PAGE"
          value="CLICK HERE"
          changeType="positive"
          icon={Users}
          onClick={() => navigate("/scouting")}
        />
        <StatCard
          title="Teams Scouted"
          value={teamsScoutedLabel}
          change={
            scoutingLoading
              ? undefined
              : `+${teamsScoutedToday} today`
          }
          changeType="positive"
          icon={Users}
          subtitle={
            scoutingLoading || !eventTeamCount
              ? "Completion rate pending"
              : `${Math.round(completionRate)}% completion rate`
          }
        />
        <StatCard
          title="Matches Played"
          value={matchesPlayedLabel}
          change={tbaLoading ? undefined : `${matchesRemaining} remaining`}
          changeType="neutral"
          icon={Trophy}
          subtitle={tbaLoading ? "Event matches" : `Event ${eventKey}`}
        />
        <StatCard
          title="Avg Match Score"
          value={avgMatchScoreLabel}
          change={tbaLoading ? undefined : `from ${playedMatches.length} matches`}
          changeType="neutral"
          icon={TrendingUp}
          subtitle="All alliances combined"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono font-bold text-foreground">Top Teams</h2>
            <button 
              onClick={() => navigate("/analytics")}
            className="text-sm text-primary hover:underline">
              View All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topTeams.map((team) => (
              <TeamCard key={team.teamNumber} {...team} />
            ))}
          </div>
        </div>

        {/* Alliance Comparison */}
        <div>
          <AllianceComparison matches={tbaMatches} loading={tbaLoading} />
        </div>
      </div>

      {/* Matches Table */}
      <MatchesTable matches={tbaMatches} loading={tbaLoading} />
    </div>
  );
};

export default Dashboard;
