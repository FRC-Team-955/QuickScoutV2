import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { setUserPresence, clearUserPresence, removeUserCompletely, leaveQueue, setSuppressPresenceOnUnload, shouldSuppressPresenceOnUnload, removeUserLastActive } from "@/lib/queue";
import { get, ref } from "firebase/database";

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

const isLeadGmail = (email?: string) => {
  return typeof email === "string" && email.toLowerCase().endsWith("@gmail.com");
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const name =
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0]||
            "User";
        const formatName =
            name.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
        const isPitDisplay = firebaseUser.email?.toLowerCase() === "pitdisplay@gmail.com";
        const mappedUser: User = {
          id: firebaseUser.uid,
          name: formatName,
          email: firebaseUser.email || undefined,
          teamNumber: 955,
          isLead: isLeadGmail(firebaseUser.email || undefined),
          role: isPitDisplay ? 'pitDisplay' : 'scouter',
        };
        setUser(mappedUser);
        if (!isPitDisplay) {
          setUserPresence(mappedUser).catch(console.error);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
    try {
      // Special handling for local pitDisplay user
      if (email.trim().toLowerCase() === "pitdisplay@gmail.com" && password === "123456") {
        const localUser: User = {
          id: "pit-display-local",
          name: "Pit Display",
          email: "pitdisplay@gmail.com",
          teamNumber: 955,
          isLead: false,
          role: 'pitDisplay',
        };
        setUser(localUser);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const signed = cred.user || auth.currentUser;
      if (!signed) throw new Error("Login failed");

      const userSnap = await get(ref(db, `users`));
      if (userSnap.exists()) {
        const users = userSnap.val();
        const found = Object.values(users).find((u) => (u as any).email === email) as any;

        // Only block if explicitly marked online (not just lastActive)
        if (found?.isOnline === true) {
          await signOut(auth);
          throw new Error("This user is already logged in elsewhere. Please log out from other devices first.");
        }
      }

      const name = signed.displayName || signed.email?.split("@")[0] || "User";
      const formatName = name.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

      const mapped: User = {
        id: signed.uid,
        name: formatName,
        email: signed.email || undefined,
        teamNumber: 955,
        isLead: isLeadGmail(signed.email || undefined),
      };
      setUser(mapped);
      console.debug("Auth.login: calling setUserPresence for", mapped.id);
      await setUserPresence(mapped);
      console.debug("Auth.login: setUserPresence complete");

      // notify other listeners (sidebar healthchecks) that auth changed
      try {
        window.dispatchEvent(new CustomEvent('qs:auth-changed', { detail: { userId: mapped.id } }));
      } catch (e) {
        console.debug('qs:auth-changed dispatch failed', e);
      }
      return;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // pitDisplay local user doesn't need database cleanup
      if (user?.role === 'pitDisplay') {
        setUser(null);
        return;
      }

      if (user?.id) {
        // prevent the unload handler during explicit logout cleanup
        setSuppressPresenceOnUnload(true);

        try {
          await removeUserCompletely(user.id);
        } catch (err) {
          console.warn("removeUserCompletely failed on logout — attempting targeted cleanup", err);
          // Don't call clearUserPresence here (that writes lastActive). Instead try to
          // remove the lastActive field and any queue entries. These are best-effort.
          try {
            await removeUserLastActive(user.id);
          } catch (er) {
            console.debug("removeUserLastActive also failed", er);
          }
          try {
            await leaveQueue(user.id);
          } catch (er) {
            console.debug("leaveQueue failed during logout cleanup", er);
          }
        } finally {
          // small delay to reduce races where other presence writers might run
          await new Promise((r) => setTimeout(r, 50));
          setSuppressPresenceOnUnload(false);
        }
      }

      // sign out any authenticated user (anonymous or email)
      if (auth.currentUser) {
        await signOut(auth);
      }

      setUser(null);

      // notify others of logout
      try {
        window.dispatchEvent(new CustomEvent('qs:auth-changed', { detail: { userId: null } }));
      } catch (e) {
        console.debug('qs:auth-changed dispatch failed', e);
      }
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
