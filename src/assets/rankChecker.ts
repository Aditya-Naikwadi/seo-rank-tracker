export interface CompetitorResult {
    position: number;
    url: string;
    domain: string;
    title: string;
    snippet: string;
}

export interface RankCheckResult {
    currentPosition: number | null;
    currentPage: number | null;
    competitors: CompetitorResult[];
    lastChecked: string;
}

/**
 * Extracts domain name from a URL (e.g. "https://example.com/page" -> "example.com")
 */
export function getDomainName(url: string): string {
    try {
        let clean = url.trim();
        if (!/^https?:\/\//i.test(clean)) {
            clean = "https://" + clean;
        }
        const parsed = new URL(clean);
        return parsed.hostname.replace("www.", "");
    } catch {
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/i);
        return match ? match[1] : url;
    }
}

/**
 * Decodes DuckDuckGo redirect URLs to get the clean target URL
 */
function extractTargetUrl(ddgHref: string): string {
    if (!ddgHref) return "";
    let href = ddgHref.trim();
    if (href.startsWith("//")) {
        href = "https:" + href;
    }
    try {
        const urlObj = new URL(href);
        const uddg = urlObj.searchParams.get("uddg");
        if (uddg) {
            return decodeURIComponent(uddg);
        }
    } catch {
        // Fallback
    }
    return href;
}

/**
 * Fetches and parses DuckDuckGo search results for a keyword, detecting the ranking of a target domain.
 */
export async function checkKeywordRank(keyword: string, targetUrl: string): Promise<RankCheckResult> {
    const targetDomain = getDomainName(targetUrl).toLowerCase();
    const cleanKeyword = encodeURIComponent(keyword.trim());
    const searchUrl = `https://html.duckduckgo.com/html/?q=${cleanKeyword}`;
    
    let html = "";
    let attempts = 0;
    const maxAttempts = 3; // Initial attempt + 2 retries (double retry)
    let lastError: Error | null = null;

    while (attempts < maxAttempts && !html) {
        attempts++;
        try {
            console.log(`Crawl attempt ${attempts} for "${keyword}"...`);
            
            // Attempt 1: Fetch via api.allorigins.win
            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    const data = await response.json();
                    html = data.contents || "";
                }
            } catch (e) {
                console.warn(`Attempt ${attempts}: AllOrigins proxy failed for Rank check, trying corsproxy.io...`, e);
                lastError = e instanceof Error ? e : new Error(String(e));
            }

            // Attempt 2: Fetch via corsproxy.io
            if (!html) {
                try {
                    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(searchUrl)}`;
                    const response = await fetch(proxyUrl);
                    if (response.ok) {
                        html = await response.text();
                    }
                } catch (e) {
                    console.warn(`Attempt ${attempts}: Corsproxy.io failed for Rank check...`, e);
                    lastError = e instanceof Error ? e : new Error(String(e));
                }
            }

            // If query failed, sleep before retry (exponential backoff)
            if (!html && attempts < maxAttempts) {
                const backoffDelay = attempts * 1500;
                console.log(`Scraper retry loop active: waiting ${backoffDelay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
        }
    }

    if (!html) {
        throw new Error(`Unable to perform rank check after ${maxAttempts} attempts due to CORS proxy limits. Last error: ${lastError?.message || "Unknown error"}`);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // DuckDuckGo HTML structure search results are typically in divs with class ".result"
    const results = Array.from(doc.querySelectorAll(".result"));
    
    let currentPosition: number | null = null;
    let currentPage: number | null = null;
    const competitors: CompetitorResult[] = [];
    
    let organicIndex = 0;
    
    results.forEach((el) => {
        // Skip ads
        if (el.classList.contains("result--ad") || el.querySelector(".result__badge--ad")) {
            return;
        }
        
        const titleEl = el.querySelector(".result__title .result__a");
        const snippetEl = el.querySelector(".result__snippet");
        
        if (!titleEl) return;
        
        organicIndex++;
        
        const rawHref = titleEl.getAttribute("href") || "";
        const cleanUrl = extractTargetUrl(rawHref);
        const domain = getDomainName(cleanUrl);
        const title = titleEl.textContent?.trim() || "";
        const snippet = snippetEl?.textContent?.trim() || "";
        
        // Add as competitor
        competitors.push({
            position: organicIndex,
            url: cleanUrl,
            domain,
            title,
            snippet
        });
        
        // Check if this result matches the target domain
        if (domain.toLowerCase() === targetDomain) {
            if (currentPosition === null) {
                currentPosition = organicIndex;
                currentPage = Math.ceil(organicIndex / 10);
            }
        }
    });

    return {
        currentPosition,
        currentPage,
        competitors: competitors.slice(0, 15), // Keep top 15 results
        lastChecked: new Date().toISOString()
    };
}
