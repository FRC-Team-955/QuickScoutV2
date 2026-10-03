import {Bot, Zap} from "lucide-react";
import {cn} from "@/lib/utils";
import {navItems, overallStatus, SystemStatus, useSystemStatus} from "@/components/nav";

interface MobileSidebarContentProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const statusColor = {ok: "bg-success", degraded: "bg-yellow-400", down: "bg-destructive"};
const statusText = {ok: "All systems operational", degraded: "Partial system outage", down: "System issues detected"};
const textColor = (s: SystemStatus | null) => (s === "ok" ? "text-success" : s === "down" ? "text-destructive" : "");

const MobileSidebarContent = ({activeTab, onTabChange}: MobileSidebarContentProps) => {
    const {firebase, tba} = useSystemStatus();
    const overall = overallStatus(firebase, tba);
    const checking = !firebase || !tba;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b">
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
                            <item.icon className="w-5 h-5"/>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}

                    {/* System Status */}
                    <div className="mt-6 border-t pt-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary"/>
                            <span className="text-xs font-medium text-foreground">
                System Status
              </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${checking ? "bg-yellow-400" : statusColor[overall]}`}/>
                            <span className="text-xs text-muted-foreground">
                                {checking ? "Checking systems…" : statusText[overall]}
                            </span>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1 pl-4">
                            <div>
                                Firebase: <span className={textColor(firebase)}>{firebase ?? "…"}</span>
                            </div>
                            <div>
                                TBA API: <span className={textColor(tba)}>{tba ?? "…"}</span>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default MobileSidebarContent;
