import {
  LayoutDashboard,
  Users,
  Trophy,
  BarChart3,
  Settings,
  ClipboardList,
  Bot,
  Zap,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getDatabase, ref, get } from "firebase/database";
import { checkTBAHealth } from "@/lib/tba";
import { db } from "@/lib/firebase";

interface MobileSidebarContentProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "matches", label: "Match Schedule", icon: Trophy },
  { id: "scouting", label: "Scouting", icon: ClipboardList },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
];

type SystemStatus = "ok" | "degraded" | "down";

const MobileSidebarContent = ({
  activeTab,
  onTabChange,
}: MobileSidebarContentProps) => {
  const [firebaseStatus, setFirebaseStatus] = useState<SystemStatus>("down");
  const [tbaStatus, setTbaStatus] = useState<SystemStatus>("down");

  // ---- Firebase check ----
  useEffect(() => {
    const checkFirebase = async () => {
      try {
        await get(ref(db, "__healthcheck"));
        setFirebaseStatus("ok");
      } catch {
        setFirebaseStatus("down");
      }
    };

    checkFirebase();
  }, []);

  // ---- TBA check ----
  useEffect(() => {
    const checkTBA = async () => {
      try {
        await checkTBAHealth();
        setTbaStatus("ok");
      } catch {
        setTbaStatus("down");
      }
    };

    checkTBA();
  }, []);

  const overallStatus =
    firebaseStatus === "ok" && tbaStatus === "ok"
      ? "ok"
      : firebaseStatus === "down" || tbaStatus === "down"
      ? "down"
      : "degraded";

  const statusColor =
    overallStatus === "ok"
      ? "bg-success"
      : overallStatus === "down"
      ? "bg-destructive"
      : "bg-yellow-400";

  const statusText =
    overallStatus === "ok"
      ? "All systems operational"
      : overallStatus === "down"
      ? "System issues detected"
      : "Checking systems…";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-foreground text-lg">
              QuickScoutV2
            </h1>
            <p className="text-xs text-muted-foreground">Dashboard v1.0</p>
          </div>
        </div>
      </div>

      {/* Search */}
      {/* <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams, matches, data..."
            className="pl-10"
          />
        </div>
      </div> */}

      {/* Nav */}
      <div
        className="flex-1 overflow-auto mt-2 px-4 pb-4 touch-pan-y"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <nav className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Main Menu
          </p>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50",
                activeTab === item.id && "bg-secondary/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          {/* System Status */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground">
                System Status
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-xs text-muted-foreground">{statusText}</span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 pl-4">
              <div>
                Firebase:{" "}
                <span
                  className={
                    firebaseStatus === "ok"
                      ? "text-success"
                      : firebaseStatus === "down"
                      ? "text-destructive"
                      : ""
                  }
                >
                  {firebaseStatus}
                </span>
              </div>
              <div>
                TBA API:{" "}
                <span
                  className={
                    tbaStatus === "ok"
                      ? "text-success"
                      : tbaStatus === "down"
                      ? "text-destructive"
                      : ""
                  }
                >
                  {tbaStatus}
                </span>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default MobileSidebarContent;
