import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import MobileSidebarContent from "@/components/MobileSidebarContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clock,
  Plus,
  Minus,
  Play,
  Pause,
  Bell,
  Search,
  User,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import { useQueue } from "@/hooks/use-queue";
import { subscribeToUserAssignment } from "@/lib/queue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDatabase,
  ref,
  set,
  serverTimestamp,
  remove,
} from "firebase/database";
import { get } from "firebase/database";

type Filters = {
  sortBy:
    | "highest_score_auto"
    | "highest_score_teleop"
    | "highest_total_score"
    | "highest_climb"
    | "most_consistent_climb_teleop"
    | "most_consistent_climb_auto"
    | "best_defense";
};

const Matches = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("matches");

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
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isLeadName = (name?: string) => !!name && /\blead\b/i.test(name);
  const isLead = isLeadName(user?.name);

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
      </main>
    </div>
  );
};

export default Matches;