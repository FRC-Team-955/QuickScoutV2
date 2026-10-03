import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { setUserPresence, clearUserPresence, removeUserCompletely, leaveQueue, setSuppressPresenceOnUnload, shouldSuppressPresenceOnUnload, removeUserLastActive } from "@/lib/queue";

interface User {
  id: string;
  name: string;
  teamNumber: number;
  email?: string;
  isLead: boolean;
  role?: 'pitDisplay' | 'scouter' | 'lead';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const PIT_DISPLAY_EMAIL = "pitdisplay@gmail.com";

export const isPitDisplayEmail = (email?: string) => email?.trim().toLowerCase() === PIT_DISPLAY_EMAIL;
// Leads sign in with a @gmail.com account; the pit display kiosk account is never a lead.
export const isLeadEmail = (email?: string) =>
  !!email?.trim().toLowerCase().endsWith("@gmail.com") && !isPitDisplayEmail(email);

export const mapFirebaseUser = (u: { uid: string; email?: string | null; displayName?: string | null }): User => {
  const name = u.displayName || u.email?.split("@")[0] || "User";
  return {
    id: u.uid,
    name: name.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    email: u.email || undefined,
    teamNumber: 955,
    isLead: isLeadEmail(u.email),
    role: isPitDisplayEmail(u.email) ? 'pitDisplay' : 'scouter',
  };
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    const mapped = firebaseUser ? mapFirebaseUser(firebaseUser) : null;
    setUser(mapped);
    if (mapped && mapped.role !== 'pitDisplay') {
      setUserPresence(mapped).catch(console.error);
    }
    setLoading(false);
  }), []);

  useEffect(() => {
    const handler = () => {
      if (shouldSuppressPresenceOnUnload()) return;
      if (user?.id) {
        clearUserPresence(user.id).catch(console.error);
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [user]);

  const login = async (email: string, password: string) => {
    email = email.trim();
    // Local pit display kiosk: no Firebase account involved
    if (isPitDisplayEmail(email) && password === "123456") {
      setUser({
        id: "pit-display-local",
        name: "Pit Display",
        email: PIT_DISPLAY_EMAIL,
        teamNumber: 955,
        isLead: false,
        role: 'pitDisplay',
      });
      return;
    }

    try {
      // onAuthStateChanged also fires and writes presence; set the user here too so callers see it immediately.
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(mapFirebaseUser(cred.user));
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // pitDisplay has no presence/queue entries to clean up
      if (user?.id && user.role !== 'pitDisplay') {
        // prevent the unload handler during explicit logout cleanup
        setSuppressPresenceOnUnload(true);
        try {
          await removeUserCompletely(user.id);
        } catch (err) {
          console.warn("removeUserCompletely failed on logout — attempting targeted cleanup", err);
          // Don't call clearUserPresence here (that writes lastActive); best-effort cleanup instead.
          await removeUserLastActive(user.id).catch(console.debug);
          await leaveQueue(user.id).catch(console.debug);
        } finally {
          // small delay to reduce races where other presence writers might run
          await new Promise((r) => setTimeout(r, 50));
          setSuppressPresenceOnUnload(false);
        }
      }

      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  return (
      <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
        {children}
      </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
