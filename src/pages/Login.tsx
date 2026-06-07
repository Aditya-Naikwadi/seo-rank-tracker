/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, ChartNoAxesColumnIcon, User2Icon, AlertCircle } from "lucide-react";
import { useUser } from "../context/UserContext";

export default function Login({ state }: { state: string }) {
    const [isLoginState, setIsLoginState] = useState(state === "login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    const { login, register } = useUser();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (isLoginState) {
                const success = await login(email, password);
                if (success) {
                    // Check if it's admin
                    if (email.toLowerCase() === "admin@rankpilot.com") {
                        navigate("/admin");
                    } else {
                        navigate("/dashboard");
                    }
                } else {
                    setError("Invalid email or password.");
                }
            } else {
                const success = await register(name, email);
                if (success) {
                    navigate("/dashboard");
                } else {
                    setError("Failed to create account.");
                }
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
        setLoading(true);
        setError("");
        try {
            const success = await login(demoEmail, demoPass);
            if (success) {
                if (demoEmail.includes("admin")) {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            } else {
                setError("Quick login failed.");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="flex items-center justify-center gap-2 group mb-6">
                        <ChartNoAxesColumnIcon className="text-primary" />
                        <span className="text-xl tracking-tight text-foreground font-semibold">Rank Pilot</span>
                    </Link>
                </div>

                {/* Form Card */}
                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="text-center py-2">
                            <h1 className="text-2xl font-bold text-foreground">{isLoginState ? "Welcome back" : "Create Account"}</h1>
                            <p className="text-muted-foreground text-sm mt-1">{isLoginState ? "Sign in to your" : "Create a new"} Rank Pilot account</p>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl severity-critical text-xs flex items-center gap-2">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {!isLoginState && (
                            <div>
                                <label className="block text-sm text-foreground mb-1.5 font-medium">Name</label>
                                <div className="relative">
                                    <User2Icon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors text-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm text-foreground mb-1.5 font-medium">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-foreground mb-1.5 font-medium">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={isLoginState ? "Enter password (e.g. admin123)" : "Create a password"}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground outline-none focus:border-primary/50 transition-colors text-sm"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 mt-4 rounded-xl bg-primary text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                            id="login-submit-btn"
                            style={{ color: "var(--background)" }}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : isLoginState ? "Sign In" : "Create Account"}
                        </button>
                    </form>

                    {/* Quick Login Section for Demos */}
                    {isLoginState && (
                        <div className="mt-6 pt-6 border-t border-border/60">
                            <p className="text-center text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Demo Quick Access</p>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => handleQuickLogin("admin@rankpilot.com", "admin123")}
                                    className="w-full py-2 px-3 text-xs border border-primary/30 rounded-xl hover:bg-primary/5 transition-all text-primary font-medium flex justify-between items-center cursor-pointer"
                                >
                                    <span>👑 Administrator</span>
                                    <span className="opacity-60 text-[10px]">admin@rankpilot.com</span>
                                </button>
                                <button
                                    onClick={() => handleQuickLogin("john@example.com", "user123")}
                                    className="w-full py-2 px-3 text-xs border border-border rounded-xl hover:bg-muted/50 transition-all text-foreground font-medium flex justify-between items-center cursor-pointer"
                                >
                                    <span>💼 Premium User</span>
                                    <span className="opacity-60 text-[10px]">john@example.com</span>
                                </button>
                                <button
                                    onClick={() => handleQuickLogin("jane@example.com", "user123")}
                                    className="w-full py-2 px-3 text-xs border border-border rounded-xl hover:bg-muted/50 transition-all text-foreground font-medium flex justify-between items-center cursor-pointer"
                                >
                                    <span>🌱 Free Tier User</span>
                                    <span className="opacity-60 text-[10px]">jane@example.com</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    {isLoginState ? "Don't have an account?" : "Already have an account?"}
                    <button
                        onClick={() => {
                            setIsLoginState((prev) => !prev);
                            setError("");
                        }}
                        className="text-primary hover:underline font-medium pl-1 cursor-pointer"
                    >
                        {isLoginState ? "Sign up" : "Sign in"}
                    </button>
                </p>
            </div>
        </div>
    );
}
