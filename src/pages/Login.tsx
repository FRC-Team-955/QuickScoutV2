import {useEffect, useState} from "react";
import {isPitDisplayEmail, useAuth} from "@/contexts/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Bot} from "lucide-react";

const DEFAULT_PASSWORD = "123456";
const PITDISPLAY_PASSWORD = "123456";

// Any @gmail.com (leads and the pit display) must type a password; everyone else uses the default.
const needsPassword = (email: string) => email.trim().toLowerCase().endsWith("@gmail.com");

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(DEFAULT_PASSWORD);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const {login} = useAuth();
    const isLead = needsPassword(email);
    const isPitDisplayUser = isPitDisplayEmail(email);

    useEffect(() => {
        setPassword(isLead ? "" : DEFAULT_PASSWORD);
    }, [isLead]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return setError("Please enter your email");
        if (isLead && !password) return setError("Please enter your password");
        if (isPitDisplayUser && password !== PITDISPLAY_PASSWORD) return setError("Incorrect password for pit display");

        setError("");
        setLoading(true);
        try {
            await login(email, password || DEFAULT_PASSWORD);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Login failed";
            // invalid-credential is what Firebase returns for a bad password when email enumeration protection is on
            setError(/password|invalid-credential/.test(errorMessage) ? "Incorrect email or password." : errorMessage);
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
                            <Bot className="w-8 h-8 text-primary"/>
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
