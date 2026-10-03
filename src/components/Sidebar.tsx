import {AlertTriangle, Bot, Settings, Zap} from "lucide-react";
import {cn} from "@/lib/utils";
import {navItems, overallStatus, useSystemStatus} from "@/components/nav";

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const statusColor = {ok: "bg-success", degraded: "bg-yellow-500", down: "bg-destructive"};
const statusText = {ok: "All systems operational", degraded: "Partial system outage", down: "Systems offline"};

const Sidebar = ({activeTab, onTabChange}: SidebarProps) => {
    const {firebase, tba} = useSystemStatus();
    const overall = overallStatus(firebase, tba);

    return (
        <aside
            className="hidden md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:bg-sidebar md:border-r md:border-sidebar-border md:flex md:flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-primary"/>
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
                        <item.icon className="w-5 h-5"/>
                        <span className="font-medium">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* System Status */}
            <div className="p-4 border-t border-sidebar-border">
                <div className="stat-card !p-4">
                    <div className="flex items-center gap-2 mb-2">
                        {overall === "ok" ? (
                            <Zap className="w-4 h-4 text-primary"/>
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500"/>
                        )}
                        <span className="text-xs font-medium text-foreground">
              System Status
            </span>
                    </div>

                    {!firebase || !tba ? (
                        <span className="text-xs text-muted-foreground">Checking…</span>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${statusColor[overall]}`}/>
                                <span className="text-xs text-muted-foreground">
                  {statusText[overall]}
                </span>
                            </div>

                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                                <div>Firebase: {firebase}</div>
                                <div>TBA API: {tba}</div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Settings */}
            <div className="p-4 border-t border-sidebar-border">
                <button className="nav-item w-full text-left">
                    <Settings className="w-5 h-5"/>
                    <span className="font-medium">Settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
