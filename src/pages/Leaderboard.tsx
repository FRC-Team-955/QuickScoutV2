import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell,
  Search,
  User,
  LogOut,
  Menu,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";

type LeaderboardRow = {
  key: string;
  scoutName: string;
  matches: number;
  lastSubmitted: number;
};

const Leaderboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [query, setQuery] = useState("");

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "dashboard") {
      navigate("/");
    } else if (tab === "scouting") {
      navigate("/scouting");
    } else if (tab === "analytics") {
      navigate("/analytics");
    } else if (tab === "matches") {
      navigate("/matches");
    } else if (tab === "leaderboard") {
      navigate("/leaderboard");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const matchesRef = ref(db, "matches");
        const snap = await get(matchesRef);

        if (!snap.exists()) {
          setRows([]);
          return;
        }

        const tally = new Map<
          string,
          { scoutName: string; matches: number; lastSubmitted: number }
        >();

        const matchesData = snap.val();
        Object.values(matchesData as Record<string, any>).forEach((matchValue) => {
          const participantsRoot = matchValue?.participants || matchValue;
          if (!participantsRoot || typeof participantsRoot !== "object") return;

          Object.entries(participantsRoot).forEach(([_participantId, data]) => {
            if (!data || typeof data !== "object") return;

            const hasSubmission =
              data.teamNumber != null ||
              data.submittedAt != null ||
              data.autonomous ||
              data.teleop ||
              data.endGame;
            if (!hasSubmission) return;

            const scoutName = String(data.scoutName || data.name || "Unknown");
            const key = data.userId || scoutName;
            if (!key) return;

            const submittedAt =
              typeof data.submittedAt === "number"
                ? data.submittedAt
                : Number(data.submittedAt) || 0;

            const current = tally.get(key) || {
              scoutName,
              matches: 0,
              lastSubmitted: 0,
            };
            current.matches += 1;
            current.lastSubmitted = Math.max(current.lastSubmitted, submittedAt);
            if (current.scoutName === "Unknown" && scoutName !== "Unknown") {
              current.scoutName = scoutName;
            }
            tally.set(key, current);
          });
        });

        const nextRows: LeaderboardRow[] = Array.from(tally.entries()).map(
          ([key, value]) => ({
            key,
            scoutName: value.scoutName,
            matches: value.matches,
            lastSubmitted: value.lastSubmitted,
          }),
        );

        nextRows.sort(
          (a, b) =>
            b.matches - a.matches || b.lastSubmitted - a.lastSubmitted,
        );
        setRows(nextRows);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.scoutName.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <main
        className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Drawer>
                  <DrawerTrigger>
                    <button className="p-2">
                      <Menu className="w-5 h-5" />
                    </button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <MobileSidebarContent
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                    />
                  </DrawerContent>
                </Drawer>
              </div>
              <div className="hidden md:block relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search teams, matches, data..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {user?.name || "Scout"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Team {user?.teamNumber || 955}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-mono font-bold text-foreground">
                Leaderboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Matches scouted per person
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${filteredRows.length} scouts`}
            </div>
          </div>

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-mono">
                Scout Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Loading leaderboard…
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No submitted scouting data found yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Rank</TableHead>
                        <TableHead>Scout</TableHead>
                        <TableHead className="text-right">
                          Matches Scouted
                        </TableHead>
                        <TableHead className="text-right">
                          Last Submission
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row, index) => (
                        <TableRow
                          key={row.key}
                          className={
                            row.scoutName === user?.name
                              ? "bg-primary/5"
                              : undefined
                          }
                        >
                          <TableCell className="font-mono">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.scoutName}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.matches}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {row.lastSubmitted
                              ? new Date(row.lastSubmitted).toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;