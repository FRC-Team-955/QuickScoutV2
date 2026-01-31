import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Search, User, LogOut, Menu, Clipboard } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";

// ---- Types ----
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
  id: string; // Unique key for the UI (matchId + station)
  matchKey: string;
  station: string;
  teamNumber: number;
  scoutName: string;
  score_auto: number;
  score_teleop: number;
  total_score: number;
  climb: number;
  defense_rating: number;
  submittedAt: number;
};

const Analytics = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("analytics");
  const [sortBy, setSortBy] = useState<Filters["sortBy"]>("newest");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "dashboard") navigate("/");
    if (tab === "scouting") navigate("/scouting");
    if (tab === "analytics") navigate("/analytics");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ---- Fetch from Firebase ----
  // ---- Fetch from Firebase ----
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

        Object.entries(matchesData).forEach(([matchKey, matchValue]: [string, any]) => {
          const participantsRoot = matchValue.participants || matchValue;
          
          if (typeof participantsRoot !== 'object') return;

          Object.entries(participantsRoot).forEach(([stationId, data]: [string, any]) => {
            if (!data || typeof data !== 'object' || !data.teamNumber) return;

            const teamNum = parseInt(data.teamNumber);
            const autoScore = data.autonomous?.score || data.autonomous?.fuel || 0; 
            const teleopScore = data.teleop?.score || data.teleop?.fuel || 0;
            const climbScore = data.endGame?.climbLevel || data.endGame?.climbScore || 0;
            const defense = data.teleop?.defenseRating || data.endGame?.defenseScore || 0;

            allEntries.push({
              id: `${matchKey}_${stationId}_${data.submittedAt || Math.random()}`,
              matchKey: matchKey,
              station: stationId,
              teamNumber: teamNum,
              scoutName: data.scoutName || "Unknown",
              score_auto: autoScore,
              score_teleop: teleopScore,
              total_score: autoScore + teleopScore,
              climb: climbScore,
              defense_rating: defense,
              submittedAt: data.submittedAt || 0
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

  // ---- Sort Logic ----
  const sortedAndFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    let filtered = matchEntries.filter(entry => 
      !q || 
      String(entry.teamNumber).includes(q) || 
      entry.scoutName.toLowerCase().includes(q) ||
      entry.matchKey.toLowerCase().includes(q)
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest": return b.submittedAt - a.submittedAt;
        case "highest_score_auto": return b.score_auto - a.score_auto;
        case "highest_score_teleop": return b.score_teleop - a.score_teleop;
        case "highest_total_score": return b.total_score - a.total_score;
        case "highest_climb": return b.climb - a.climb;
        case "best_defense": return b.defense_rating - a.defense_rating;
        default: return 0;
      }
    });
  }, [matchEntries, query, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="md:ml-64 min-h-screen max-h-screen overflow-auto">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="md:hidden">
              <Drawer>
                <DrawerTrigger><Menu className="w-5 h-5" /></DrawerTrigger>
                <DrawerContent><MobileSidebarContent activeTab={activeTab} onTabChange={handleTabChange} /></DrawerContent>
              </Drawer>
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team, scout, or match ID..."
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
             <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </header>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono font-bold text-2xl">Match Analytics</h2>
              <p className="text-muted-foreground">Viewing {sortedAndFiltered.length} individual reports</p>
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as Filters["sortBy"])}>
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
              <p>Loading matches...</p>
            ) : (
              sortedAndFiltered.map((entry) => (
                <Card key={entry.id} className="overflow-hidden border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-xl">Team {entry.teamNumber}</span>
                        <span className="text-xs font-normal text-muted-foreground uppercase tracking-widest">
                          Member {entry.station}
                        </span>
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
        </div>
      </main>
    </div>
  );
};

export default Analytics;