import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";

type Filters = {
  sortBy:
    | "newest"
    | "highest_score_auto"
    | "highest_score_teleop"
    | "highest_total_score"
    | "highest_climb"
    | "best_defense";
};

export type MatchEntry = {
  id: string;
  matchKey: string;
  station: string;
  teamNumber: number;
  scoutName: string;
  score_auto: number;
  score_teleop: number;
  total_score: number;
  climb: string;
  climbValue: number;
  defense_rating: string;
  defense_rating_value: number;
  submittedAt: number;
};

const Analytics = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("analytics");
  const [viewTab, setViewTab] = useState("all");
  const [sortBy, setSortBy] = useState<Filters["sortBy"]>("newest");
  const [teamNumberInput, setTeamNumberInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "dashboard") navigate("/dashboard");
    if (tab === "scouting") navigate("/scouting");
    if (tab === "analytics") navigate("/analytics");
    if (tab === "matches") navigate("/matches");
    if (tab === "leaderboard") navigate("/leaderboard");
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const matchesRef = ref(db, "matches");
        const snap = await get(matchesRef);

        if (!snap.exists()) {
          console.log("No data found at 'matches' path");
          setMatchEntries([]);
          return;
        }

        const matchesData = snap.val();
        const allEntries: MatchEntry[] = [];
        console.log("All Match IDs in DB:", Object.keys(matchesData));

        const parseClimbValue = (val: unknown): { climbValue: number; climbDisplay: string } => {
          if (val === null || val === undefined) {
            return { climbValue: 0, climbDisplay: "N/A" };
          }

          if (typeof val === 'number' && !isNaN(val)) {
            if (val > 0) {
              return { climbValue: val, climbDisplay: `L${val}` };
            }
            return { climbValue: 0, climbDisplay: "N/A" };
          }

          if (typeof val === 'string') {
            const s = val.trim();
            const match = s.match(/(?:L|Level|level|level_|lvl|LVL)?\s*_?\s*([1-3])/i);
            if (match) {
              const num = parseInt(match[1], 10);
              return { climbValue: num, climbDisplay: `L${num}` };
            }
            const digitMatch = s.match(/^([1-3])$/);
            if (digitMatch) {
              const num = parseInt(digitMatch[1], 10);
              return { climbValue: num, climbDisplay: `L${num}` };
            }
          }

          return { climbValue: 0, climbDisplay: "N/A" };
        };

        const parseDefenseRating = (val: unknown): { defenseValue: number; defenseDisplay: string } => {
          const defenseMap: { [key: string]: string } = {
            "1": "1 - Poor",
            "2": "2 - Fair",
            "3": "3 - Good",
            "4": "4 - Excellent",
          };

          if (val === null || val === undefined) {
            return { defenseValue: 0, defenseDisplay: "N/A" };
          }

          if (typeof val === 'number' && !isNaN(val)) {
            if (val > 0 && val <= 4) {
              return { defenseValue: val, defenseDisplay: defenseMap[String(val)] };
            }
            return { defenseValue: 0, defenseDisplay: "N/A" };
          }

          if (typeof val === 'string') {
            const s = val.trim();
            const match = s.match(/^([1-4])/);
            if (match) {
              const num = parseInt(match[1], 10);
              return { defenseValue: num, defenseDisplay: defenseMap[match[1]] };
            }
            if (defenseMap[s]) {
              const num = parseInt(s, 10);
              return { defenseValue: num, defenseDisplay: defenseMap[s] };
            }
          }

          return { defenseValue: 0, defenseDisplay: "N/A" };
        };

        Object.entries(matchesData).forEach(([matchKey, matchValue]: [string, Record<string, unknown>]) => {
          const participantsRoot = matchValue.participants || matchValue;

          if (typeof participantsRoot !== 'object') return;

          Object.entries(participantsRoot).forEach(([stationId, data]: [string, Record<string, unknown>]) => {
            if (!data || typeof data !== 'object' || !data.teamNumber) return;

            const teamNum = parseInt(String(data.teamNumber));
            const autoScore = ((data.autonomous as Record<string, unknown>)?.score as number) || ((data.autonomous as Record<string, unknown>)?.fuel as number) || 0;
            const teleopScore = ((data.teleop as Record<string, unknown>)?.score as number) || ((data.teleop as Record<string, unknown>)?.fuel as number) || 0;

            const climbRaw = (data.teleop as Record<string, unknown>)?.climbLevel ?? 0;
            const { climbValue, climbDisplay } = parseClimbValue(climbRaw);

            const defenseRaw = (data.teleop as Record<string, unknown>)?.defenseScore ?? 0;
            const { defenseValue, defenseDisplay } = parseDefenseRating(defenseRaw);

            allEntries.push({
              id: `${matchKey}_${stationId}_${(data.submittedAt as number) || Math.random()}`,
              matchKey: matchKey,
              station: stationId,
              teamNumber: teamNum,
              scoutName: (data.scoutName as string) || "Unknown",
              score_auto: autoScore,
              score_teleop: teleopScore,
              total_score: autoScore + teleopScore,
              climb: climbDisplay,
              climbValue: climbValue,
              defense_rating: defenseDisplay,
              defense_rating_value: defenseValue,
              submittedAt: (data.submittedAt as number) || 0
            });
          });
        });

        console.log(`Successfully parsed ${allEntries.length} individual reports.`);
        setMatchEntries(allEntries);
      } catch (error) {
        console.error("Error fetching match data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sortedAndFiltered = useMemo(() => {
    return matchEntries.sort((a, b) => {
      switch (sortBy) {
        case "newest": return b.submittedAt - a.submittedAt;
        case "highest_score_auto": return b.score_auto - a.score_auto;
        case "highest_score_teleop": return b.score_teleop - a.score_teleop;
        case "highest_total_score": return b.total_score - a.total_score;
        case "highest_climb": return (b.climbValue || 0) - (a.climbValue || 0);
        case "best_defense": return (b.defense_rating_value || 0) - (a.defense_rating_value || 0);
        default: return 0;
      }
    });
  }, [matchEntries, sortBy]);

  const teamSpecificData = useMemo(() => {
    const teamNum = parseInt(teamNumberInput);
    if (isNaN(teamNum)) return null;

    const teamMatches = matchEntries.filter(entry => entry.teamNumber === teamNum);

    if (teamMatches.length === 0) return null;

    const autoScores = teamMatches.map(m => m.score_auto);
    const teleopScores = teamMatches.map(m => m.score_teleop);
    const totalScores = teamMatches.map(m => m.total_score);
    const climbScores = teamMatches.map(m => m.climbValue || 0);
    const defenseRatings = teamMatches.map(m => m.defense_rating_value || 0);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = (arr: number[]) => Math.max(...arr);
    const min = (arr: number[]) => Math.min(...arr);

    return {
      teamNum,
      matches: teamMatches,
      stats: {
        autoScore: { avg: avg(autoScores), max: max(autoScores), min: min(autoScores) },
        teleopScore: { avg: avg(teleopScores), max: max(teleopScores), min: min(teleopScores) },
        totalScore: { avg: avg(totalScores), max: max(totalScores), min: min(totalScores) },
        climb: { avg: avg(climbScores), max: max(climbScores), min: min(climbScores) },
        defense: { avg: avg(defenseRatings), max: max(defenseRatings), min: min(defenseRatings) },
      }
    };
  }, [matchEntries, teamNumberInput]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="md:ml-64 min-h-screen max-h-screen overflow-auto">
        <TopBar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="p-6 space-y-4">
          <div>
            <h2 className="font-mono font-bold text-2xl">Match Analytics</h2>
            <p className="text-muted-foreground">View all match data or search for a specific team</p>
          </div>

          <Tabs value={viewTab} onValueChange={setViewTab} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Matches</TabsTrigger>
              <TabsTrigger value="team">Team Search</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Viewing {sortedAndFiltered.length} individual reports</p>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as Filters["sortBy"]) }>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="highest_total_score">Highest Total Score</SelectItem>
                    <SelectItem value="highest_score_auto">Highest Auto</SelectItem>
                    <SelectItem value="highest_climb">Highest Climb</SelectItem>
                    <SelectItem value="best_defense">Best Defense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  <p>Loading scouted matches...</p>
                ) : (
                  sortedAndFiltered.map((entry) => (
                    <Card key={entry.id} className="overflow-hidden border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xl">Team {entry.teamNumber}</span>
                          </div>
                          <div className="bg-secondary px-2 py-1 rounded text-[10px] font-mono">
                            {entry.matchKey.slice(-6)}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">Scout:</span>
                          <span className="font-medium">{entry.scoutName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-primary/5 p-2 rounded">
                            <p className="text-[10px] uppercase text-muted-foreground">Auto</p>
                            <p className="text-lg font-bold">{entry.score_auto}</p>
                          </div>
                          <div className="bg-primary/5 p-2 rounded">
                            <p className="text-[10px] uppercase text-muted-foreground">Teleop</p>
                            <p className="text-lg font-bold">{entry.score_teleop}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                           <span>Climb: <strong>{entry.climb}</strong></span>
                           <span>Defense: <strong>{entry.defense_rating}</strong></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter team number"
                  value={teamNumberInput}
                  onChange={(e) => setTeamNumberInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.ctrlKey || e.metaKey || e.altKey) return;
                    const allowedKeys = ["Backspace", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Delete"];
                    if (allowedKeys.includes(e.key)) return;
                    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                  }}
                  className="w-49"
                  aria-label="Team number"
                />
              </div>

              {teamSpecificData ? (
                <div className="space-y-4">
                  <Card className="border-2 border-primary">
                    <CardHeader>
                      <CardTitle className="text-2xl">Team {teamSpecificData.teamNum}</CardTitle>
                      <p className="text-muted-foreground text-sm">{teamSpecificData.matches.length} matches scouted</p>
                    </CardHeader>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Auto Score</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-2xl font-bold">{teamSpecificData.stats.autoScore.avg.toFixed(1)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.autoScore.max}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.autoScore.min}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Teleop Score</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-2xl font-bold">{teamSpecificData.stats.teleopScore.avg.toFixed(1)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.teleopScore.max}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.teleopScore.min}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Total Score</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-2xl font-bold">{teamSpecificData.stats.totalScore.avg.toFixed(1)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.totalScore.max}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.totalScore.min}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Climb</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-2xl font-bold">{teamSpecificData.stats.climb.avg.toFixed(1)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.climb.max}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.climb.min}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Defense Rating</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Average</p>
                          <p className="text-2xl font-bold">{teamSpecificData.stats.defense.avg.toFixed(1)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.defense.max}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{teamSpecificData.stats.defense.min}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Individual Match Reports</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teamSpecificData.matches.map((entry) => (
                        <Card key={entry.id} className="border-l-4 border-l-primary">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-start">
                              <span className="text-lg">Match {entry.matchKey.slice(-6)}</span>
                              <span className="text-xs bg-secondary px-2 py-1 rounded">{entry.station}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between border-b border-border/50 pb-1">
                              <span className="text-muted-foreground">Scout:</span>
                              <span className="font-medium">{entry.scoutName}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <p className="text-xs text-muted-foreground">Auto</p>
                                <p className="font-semibold">{entry.score_auto}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Teleop</p>
                                <p className="font-semibold">{entry.score_teleop}</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-bold">{entry.total_score}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Climb:</span>
                                <span className="font-semibold">{entry.climb}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Defense:</span>
                                <span className="font-semibold">{entry.defense_rating}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">
                    {teamNumberInput ? "No data found for this team" : "Enter a team number to view analytics"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Analytics;

