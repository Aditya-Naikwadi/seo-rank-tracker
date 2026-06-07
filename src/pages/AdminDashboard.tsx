/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import type { User } from "../context/UserContext";
import { Users, FileText, Target, Activity, Search, ShieldAlert, UserCheck, Trash2, Edit2, Database, Settings, Power, Save, RefreshCw, ChevronRight, X, UserMinus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";


interface SystemScanItem {
    _id: string;
    url: string;
    overallScore: number;
    status: string;
    createdAt: string;
    userEmail?: string;
}

interface SystemRankingItem {
    _id: string;
    keyword: string;
    url: string;
    currentPosition: number | null;
    lastChecked: string | null;
    userEmail?: string;
}

export default function AdminDashboard() {
    const { users, user: currentUser, impersonate, updateUser, deleteUser, resetUserData } = useUser();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"users" | "crawls" | "settings">("users");
    const [searchQuery, setSearchQuery] = useState("");
    const [planFilter, setPlanFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");

    // Edit modal states
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editName, setEditName] = useState("");
    const [editRole, setEditRole] = useState<"user" | "admin">("user");
    const [editPlan, setEditPlan] = useState<"free" | "pro" | "enterprise">("free");
    const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");

    // System metrics states
    const [scans, setScans] = useState<SystemScanItem[]>([]);
    const [rankings, setRankings] = useState<SystemRankingItem[]>([]);
    const [proxyLatency, setProxyLatency] = useState(142);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [scraperTimeout, setScraperTimeout] = useState(15);

    useEffect(() => {
        (async () => {
            // Load all data across users
            const scansRaw = localStorage.getItem("seo_tracker_analyses");
            setScans(scansRaw ? JSON.parse(scansRaw) : []);

            const rankingsRaw = localStorage.getItem("seo_tracker_rankings");
            setRankings(rankingsRaw ? JSON.parse(rankingsRaw) : []);

            const configRaw = localStorage.getItem("seo_tracker_sys_config");
            if (configRaw) {
                const config = JSON.parse(configRaw);
                setMaintenanceMode(config.maintenanceMode || false);
                setScraperTimeout(config.scraperTimeout || 15);
            }
        })();
    }, []);


    const saveSystemConfig = (mMode: boolean, sTimeout: number) => {
        localStorage.setItem("seo_tracker_sys_config", JSON.stringify({
            maintenanceMode: mMode,
            scraperTimeout: sTimeout
        }));
        setMaintenanceMode(mMode);
        setScraperTimeout(sTimeout);
        toast.success("System configurations saved.");
    };

    // Filters
    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlan = planFilter === "all" || u.plan === planFilter;
        const matchesRole = roleFilter === "all" || u.role === roleFilter;
        return matchesSearch && matchesPlan && matchesRole;
    });

    const handleOpenEdit = (u: User) => {
        setEditingUser(u);
        setEditName(u.name);
        setEditRole(u.role);
        setEditPlan(u.plan);
        setEditStatus(u.status);
    };

    const handleSaveEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;

        // Prevent admin from removing their own admin role
        if (editingUser.id === currentUser?.id && editRole !== "admin") {
            toast.error("You cannot demote yourself from Administrator role.");
            return;
        }

        updateUser(editingUser.id, {
            name: editName,
            role: editRole,
            plan: editPlan,
            status: editStatus
        });
        
        toast.success(`User settings updated for ${editName}.`);
        setEditingUser(null);
    };

    const handleImpersonate = (u: User) => {
        if (u.id === currentUser?.id) {
            toast.error("You are already logged in as this user.");
            return;
        }
        if (u.status === "suspended") {
            toast.error("Cannot impersonate a suspended user account.");
            return;
        }
        impersonate(u.id);
        toast.success(`Impersonation active. Simulating session for ${u.name}.`);
        navigate("/dashboard");
    };


    const handleDeleteUser = (u: User) => {
        if (u.id === currentUser?.id) {
            toast.error("You cannot delete your own account.");
            return;
        }
        if (confirm(`Are you absolutely sure you want to delete ${u.name}'s account?\nThis will permanently delete all their crawls and rank tracking records.`)) {
            deleteUser(u.id);
            toast.success(`Account for ${u.name} deleted.`);
            // Update local scans/rankings counts
            const scansRaw = localStorage.getItem("seo_tracker_analyses");
            setScans(scansRaw ? JSON.parse(scansRaw) : []);
            const rankingsRaw = localStorage.getItem("seo_tracker_rankings");
            setRankings(rankingsRaw ? JSON.parse(rankingsRaw) : []);
        }
    };

    const handleResetUserData = (u: User) => {
        if (confirm(`Wipe all SEO audits and rank tracker entries for ${u.name}?`)) {
            resetUserData(u.id, u.email);
            toast.success(`Data reset completed for ${u.name}.`);
            // Update local scans/rankings counts
            const scansRaw = localStorage.getItem("seo_tracker_analyses");
            setScans(scansRaw ? JSON.parse(scansRaw) : []);
            const rankingsRaw = localStorage.getItem("seo_tracker_rankings");
            setRankings(rankingsRaw ? JSON.parse(rankingsRaw) : []);
        }
    };

    const handleResetSystemDB = () => {
        if (confirm("⚠️ CRITICAL WARNING: Reset entire database?\nThis will erase ALL user accounts, all crawls, and all rank trackers, and re-seed defaults.")) {
            localStorage.clear();
            sessionStorage.clear();
            toast.success("System database wiped. Refreshing page...");
            setTimeout(() => {
                navigate("/login");
            }, 1000);
        }
    };


    const handleDeleteScan = (id: string) => {
        if (confirm("Delete this scan report?")) {
            const updated = scans.filter(s => s._id !== id);
            localStorage.setItem("seo_tracker_analyses", JSON.stringify(updated));
            setScans(updated);
            toast.success("Scan report removed.");
        }
    };

    return (
        <div className="min-h-screen pt-16 md:pt-24 bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-medium text-foreground mb-1">
                            System <span className="gradient-text">Admin Panel</span>
                        </h1>
                        <p className="text-muted-foreground text-sm">Control workspaces, configuration parameters, and user sessions.</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setProxyLatency(Math.round(100 + Math.random() * 80))}
                            className="glass px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-muted flex items-center gap-2 text-foreground cursor-pointer"
                        >
                            <RefreshCw size={14} />
                            Ping Scrapers
                        </button>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="glass rounded-2xl p-5 flex items-center gap-4 border border-border/50">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 shrink-0">
                            <Users size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{users.length}</p>
                            <p className="text-xs text-muted-foreground">Total Users</p>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-5 flex items-center gap-4 border border-border/50">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <FileText size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{scans.length}</p>
                            <p className="text-xs text-muted-foreground">Analyses Completed</p>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-5 flex items-center gap-4 border border-border/50">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                            <Target size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{rankings.length}</p>
                            <p className="text-xs text-muted-foreground">Active Trackers</p>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-5 flex items-center gap-4 border border-border/50">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                            <Activity size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{proxyLatency}ms</p>
                            <p className="text-xs text-muted-foreground">Scraping Node Latency</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-border/60 pb-1">
                    {[
                        { id: "users", label: "Users DB", icon: <Users size={16} /> },
                        { id: "crawls", label: "Global Scans Log", icon: <FileText size={16} /> },
                        { id: "settings", label: "System Config", icon: <Settings size={16} /> }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === t.id 
                                    ? "border-b-2 border-primary text-primary font-bold" 
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Contents */}
                {activeTab === "users" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 flex-1 border border-border/40">
                                <Search size={18} className="text-muted-foreground" />
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={(e) => setSearchQuery(e.target.value)} 
                                    placeholder="Search users by name or email..." 
                                    className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none flex-1"
                                />
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={planFilter} 
                                    onChange={(e) => setPlanFilter(e.target.value)}
                                    className="glass rounded-xl px-3 py-2 text-xs text-foreground bg-card outline-none border border-border/40 cursor-pointer"
                                >
                                    <option value="all">All Plans</option>
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                                <select 
                                    value={roleFilter} 
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="glass rounded-xl px-3 py-2 text-xs text-foreground bg-card outline-none border border-border/40 cursor-pointer"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="admin">Admin</option>
                                    <option value="user">User</option>
                                </select>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="glass rounded-2xl overflow-hidden border border-border/50">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground font-semibold uppercase">
                                            <th className="p-4 pl-6">User / Account</th>
                                            <th className="p-4">Role</th>
                                            <th className="p-4">Subscription Plan</th>
                                            <th className="p-4">Account Status</th>
                                            <th className="p-4 text-right pr-6">Management Operations</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50 text-sm">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    No user accounts match your search filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map(u => (
                                                <tr key={u.id} className="hover:bg-muted/30 transition-all">
                                                    <td className="p-4 pl-6">
                                                        <div className="font-semibold text-foreground">{u.name}</div>
                                                        <div className="text-xs text-muted-foreground">{u.email}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                            u.role === "admin" 
                                                                ? "bg-violet-500/10 text-violet-500 border border-violet-500/20" 
                                                                : "bg-muted text-muted-foreground border border-border"
                                                        }`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-semibold text-foreground uppercase text-xs tracking-wider">
                                                        {u.plan}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit ${
                                                            u.status === "active" 
                                                                ? "bg-success/15 text-success" 
                                                                : "bg-danger/15 text-danger"
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-success" : "bg-danger"}`} />
                                                            {u.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right pr-6 space-x-1">
                                                        <button 
                                                            onClick={() => handleImpersonate(u)}
                                                            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                                                            title="Impersonate User Session"
                                                        >
                                                            <UserCheck size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleOpenEdit(u)}
                                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                                            title="Edit Subscription/Role"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleResetUserData(u)}
                                                            className="p-2 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition-all cursor-pointer"
                                                            title="Wipe User SEO Data"
                                                        >
                                                            <Database size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(u)}
                                                            disabled={u.id === currentUser?.id}
                                                            className="p-2 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all disabled:opacity-30 cursor-pointer"
                                                            title="Delete Account Permanently"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "crawls" && (
                    <div className="glass rounded-2xl p-6 border border-border/50">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-primary" />
                            Scraped Website Audits (All Users)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border/60 text-xs text-muted-foreground font-semibold uppercase">
                                        <th className="pb-3 pl-4">Target Website</th>
                                        <th className="pb-3">Owner</th>
                                        <th className="pb-3 text-center">Score</th>
                                        <th className="pb-3">Crawled Date</th>
                                        <th className="pb-3 text-right pr-4">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 text-sm">
                                    {scans.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                                No scan reports exist in the system cache.
                                            </td>
                                        </tr>
                                    ) : (
                                        scans.map(s => (
                                            <tr key={s._id} className="hover:bg-muted/20 transition-all">
                                                <td className="py-3 pl-4">
                                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-primary flex items-center gap-1">
                                                        {s.url}
                                                        <ChevronRight size={14} />
                                                    </a>
                                                    <span className="text-[10px] text-muted-foreground">ID: {s._id}</span>
                                                </td>
                                                <td className="py-3 text-muted-foreground">
                                                    {s.userEmail || <span className="italic opacity-60">Anonymous</span>}
                                                </td>
                                                <td className="py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                        s.overallScore >= 80 
                                                            ? "bg-emerald-500/10 text-emerald-400" 
                                                            : s.overallScore >= 50 
                                                            ? "bg-amber-500/10 text-amber-400" 
                                                            : "bg-danger/10 text-danger"
                                                    }`}>
                                                        {s.overallScore}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-xs text-muted-foreground">
                                                    {new Date(s.createdAt).toLocaleDateString()} at {new Date(s.createdAt).toLocaleTimeString()}
                                                </td>
                                                <td className="py-3 text-right pr-4">
                                                    <button 
                                                        onClick={() => handleDeleteScan(s._id)}
                                                        className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all cursor-pointer"
                                                        title="Delete Scan"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "settings" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Simulation Controls */}
                        <div className="glass rounded-2xl p-6 border border-border/50 space-y-6">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                                <Settings size={20} className="text-accent" />
                                Scraper Engine Overrides
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-foreground mb-1.5">Simulated Rate-Limit Delay (Seconds)</label>
                                    <input 
                                        type="number" 
                                        min={1} 
                                        max={60} 
                                        value={scraperTimeout}
                                        onChange={(e) => setScraperTimeout(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground outline-none text-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">Adjust target fetch worker timeout before scraping cancels.</p>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-muted/40 border border-border rounded-xl">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Global Maintenance Mode</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Locks all scans and displays maintenance warnings.</p>
                                    </div>
                                    <button 
                                        onClick={() => setMaintenanceMode(!maintenanceMode)}
                                        className={`p-2 rounded-xl border transition-all ${
                                            maintenanceMode 
                                                ? "bg-danger/15 text-danger border-danger/30" 
                                                : "bg-success/15 text-success border-success/30"
                                        } flex items-center gap-1 text-xs font-semibold cursor-pointer`}
                                    >
                                        <Power size={14} />
                                        {maintenanceMode ? "ACTIVE (LOCK)" : "INACTIVE (OPEN)"}
                                    </button>
                                </div>

                                <button 
                                    onClick={() => saveSystemConfig(maintenanceMode, scraperTimeout)}
                                    className="w-full py-3 bg-primary rounded-xl font-semibold text-sm text-primary-foreground hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
                                    style={{ color: "var(--background)" }}
                                >
                                    <Save size={16} />
                                    Save Configurations
                                </button>
                            </div>
                        </div>

                        {/* Reset Center */}
                        <div className="glass rounded-2xl p-6 border border-border/50 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-3 mb-4">
                                    <ShieldAlert size={20} className="text-danger" />
                                    Database Administration & Safety
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Perform critical admin operations. Erasing systems caches or re-seeding databases will reset local storage back to its clean post-mock installation state.
                                </p>

                                <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 text-xs text-danger/80 space-y-2 mb-6">
                                    <p className="font-bold flex items-center gap-1">
                                        <ShieldAlert size={14} />
                                        SYSTEM OPERATION HAZARDS
                                    </p>
                                    <p>Resetting parameters wipes all persistent analysis files and keywords lists currently stored in user local workspaces. This operation is irreversible.</p>
                                </div>
                            </div>

                            <button 
                                onClick={handleResetSystemDB}
                                className="w-full py-3 bg-danger/10 hover:bg-danger/20 border border-danger/25 text-danger rounded-xl font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                <UserMinus size={16} />
                                Reset & Re-seed Entire Application
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-foreground">Edit Account: {editingUser.email}</h2>
                            <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-1">System Role</label>
                                <select 
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value as any)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm outline-none cursor-pointer"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-1">Subscription Plan</label>
                                <select 
                                    value={editPlan}
                                    onChange={(e) => setEditPlan(e.target.value as any)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm outline-none cursor-pointer"
                                >
                                    <option value="free">Free Tier (5 Scans/day)</option>
                                    <option value="pro">Pro Tier (100 Scans/day)</option>
                                    <option value="enterprise">Enterprise (Unlimited)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-foreground mb-1">Account Status</label>
                                <select 
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value as any)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm outline-none cursor-pointer"
                                >
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended (Locks Login)</option>
                                </select>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                style={{ color: "var(--background)" }}
                            >
                                <Save size={16} />
                                Save Settings
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
