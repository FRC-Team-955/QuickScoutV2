import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getEventMatches } from "@/lib/tba";

// ---------------- Types ----------------
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

const Matches = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("matches");

  // --------- UI state ---------
  const [eventKey, setEventKey] = useState("2025wayak"); // change per event
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<TbaMatch[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  // --------- navigation ---------
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "dashboard") navigate("/");
    if (tab === "scouting") navigate("/scouting");
    if (tab === "analytics") navigate("/analytics");
    if (tab === "matches") navigate("/matches");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // --------- fetch from TBA ---------
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data = await getEventMatches(eventKey);
        // sort by time then match number
        data.sort((a: TbaMatch, b: TbaMatch) =>
          (a.time ?? 0) - (b.time ?? 0) || a.match_number - b.match_number
        );
        setMatches(data);
      } catch (err) {
        console.error("Failed to load TBA matches", err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [eventKey]);

  // --------- helpers ---------
  const formatTeams = (keys: string[]) =>
    keys.map((k) => k.replace("frc", "")).join(", ");

  const levelLabel = (lvl: string) => {
    if (lvl === "qm") return "Qual";
    if (lvl === "qf") return "Quarterfinal";
    if (lvl === "sf") return "Semifinal";
    if (lvl === "f") return "Final";
    return lvl;
  };

  const filtered = matches.filter((m) => {
    if (filter !== "all" && m.comp_level !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.key.toLowerCase().includes(q) ||
      m.alliances.red.team_keys.some((t) => t.includes(q)) ||
      m.alliances.blue.team_keys.some((t) => t.includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="md:ml-64 min-h-screen overflow-auto">
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

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search match or team…"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Team {user?.teamNumber || 955}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-mono font-bold">Matches</h1>
              <p className="text-muted-foreground">Event {eventKey}</p>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="qm">Qual</SelectItem>
                  <SelectItem value="qf">Quarterfinal</SelectItem>
                  <SelectItem value="sf">Semifinal</SelectItem>
                  <SelectItem value="f">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && <p className="text-muted-foreground">Loading matches…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {!loading &&
              filtered.map((m) => (
                <Card key={m.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>
                        {levelLabel(m.comp_level)} {m.match_number}
                      </span>
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-red-400">
                        Red: {formatTeams(m.alliances.red.team_keys)}
                      </span>
                      <span>{m.alliances.red.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">
                        Blue: {formatTeams(m.alliances.blue.team_keys)}
                      </span>
                      <span>{m.alliances.blue.score}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Matches;
