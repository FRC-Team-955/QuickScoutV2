import {
  LayoutDashboard,
  Trophy,
  BarChart3,
  Settings,
  ClipboardList,
  Bot,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { checkTBAHealth } from "@/lib/tba";

interface SidebarProps {
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

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const [firebaseStatus, setFirebaseStatus] = useState<SystemStatus>("down");
  const [tbaStatus, setTbaStatus] = useState<SystemStatus>("down");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const runChecks = async () => {
      if (!mounted) return;
      setLoading(true);

      // If the client is not authenticated, assume the DB is locked by rules and mark as degraded
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        setFirebaseStatus("degraded");
      } else {
        // ---- Firebase check ----
        try {
          await get(ref(db, "__healthcheck"));
          setFirebaseStatus("ok");
        } catch (err: unknown) {
          // attempt an authenticated fallback/read to users/{uid} to confirm DB access
          try {
            await get(ref(db, `users/${currentUser.uid}`));
            setFirebaseStatus("ok");
          } catch (fallbackErr: unknown) {
            const errObj = fallbackErr as { code?: string; message?: string };
            const codeStr = String(errObj.code || "").toLowerCase();
            const msg = String(errObj.message || "");
            if (
              codeStr.includes("permission") ||
              /permission denied/i.test(msg) ||
              /permission-denied/i.test(codeStr)
            ) {
              setFirebaseStatus("degraded");
            } else {
              console.debug("__healthcheck read failed and fallback failed:", errObj);
              setFirebaseStatus("down");
            }
          }
        }
      }

      // ---- TBA check ----
      try {
        await checkTBAHealth();
        setTbaStatus("ok");
      } catch {
        setTbaStatus("down");
      }

      if (mounted) setLoading(false);
    };

    // run on mount
    runChecks();

    // subscribe to auth state changes so we re-run checks after login/logout
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // if user just signed in, immediately try the DB health read (use firebaseUser to avoid race)
      if (firebaseUser) {
        get(ref(db, "__healthcheck"))
          .then(() => setFirebaseStatus("ok"))
          .catch(async (err: unknown) => {
            // fallback: try authenticated users/{uid} read
            try {
              await get(ref(db, `users/${firebaseUser.uid}`));
              setFirebaseStatus("ok");
            } catch (fallbackErr: unknown) {
              const errObj = fallbackErr as { code?: string; message?: string };
              const codeStr = String(errObj.code || "").toLowerCase();
              const msg = String(errObj.message || "");
              if (
                codeStr.includes("permission") ||
                /permission denied/i.test(msg) ||
                /permission-denied/i.test(codeStr)
              ) {
                setFirebaseStatus("degraded");
              } else {
                console.debug("__healthcheck read failed after auth change and fallback failed:", errObj);
                setFirebaseStatus("down");
              }
            }
          });
      } else {
        // logged out
        setFirebaseStatus("degraded");
      }

      runChecks().catch((e) => console.debug("runChecks after auth change failed", e));
    });

    return () => {
      mounted = false;
      unsubAuth();
    };
  }, []);

  const overallStatus: SystemStatus =
    firebaseStatus === "ok" && tbaStatus === "ok"
      ? "ok"
      : firebaseStatus === "down" && tbaStatus === "down"
      ? "down"
      : "degraded";

  const statusColor =
    overallStatus === "ok"
      ? "bg-success"
      : overallStatus === "degraded"
      ? "bg-yellow-500"
      : "bg-destructive";

  const statusText =
    overallStatus === "ok"
      ? "All systems operational"
      : overallStatus === "degraded"
      ? "Partial system outage"
      : "Systems offline";

  return (
    <aside className="hidden md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:bg-sidebar md:border-r md:border-sidebar-border md:flex md:flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
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

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-4">
          Main Menu
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "nav-item w-full text-left",
              activeTab === item.id && "active",
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="stat-card !p-4">
          <div className="flex items-center gap-2 mb-2">
            {overallStatus === "ok" ? (
              <Zap className="w-4 h-4 text-primary" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-xs font-medium text-foreground">
              System Status
            </span>
          </div>

          {loading ? (
            <span className="text-xs text-muted-foreground">Checking…</span>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                <span className="text-xs text-muted-foreground">
                  {statusText}
                </span>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <div>Firebase: {firebaseStatus}</div>
                <div>TBA API: {tbaStatus}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-sidebar-border">
        <button className="nav-item w-full text-left">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
