export interface ScrapedData {
    url: string;
    loadTime: number;
    statusCode: number;
    pageSize: number;
    wordCount: number;
    metaData: {
        title: string;
        description: string;
        canonical: string;
        robots: string;
        viewport: string;
        charset: string;
        ogTitle: string;
        ogDescription: string;
        ogImage: string;
        twitterCard: string;
    };
    headings: {
        h1: number;
        h2: number;
        h3: number;
        h4: number;
        h5: number;
        h6: number;
        h1Texts: string[];
    };
    links: {
        internal: number;
        external: number;
        total: number;
    };
    images: {
        total: number;
        missingAlt: number;
        withAlt: number;
    };
    keywords: { word: string; count: number; density: number }[];
    bodyText: string;
}

export interface AnalysisReport extends Omit<ScrapedData, 'bodyText'> {
    _id: string;
    status: string;
    overallScore: number;
    categories: {
        seo: number;
        performance: number;
        accessibility: number;
        bestPractices: number;
    };
    issues: {
        severity: "critical" | "warning" | "info";
        category: string;
        message: string;
        recommendation: string;
    }[];
    createdAt: string;
}

/**
 * Fetches the HTML content of a URL using a CORS proxy.
 */
export async function fetchPageHtml(url: string): Promise<{ html: string; loadTime: number; statusCode: number }> {
    // Standardize URL protocol
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
    }

    const startTime = Date.now();
    
    // Attempt 1: api.allorigins.win
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const data = await response.json();
            const loadTime = Date.now() - startTime;
            if (data.contents) {
                return {
                    html: data.contents,
                    loadTime,
                    statusCode: data.status?.http_code || 200,
                };
            }
        }
    } catch (e) {
        console.warn("AllOrigins proxy failed, trying corsproxy.io...", e);
    }

    // Attempt 2: corsproxy.io
    try {
        const fallbackProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(fallbackProxyUrl);
        if (response.ok) {
            const html = await response.text();
            const loadTime = Date.now() - startTime;
            return {
                html,
                loadTime,
                statusCode: 200,
            };
        }
    } catch (e) {
        console.warn("corsproxy.io failed, attempting direct fetch...", e);
    }

    // Attempt 3: Direct fetch (works if the site allows CORS)
    const directResponse = await fetch(targetUrl);
    if (!directResponse.ok) {
        throw new Error(`Failed to load website. Status code: ${directResponse.status}`);
    }
    const html = await directResponse.text();
    const loadTime = Date.now() - startTime;
    return {
        html,
        loadTime,
        statusCode: directResponse.status,
    };
}

/**
 * Parses raw HTML string and extracts SEO tags, headings, links, etc.
 */
export function parseHtmlContent(html: string, url: string, loadTime: number, statusCode: number): ScrapedData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Title
    const titleTag = doc.querySelector("title");
    const title = titleTag ? titleTag.textContent || "" : "";

    // Meta tags
    const descTag = doc.querySelector('meta[name="description"]');
    const description = descTag ? descTag.getAttribute("content") || "" : "";

    const canonicalTag = doc.querySelector('link[rel="canonical"]');
    const canonical = canonicalTag ? canonicalTag.getAttribute("href") || "" : "";

    const robotsTag = doc.querySelector('meta[name="robots"]');
    const robots = robotsTag ? robotsTag.getAttribute("content") || "" : "";

    const viewportTag = doc.querySelector('meta[name="viewport"]');
    const viewport = viewportTag ? viewportTag.getAttribute("content") || "" : "";

    // Charset detection
    let charset = "";
    const charsetTag = doc.querySelector('meta[charset]');
    if (charsetTag) {
        charset = charsetTag.getAttribute("charset") || "";
    } else {
        const contentCharset = doc.querySelector('meta[http-equiv="Content-Type"]');
        if (contentCharset) {
            const content = contentCharset.getAttribute("content") || "";
            const match = content.match(/charset=([a-zA-Z0-9-]+)/i);
            if (match) charset = match[1];
        }
    }

    // OpenGraph and Twitter Cards
    const ogTitleTag = doc.querySelector('meta[property="og:title"]');
    const ogTitle = ogTitleTag ? ogTitleTag.getAttribute("content") || "" : "";

    const ogDescTag = doc.querySelector('meta[property="og:description"]');
    const ogDescription = ogDescTag ? ogDescTag.getAttribute("content") || "" : "";

    const ogImageTag = doc.querySelector('meta[property="og:image"]');
    const ogImage = ogImageTag ? ogImageTag.getAttribute("content") || "" : "";

    const twitterCardTag = doc.querySelector('meta[name="twitter:card"]');
    const twitterCard = twitterCardTag ? twitterCardTag.getAttribute("content") || "" : "";

    // Headings
    const h1s = Array.from(doc.querySelectorAll("h1"));
    const h2s = doc.querySelectorAll("h2");
    const h3s = doc.querySelectorAll("h3");
    const h4s = doc.querySelectorAll("h4");
    const h5s = doc.querySelectorAll("h5");
    const h6s = doc.querySelectorAll("h6");

    const headings = {
        h1: h1s.length,
        h2: h2s.length,
        h3: h3s.length,
        h4: h4s.length,
        h5: h5s.length,
        h6: h6s.length,
        h1Texts: h1s.map(h => h.textContent?.trim() || "").filter(Boolean)
    };

    // Internal/External Links
    const allLinks = Array.from(doc.querySelectorAll("a[href]"));
    let internal = 0;
    let external = 0;
    const total = allLinks.length;

    let targetHostname = "";
    try {
        const parsedUrl = new URL(url.startsWith("http") ? url : "https://" + url);
        targetHostname = parsedUrl.hostname.replace("www.", "");
    } catch {
        targetHostname = "";
    }

    allLinks.forEach(link => {
        const href = (link.getAttribute("href") || "").trim();
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

        if (href.startsWith("/") || href.startsWith(".") || (targetHostname && href.includes(targetHostname))) {
            internal++;
        } else if (href.startsWith("http")) {
            external++;
        } else {
            internal++; // Relative links like "about.html"
        }
    });

    // Images alt attributes
    const allImages = Array.from(doc.querySelectorAll("img"));
    const imgTotal = allImages.length;
    let missingAlt = 0;
    let withAlt = 0;

    allImages.forEach(img => {
        const alt = img.getAttribute("alt");
        if (alt === null || alt.trim() === "") {
            missingAlt++;
        } else {
            withAlt++;
        }
    });

    // Word count calculation
    const bodyText = doc.body ? doc.body.textContent || "" : "";
    const cleanBodyText = bodyText.replace(/\s+/g, " ").trim();
    const words = cleanBodyText.split(/\s+/).filter(w => w.length > 1);
    const wordCount = words.length;

    // Extract Keywords
    const stopWords = new Set([
        "the", "and", "a", "of", "to", "in", "is", "that", "it", "on", "for", "as", "with", "this", "our", "your",
        "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "but", "if", "or",
        "because", "as", "until", "while", "at", "by", "about", "into", "through", "after", "before", "above", "below",
        "from", "up", "down", "in", "out", "over", "under", "again", "further", "then", "once", "here", "there",
        "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "should", "now"
    ]);

    const wordFreq: Record<string, number> = {};
    words.forEach(w => {
        const cleanWord = w.toLowerCase().replace(/[^a-zA-Z0-9-]/g, "");
        if (cleanWord.length > 2 && !stopWords.has(cleanWord) && isNaN(Number(cleanWord))) {
            wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
        }
    });

    const sortedKeywords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({
            word,
            count,
            density: parseFloat(((count / Math.max(wordCount, 1)) * 100).toFixed(2))
        }));

    return {
        url,
        loadTime,
        statusCode,
        pageSize: html.length,
        wordCount,
        metaData: {
            title,
            description,
            canonical,
            robots,
            viewport,
            charset,
            ogTitle,
            ogDescription,
            ogImage,
            twitterCard
        },
        headings,
        links: {
            internal,
            external,
            total
        },
        images: {
            total: imgTotal,
            missingAlt,
            withAlt
        },
        keywords: sortedKeywords,
        bodyText: cleanBodyText.slice(0, 3000)
    };
}

/**
 * Calculates score metrics and generates issues checklist.
 */
export function generateAnalysisReport(scrapedData: ScrapedData, reportId?: string): AnalysisReport {
    const issues: AnalysisReport["issues"] = [];
    
    // 1. SEO Category Score Calculation
    let seoScore = 100;
    if (!scrapedData.metaData.title) {
        seoScore -= 30;
        issues.push({
            severity: "critical",
            category: "SEO",
            message: "Missing title tag.",
            recommendation: "Add a descriptive <title> tag (50-60 characters) to identify the page content."
        });
    } else {
        const titleLen = scrapedData.metaData.title.length;
        if (titleLen < 30 || titleLen > 65) {
            seoScore -= 10;
            issues.push({
                severity: "warning",
                category: "SEO",
                message: `Title length is ${titleLen} characters. It should ideally be between 50-60 characters.`,
                recommendation: "Adjust title length to prevent truncation in search result snippets."
            });
        }
    }

    if (!scrapedData.metaData.description) {
        seoScore -= 25;
        issues.push({
            severity: "critical",
            category: "SEO",
            message: "Missing meta description.",
            recommendation: "Add a <meta name=\"description\"> tag to summarize your page in search results."
        });
    } else {
        const descLen = scrapedData.metaData.description.length;
        if (descLen < 120 || descLen > 165) {
            seoScore -= 8;
            issues.push({
                severity: "warning",
                category: "SEO",
                message: `Meta description length is ${descLen} characters (optimal: 150-160 characters).`,
                recommendation: "Adjust the length to give users a clean, comprehensive summary of your page."
            });
        }
    }

    if (!scrapedData.metaData.canonical) {
        seoScore -= 10;
        issues.push({
            severity: "warning",
            category: "SEO",
            message: "Missing canonical link tag.",
            recommendation: "Add a <link rel=\"canonical\" href=\"...\"> to define the original version and prevent duplicate content issues."
        });
    }

    if (scrapedData.headings.h1 === 0) {
        seoScore -= 15;
        issues.push({
            severity: "critical",
            category: "SEO",
            message: "Missing H1 heading.",
            recommendation: "Add one H1 heading representing the primary topic of the page."
        });
    } else if (scrapedData.headings.h1 > 1) {
        seoScore -= 10;
        issues.push({
            severity: "warning",
            category: "SEO",
            message: `Found ${scrapedData.headings.h1} H1 tags.`,
            recommendation: "Restructure headings to use exactly one H1 tag per page to maintain clear hierarchy."
        });
    }

    if (scrapedData.wordCount < 250) {
        seoScore -= 10;
        issues.push({
            severity: "warning",
            category: "SEO",
            message: `Low word count (${scrapedData.wordCount} words).`,
            recommendation: "Add more descriptive text content to the page (minimum 300 words recommended) for better indexability."
        });
    }

    // 2. Performance Category Score Calculation
    let performanceScore = 100;
    const loadTimeSec = scrapedData.loadTime / 1000;
    if (scrapedData.loadTime > 5000) {
        performanceScore -= 40;
        issues.push({
            severity: "critical",
            category: "Performance",
            message: `Very slow load time (${loadTimeSec.toFixed(2)}s).`,
            recommendation: "Compress resources, minify scripts, optimize loading, and use CDNs to lower speed under 3 seconds."
        });
    } else if (scrapedData.loadTime > 3000) {
        performanceScore -= 20;
        issues.push({
            severity: "warning",
            category: "Performance",
            message: `Average page load time (${loadTimeSec.toFixed(2)}s).`,
            recommendation: "Ensure browser assets are cached, images are properly sized, and scripts are optimized."
        });
    }

    const pageSizeKb = scrapedData.pageSize / 1024;
    if (pageSizeKb > 2500) {
        performanceScore -= 20;
        issues.push({
            severity: "warning",
            category: "Performance",
            message: `Large page size (${(pageSizeKb / 1024).toFixed(2)}MB).`,
            recommendation: "Reduce HTML size, compress resources, and bundle scripts to keep size under 2.5MB."
        });
    }

    // 3. Accessibility Category Score Calculation
    let accessibilityScore = 100;
    if (scrapedData.images.missingAlt > 0) {
        const penalty = Math.min(35, scrapedData.images.missingAlt * 6);
        accessibilityScore -= penalty;
        issues.push({
            severity: "critical",
            category: "Accessibility",
            message: `${scrapedData.images.missingAlt} of ${scrapedData.images.total} images are missing alt text tags.`,
            recommendation: "Add description text in the alt attributes of all images to support screen readers and image crawlers."
        });
    }

    if (!scrapedData.metaData.viewport) {
        accessibilityScore -= 25;
        issues.push({
            severity: "critical",
            category: "Accessibility",
            message: "Missing viewport configuration tag.",
            recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to ensure proper rendering on mobile screens."
        });
    }

    // 4. Best Practices Score Calculation
    let bestPracticesScore = 100;
    if (!scrapedData.metaData.charset) {
        bestPracticesScore -= 20;
        issues.push({
            severity: "critical",
            category: "Best Practices",
            message: "Missing character encoding declaration.",
            recommendation: "Add <meta charset=\"utf-8\"> inside the <head> to prevent browser display bugs."
        });
    }

    if (!scrapedData.metaData.ogTitle && !scrapedData.metaData.ogDescription) {
        bestPracticesScore -= 15;
        issues.push({
            severity: "warning",
            category: "Best Practices",
            message: "Missing OpenGraph meta tags.",
            recommendation: "Add og:title and og:description tags to optimize sharing links on social media platforms."
        });
    }

    if (!scrapedData.metaData.twitterCard) {
        bestPracticesScore -= 10;
        issues.push({
            severity: "info",
            category: "Best Practices",
            message: "Missing Twitter Card meta tags.",
            recommendation: "Add a twitter:card meta tag to optimize link sharing on Twitter."
        });
    }

    if (scrapedData.links.total > 0 && scrapedData.links.external === 0) {
        bestPracticesScore -= 10;
        issues.push({
            severity: "info",
            category: "Best Practices",
            message: "No external outbound links found.",
            recommendation: "Incorporate outgoing references to high-authority external sites to establish trust and context."
        });
    }

    // Boundaries
    seoScore = Math.max(0, seoScore);
    performanceScore = Math.max(0, performanceScore);
    accessibilityScore = Math.max(0, accessibilityScore);
    bestPracticesScore = Math.max(0, bestPracticesScore);

    const overallScore = Math.round(
        (seoScore * 0.40) +
        (performanceScore * 0.25) +
        (accessibilityScore * 0.20) +
        (bestPracticesScore * 0.15)
    );

    // Sort issues by severity
    const severityMap = { critical: 0, warning: 1, info: 2 };
    issues.sort((a, b) => severityMap[a.severity] - severityMap[b.severity]);

    const finalId = reportId || Math.random().toString(36).substring(2, 10);

    // Remove bodyText from return structure to keep storage clean
    const { bodyText, ...rest } = scrapedData;
    void bodyText; // mark as used

    return {
        ...rest,
        _id: finalId,
        status: "completed",
        overallScore,
        categories: {
            seo: seoScore,
            performance: performanceScore,
            accessibility: accessibilityScore,
            bestPractices: bestPracticesScore
        },
        issues,
        createdAt: new Date().toISOString()
    };
}
