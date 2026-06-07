/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";


export interface User {
    id: string;
    name: string;
    email: string;
    role: "user" | "admin";
    plan: "free" | "pro" | "enterprise";
    status: "active" | "suspended";
    password?: string;
}

interface UserContextState {
    user: User | null;
    originalUser: User | null;
    users: User[];
    login: (email: string, password: string) => Promise<boolean>;
    register: (name: string, email: string) => Promise<boolean>;
    logout: () => void;
    impersonate: (userId: string) => void;
    stopImpersonating: () => void;
    updateUser: (userId: string, updates: Partial<User>) => void;
    deleteUser: (userId: string) => void;
    resetUserData: (userId: string, email: string) => void;
}

const UserContext = createContext<UserContextState | undefined>(undefined);

const SEED_USERS: User[] = [
    {
        id: "admin-1",
        name: "Admin User",
        email: "admin@rankpilot.com",
        role: "admin",
        plan: "enterprise",
        status: "active",
        password: "admin123"
    },
    {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        plan: "pro",
        status: "active",
        password: "user123"
    },
    {
        id: "user-2",
        name: "Jane Smith",
        email: "jane@example.com",
        role: "user",
        plan: "free",
        status: "active",
        password: "user123"
    }
];

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [users, setUsers] = useState<User[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [originalUser, setOriginalUser] = useState<User | null>(null);

    // Initial Seed
    useEffect(() => {
        (async () => {
            const storedUsers = localStorage.getItem("seo_tracker_users");
            if (storedUsers) {
                setUsers(JSON.parse(storedUsers));
            } else {
                localStorage.setItem("seo_tracker_users", JSON.stringify(SEED_USERS));
                setUsers(SEED_USERS);
            }

            const storedSession = sessionStorage.getItem("seo_tracker_session");
            const storedImpersonatedSession = sessionStorage.getItem("seo_tracker_impersonated_session");

            if (storedSession) {
                const parsedSession = JSON.parse(storedSession);
                if (storedImpersonatedSession) {
                    setOriginalUser(parsedSession);
                    setUser(JSON.parse(storedImpersonatedSession));
                } else {
                    setUser(parsedSession);
                }
            }
        })();
    }, []);


    const login = async (email: string, password: string): Promise<boolean> => {
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!found) return false;
        if (found.status === "suspended") {
            throw new Error("Your account has been suspended by the administrator.");
        }

        setUser(found);
        setOriginalUser(null);
        sessionStorage.setItem("seo_tracker_session", JSON.stringify(found));
        sessionStorage.removeItem("seo_tracker_impersonated_session");
        return true;
    };

    const register = async (name: string, email: string): Promise<boolean> => {
        const normalizedEmail = email.toLowerCase();
        const exists = users.some(u => u.email.toLowerCase() === normalizedEmail);
        if (exists) {
            throw new Error("An account with this email already exists.");
        }

        const newUser: User = {
            id: Math.random().toString(36).substring(2, 10),
            name: name.trim(),
            email: normalizedEmail,
            role: "user",
            plan: "free",
            status: "active",
            password: "user123" // Default password for mockup register
        };

        const updatedUsers = [...users, newUser];
        localStorage.setItem("seo_tracker_users", JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        setUser(newUser);
        setOriginalUser(null);
        sessionStorage.setItem("seo_tracker_session", JSON.stringify(newUser));
        sessionStorage.removeItem("seo_tracker_impersonated_session");
        return true;
    };

    const logout = () => {
        setUser(null);
        setOriginalUser(null);
        sessionStorage.removeItem("seo_tracker_session");
        sessionStorage.removeItem("seo_tracker_impersonated_session");
    };

    const impersonate = (userId: string) => {
        const found = users.find(u => u.id === userId);
        if (!found) return;

        // Ensure we are currently an admin
        const currentActive = originalUser || user;
        if (!currentActive || currentActive.role !== "admin") return;

        if (!originalUser) {
            // Store the admin account as originalUser
            setOriginalUser(user);
            sessionStorage.setItem("seo_tracker_session", JSON.stringify(user));
        }

        setUser(found);
        sessionStorage.setItem("seo_tracker_impersonated_session", JSON.stringify(found));
    };

    const stopImpersonating = () => {
        if (!originalUser) return;
        setUser(originalUser);
        setOriginalUser(null);
        sessionStorage.removeItem("seo_tracker_impersonated_session");
    };

    const updateUser = (userId: string, updates: Partial<User>) => {
        const updatedUsers = users.map(u => {
            if (u.id === userId) {
                const updated = { ...u, ...updates };
                // If current user is modified, update session storage
                if (user && user.id === userId) {
                    setUser(updated);
                    if (originalUser) {
                        sessionStorage.setItem("seo_tracker_impersonated_session", JSON.stringify(updated));
                    } else {
                        sessionStorage.setItem("seo_tracker_session", JSON.stringify(updated));
                    }
                }
                if (originalUser && originalUser.id === userId) {
                    setOriginalUser(updated);
                    sessionStorage.setItem("seo_tracker_session", JSON.stringify(updated));
                }
                return updated;
            }
            return u;
        });

        localStorage.setItem("seo_tracker_users", JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
    };

    const deleteUser = (userId: string) => {
        const found = users.find(u => u.id === userId);
        const updatedUsers = users.filter(u => u.id !== userId);
        localStorage.setItem("seo_tracker_users", JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        if (found) {
            resetUserData(userId, found.email);
        }

        if (user && user.id === userId) {
            logout();
        }
    };

    const resetUserData = (userId: string, email: string) => {
        void userId; // Kept for API alignment
        // Clear all analyses associated with this user
        const analysesRaw = localStorage.getItem("seo_tracker_analyses");
        if (analysesRaw) {
            const analyses = JSON.parse(analysesRaw);
            // In a production app analyses would be tied to userId.
            // For this local client-side prototype we filter by site name or matching ownership,
            // or we clear relevant items. Let's filter out entries if we implement multi-tenant tracking.
            // To make it simple and fully-functional, we can tie analyses and rankings to the email
            // or userId in local storage. Let's make sure we support scoping.
            const filteredAnalyses = analyses.filter((a: { userEmail?: string }) => a.userEmail !== email);
            localStorage.setItem("seo_tracker_analyses", JSON.stringify(filteredAnalyses));
        }

        const rankingsRaw = localStorage.getItem("seo_tracker_rankings");
        if (rankingsRaw) {
            const rankings = JSON.parse(rankingsRaw);
            const filteredRankings = rankings.filter((r: { userEmail?: string }) => r.userEmail !== email);
            localStorage.setItem("seo_tracker_rankings", JSON.stringify(filteredRankings));
        }
    };


    return (
        <UserContext.Provider
            value={{
                user,
                originalUser,
                users,
                login,
                register,
                logout,
                impersonate,
                stopImpersonating,
                updateUser,
                deleteUser,
                resetUserData
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
