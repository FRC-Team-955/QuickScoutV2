import {BarChart3, Bot, ClipboardList, LayoutDashboard, Trophy, Zap} from "lucide-react";
import {useEffect, useState} from "react";
import {get, ref} from "firebase/database";
import {onAuthStateChanged, type User} from "firebase/auth";
import {auth, db} from "@/lib/firebase";
import {checkTBAHealth} from "@/lib/tba";

// Shared by Sidebar (desktop) and MobileSidebarContent. Each id is also its view path: "/" + id.
export const navItems = [
    {id: "dashboard", label: "Dashboard", icon: LayoutDashboard},
    {id: "matches", label: "Match Schedule", icon: Trophy},
    {id: "scouting", label: "Scouting", icon: ClipboardList},
    {id: "pit-scouting", label: "Pit Scouting", icon: Bot},
    {id: "analytics", label: "Analytics", icon: BarChart3},
    {id: "opr", label: "OPR", icon: Zap},
    {id: "leaderboard", label: "Leaderboard", icon: Trophy},
];

export type SystemStatus = "ok" | "degraded" | "down";

export const overallStatus = (firebase: SystemStatus, tba: SystemStatus): SystemStatus =>
    firebase === "ok" && tba === "ok" ? "ok" : firebase === "down" && tba === "down" ? "down" : "degraded";

const isPermissionError = (err: unknown) => {
    const {code, message} = (err ?? {}) as { code?: string; message?: string };
    return /permission/i.test(String(code)) || /permission denied/i.test(String(message));
};

// Unauthenticated clients are blocked by DB rules, so report degraded without reading.
export const checkFirebase = async (user: User | null): Promise<SystemStatus> => {
    if (!user) return "degraded";
    try {
        await get(ref(db, "__healthcheck"));
        return "ok";
    } catch {
        try {
            await get(ref(db, `users/${user.uid}`));
            return "ok";
        } catch (err) {
            if (isPermissionError(err)) return "degraded";
            console.debug("__healthcheck read failed and fallback failed:", err);
            return "down";
        }
    }
};

// null = still checking
export const useSystemStatus = () => {
    const [firebase, setFirebase] = useState<SystemStatus | null>(null);
    const [tba, setTba] = useState<SystemStatus | null>(null);

    useEffect(() => {
        let mounted = true;
        let seq = 0;
        checkTBAHealth().then(() => "ok" as const, () => "down" as const).then((s) => mounted && setTba(s));
        // Fires once immediately with the current user, then on every login/logout.
        const unsub = onAuthStateChanged(auth, async (user) => {
            const id = ++seq;
            const s = await checkFirebase(user);
            if (mounted && id === seq) setFirebase(s);
        });
        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    return {firebase, tba};
};
