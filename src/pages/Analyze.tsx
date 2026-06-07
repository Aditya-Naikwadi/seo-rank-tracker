/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SearchIcon, GlobeIcon, FileSearchIcon, BrainIcon, CheckCircleIcon, AlertCircle, Loader2, ArrowRightIcon } from "lucide-react";
import { fetchPageHtml, parseHtmlContent, generateAnalysisReport } from "../assets/seoScraper";
import { useUser } from "../context/UserContext";

const STEPS = [
    { icon: <GlobeIcon size={22} />, label: "Connecting to browser", desc: "Creating cloud browser session..." },
    { icon: <FileSearchIcon size={22} />, label: "Scanning website", desc: "Extracting meta tags, links, images..." },
    { icon: <BrainIcon size={22} />, label: "AI Analysis", desc: "Gemini is analyzing your SEO data..." },
    { icon: <CheckCircleIcon size={22} />, label: "Report Ready", desc: "Your SEO report is complete!" },
];

export default function Analyze() {
    const { user } = useUser();
    const [url, setUrl] = useState("");

    const [analyzing, setAnalyzing] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState("");
    const [searchParams] = useSearchParams();
    const pollRef = useRef<any>(null);

    const navigate = useNavigate();

    const handleAnalyze = async (submitUrl?: string) => {
        const targetUrl = submitUrl || url;
        if (!targetUrl.trim()) return;

        setError("");
        setAnalyzing(true);
        setCurrentStep(0);

        try {
            // Step 0: Connecting (brief delay for visual feel)
            await new Promise((resolve) => setTimeout(resolve, 800));

            // Step 1: Scanning / Fetching
            setCurrentStep(1);
            const { html, loadTime, statusCode } = await fetchPageHtml(targetUrl);

            // Step 2: Parsing & Analysing
            setCurrentStep(2);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const scraped = parseHtmlContent(html, targetUrl, loadTime, statusCode);
            const report = generateAnalysisReport(scraped);
            if (user) {
                (report as any).userEmail = user.email;
            }

            // Step 3: Saving & Finalizing
            setCurrentStep(3);
            await new Promise((resolve) => setTimeout(resolve, 600));

            // Save to localStorage
            const existingRaw = localStorage.getItem("seo_tracker_analyses");
            const existing = existingRaw ? JSON.parse(existingRaw) : [];
            // Check if URL already exists and remove it to avoid duplicates, keeping the newest scan at top
            // Filter by userEmail to allow multiple users to scan the same URL independently
            const filtered = existing.filter((item: any) => {
                const sameUrl = item.url.toLowerCase() === targetUrl.toLowerCase();
                const sameUser = item.userEmail === (user?.email || "");
                return !(sameUrl && sameUser);
            });
            const updated = [report, ...filtered];
            localStorage.setItem("seo_tracker_analyses", JSON.stringify(updated));


            setAnalyzing(false);
            navigate(`/report/${report._id}`);
        } catch (err: any) {
            console.error("Scraping failed: ", err);
            setError(err.message || "Could not fetch or parse the website. Please check the URL and your connection.");
            setAnalyzing(false);
        }
    };


    const handleSubmit = (e: React.SubmitEvent) => {
        e.preventDefault();
        handleAnalyze();
    };

    useEffect(() => {
        const prefillUrl = searchParams.get("url");
        if (prefillUrl) {
            (() => setUrl(prefillUrl))();
            // Auto-start if URL is provided
            setTimeout(() => handleAnalyze(prefillUrl), 500);
        }

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    return (
        <div className="min-h-screen pt-16 md:pt-24 bg-background">
            <div className="max-w-3xl mx-auto px-4 py-12">
                {!analyzing ? (
                    <div>
                        <div className="text-center mb-10 mt-24">
                            <h1 className="text-3xl sm:text-4xl font-medium text-foreground mb-3">
                                Analyze <span className="gradient-text">Any Website</span>
                            </h1>
                            <p className="text-muted-foreground">Enter a URL to get a comprehensive AI-powered SEO audit report.</p>
                        </div>

                        {error && (
                            <div className="mb-6 px-4 py-3 rounded-xl severity-critical text-sm flex items-center gap-2 max-w-xl mx-auto">
                                <AlertCircle size={18} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
                            <div className="border border-primary/20 rounded-full p-1.5 px-2 flex items-center gap-2">
                                <div className="flex items-center gap-3 flex-1 px-3">
                                    <SearchIcon size={20} className="text-muted-foreground shrink-0" />
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="Enter website URL (e.g., example.com)"
                                        className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none text-base py-3"
                                        id="analyze-url-input"
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" className="bg-primary px-6 py-3 rounded-full flex items-center gap-2 text-primary-foreground text-sm hover:opacity-90 transition-opacity shrink-0" id="analyze-submit-btn" style={{ color: "var(--background)" }}>
                                    Analyze <ArrowRightIcon className="text-background size-4 shrink-0" />
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            Examples:{" "}
                            {["github.com", "stripe.com", "vercel.com"].map((ex, i) => (
                                <span key={ex}>
                                    <button
                                        onClick={() => {
                                            setUrl(ex);
                                        }}
                                        className="text-primary hover:underline"
                                    >
                                        {ex}
                                    </button>
                                    {i < 2 ? ", " : ""}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Analyzing State */}
                        <div className="text-center mb-12">
                            <h2 className="text-2xl font-medium text-foreground">Analyzing Your Website</h2>
                            <div className="flex justify-center items-center gap-2 mt-2">
                                <Loader2 size={16} className="text-primary/60 mt-0.5 animate-spin" />
                                <p className="text-muted-foreground sm:text-lg">{url}</p>
                            </div>
                        </div>

                        {/* Progress Steps */}
                        <div className="max-w-md mx-auto space-y-4">
                            {STEPS.map((step, i) => {
                                const isComplete = i < currentStep;
                                const isCurrent = i === currentStep;
                                const isPending = i > currentStep;

                                return (
                                    <div key={step.label} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${isCurrent ? "glass-strong border-primary/30" : isComplete ? "glass opacity-60" : "glass opacity-30"}`}>
                                        <div
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? "bg-success/15 text-success" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                                            style={isCurrent ? { color: "var(--background)" } : {}}
                                        >
                                            {isComplete ? <CheckCircleIcon size={20} /> : step.icon}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-medium ${isPending ? "text-muted-foreground" : "text-foreground"}`}>{step.label}</p>
                                            <p className="text-xs text-muted-foreground">{step.desc}</p>
                                        </div>
                                        {isCurrent && <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                                    </div>
                                );
                            })}
                        </div>

                        <p className="text-center text-xs text-muted-foreground mt-8">This may take 15-30 seconds depending on the website.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
