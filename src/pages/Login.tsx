import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { isLeadEmail } from "@/lib/lead-users";
import { set } from "date-fns";

const DEFAULT_PASSWORD = "123456";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const isLead = isLeadEmail(email);

  useEffect(() => {
    if (!isLead) {
      setPassword(DEFAULT_PASSWORD);
    } else {
      setPassword("");
    }
  }, [isLead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim()) {
        setError("Please enter your email");
        setLoading(false);
        return;
      }

      if (isLead && !password) {
        setError("Please enter your password");
        setLoading(false);
        return;
      }

      await login(email, password || DEFAULT_PASSWORD);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      // Friendly mapping for common Firebase auth errors
      if (errorMessage.includes("auth/wrong-password") || errorMessage.includes("password")) {
        setError("Incorrect email or password.");
      } else if (errorMessage.includes("already logged in")) {
        setError(errorMessage); // preserve the clear, user-friendly message
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-mono">QuickScoutV2</CardTitle>
          <CardDescription>Team 955 / 749 - Scout Login</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="School Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>
            {isLead && (
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email.trim() || (isLead && !password)}
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
