/**
 * Google Search Rank Scraper Module
 *
 * Implements the architecture requirements for scraping Google organic search rankings:
 * 1. Depersonalization (&pws=0)
 * 2. Macro-Localization (&gl= and &hl=)
 * 3. Micro-Localization via base64 encoded &uule=
 * 4. Pagination engine (sequentially calling pages via &start=0, 10, 20)
 * 5. Evasion tactics (rotating User-Agents, random delays between 3.5s and 8.2s)
 * 6. DOM parsing for organic rank, title, and URL
 * 
 * Provides both Browser-compatible (CORS proxy) and Node.js-compatible implementations
 * to support both direct client testing and the target backend worker architecture.
 */

import { getDomainName } from "./rankChecker";

export interface GoogleScrapeOptions {
  keyword: string;
  countryCode?: string;  // e.g., "us", "uk", "in"
  languageCode?: string; // e.g., "en", "es", "fr"
  locationName?: string; // e.g., "New York,New York,United States"
  maxPages?: number;     // Number of pages to scrape (each page has ~10 results)
}

export interface GoogleOrganicResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface GoogleScrapedRankReport {
  currentPosition: number | null;
  currentPage: number | null;
  results: GoogleOrganicResult[];
  lastChecked: string;
}

/**
 * List of modern desktop user agents for rotation
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
];

/**
 * Encodes a location name into the base64 formatted Google UULE parameter.
 * Used for micro-localization (city-level search results).
 */
export function generateUule(locationName: string): string {
  const canonicalName = locationName.trim();
  const len = canonicalName.length;

  // Secret table for UULE length encoding
  const secretTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  if (len >= secretTable.length) {
    throw new Error(`Location "${canonicalName}" is too long for UULE (max ${secretTable.length - 1} characters).`);
  }

  const lengthChar = secretTable[len];

  // Base64 encoding compatible with both browser (window.btoa) and Node.js (Buffer)
  let base64Encoded: string;
  const globalObj = globalThis as unknown as { Buffer?: { from: (str: string) => { toString: (enc: string) => string } } };
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    base64Encoded = window.btoa(unescape(encodeURIComponent(canonicalName)));
  } else if (globalObj.Buffer) {
    base64Encoded = globalObj.Buffer.from(canonicalName).toString("base64");
  } else {
    throw new Error("Base64 encoder is missing from execution environment.");
  }

  return `w+CAIQICI${lengthChar}${base64Encoded}`;
}

/**
 * Returns a random User-Agent from the rotated list.
 */
export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

/**
 * Helper to generate a randomized delay between 3.5 and 8.2 seconds (in ms)
 */
export function getRandomDelayMs(): number {
  const min = 3500;
  const max = 8200;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep helper
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Construct the complete Google Search URL with evasion/targeting parameters.
 */
export function buildGoogleUrl(options: GoogleScrapeOptions, startOffset: number): string {
  const baseUrl = "https://www.google.com/search";
  const params = new URLSearchParams({
    q: options.keyword.trim(),
    pws: "0", // Depersonalization
    start: startOffset.toString(),
  });

  // Macro-localization (Country)
  if (options.countryCode) {
    params.append("gl", options.countryCode.toLowerCase().trim());
  }

  // Macro-localization (Language)
  if (options.languageCode) {
    params.append("hl", options.languageCode.toLowerCase().trim());
  }

  // Micro-localization (Exact City-Level)
  if (options.locationName) {
    params.append("uule", generateUule(options.locationName));
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * =========================================================================
 * BROWSER-COMPATIBLE SCOPE (Uses CORS Proxy & DOMParser)
 * Perfect for frontend integration, direct demonstration, and dev testing.
 * =========================================================================
 */
export async function fetchGoogleHtmlBrowser(url: string): Promise<string> {
  // Try proxies to bypass CORS errors in client-side environment
  const errors: Error[] = [];

  // Attempt 1: corsproxy.io
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (response.ok) {
      return await response.text();
    }
    throw new Error(`corsproxy.io returned status ${response.status}`);
  } catch (err) {
    console.warn("corsproxy.io failed: ", err);
    errors.push(err instanceof Error ? err : new Error(String(err)));
  }

  // Attempt 2: api.allorigins.win
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.contents) {
        return data.contents;
      }
    }
    throw new Error(`allorigins returned status ${response.status}`);
  } catch (err) {
    console.warn("allorigins failed: ", err);
    errors.push(err instanceof Error ? err : new Error(String(err)));
  }

  throw new Error(`Failed to bypass CORS proxies. Errors: ${errors.map((e) => e.message).join(", ")}`);
}

/**
 * Browser-side DOM Parser using DOMParser API.
 */
export function parseGoogleHtmlBrowser(html: string, startIndex: number): GoogleOrganicResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Google checks if client was blocked
  if (doc.title.includes("Error 403") || doc.title.includes("Captcha") || html.includes("detected unusual traffic")) {
    throw new Error("Rate limit / Captcha block triggered (HTTP 429 / 403).");
  }

  // Organic result selector containers: typically div.g, div.MjjYpe, or div.tF2Cee
  const organicContainers = Array.from(doc.querySelectorAll("div.g, div.MjjYpe, div.tF2Cee"));
  const pageResults: GoogleOrganicResult[] = [];
  let index = startIndex;

  organicContainers.forEach((container) => {
    // Locate title element (always wrapped in h3 in modern Google layout)
    const h3 = container.querySelector("h3");
    if (!h3) return;

    // Find the enclosing hyperlink
    const anchor = h3.closest("a") || container.querySelector("a[href]");
    if (!anchor) return;

    const href = anchor.getAttribute("href") || "";
    // Filter out internal Google links or invalid links
    if (!href || href.startsWith("/") || href.includes("google.com/")) return;

    // Extract title, url, domain, snippet
    const title = h3.textContent?.trim() || "";
    const url = href.trim();
    const domain = getDomainName(url);

    // Modern snippet classes: .VwiC3b, .yD4Z1c, .MUxGacf
    const snippetEl = container.querySelector(".VwiC3b, .yD4Z1c, .MUxGacf, .BNeawe");
    const snippet = snippetEl ? snippetEl.textContent?.trim() || "" : "";

    // Evade double indexing (Google often nests sub-results or people-also-ask in .g elements)
    if (pageResults.some((r) => r.url === url)) return;

    index++;
    pageResults.push({
      position: index,
      title,
      url,
      domain,
      snippet,
    });
  });

  // Google changes layouts or starts returning minimal pages under bot detection / cookie pages
  if (pageResults.length === 0) {
    const anchors = Array.from(doc.querySelectorAll("div.kCrYT a, div.egMi0 a, a"));
    anchors.forEach((anchor) => {
      let href = anchor.getAttribute("href") || "";
      if (!href) return;

      if (href.startsWith("/url?q=")) {
        try {
          const urlObj = new URL("https://google.com" + href);
          href = urlObj.searchParams.get("q") || href;
        } catch (e) {
          void e;
        }
      }

      if (!href || href.startsWith("/") || href.includes("google.com/") || href.includes("google.com/search") || href.includes("youtube.com/")) return;
      const url = href.trim();
      const domain = getDomainName(url);

      const title = anchor.querySelector("h3")?.textContent?.trim() || anchor.textContent?.trim() || domain;

      if (pageResults.some((r) => r.url === url)) return;

      index++;
      pageResults.push({
        position: index,
        title: title.slice(0, 100),
        url,
        domain,
        snippet: "",
      });
    });
  }

  return pageResults;
}

/**
 * Scrapes Google Organic Search rankings inside the browser using CORS proxies.
 */
export async function checkGoogleRankBrowser(
  options: GoogleScrapeOptions,
  targetUrl: string
): Promise<GoogleScrapedRankReport> {
  const targetDomain = getDomainName(targetUrl).toLowerCase();
  const maxPages = options.maxPages || 5; // Search top 5 pages by default (50 rankings)
  let allResults: GoogleOrganicResult[] = [];
  let currentPosition: number | null = null;
  let currentPage: number | null = null;

  let pageNum = 1;
  let startOffset = 0;

  while (pageNum <= maxPages) {
    const url = buildGoogleUrl(options, startOffset);
    console.log(`Scraping Google Page ${pageNum} via CORS proxy... Url: ${url}`);

    try {
      const html = await fetchGoogleHtmlBrowser(url);
      const pageResults = parseGoogleHtmlBrowser(html, allResults.length);

      if (pageResults.length === 0) {
        console.log("No organic results found on this page. Stopping traversal.");
        break; // Stop if no results are returned (e.g. end of index or parsing block)
      }

      allResults = [...allResults, ...pageResults];

      // Check if target website is in this page's results
      const match = pageResults.find((r) => r.domain.toLowerCase() === targetDomain);
      if (match && currentPosition === null) {
        currentPosition = match.position;
        currentPage = pageNum;
        console.log(`Found target domain at rank #${currentPosition} (Page ${currentPage})`);
      }

      startOffset += 10;
      pageNum++;

      // Apply evasion delay between pagination fetches
      if (pageNum <= maxPages) {
        const delay = getRandomDelayMs();
        console.log(`Applying evasion delay: ${(delay / 1000).toFixed(2)}s before next request...`);
        await sleep(delay);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error scraping Google page ${pageNum}:`, err);
      if (err.message && err.message.includes("Rate limit")) {
        throw new Error("Google blocked the request due to temporary rate limits. Please try again later.", { cause: error });
      }
      throw err;
    }
  }

  return {
    currentPosition,
    currentPage,
    results: allResults.slice(0, 50), // Return top 50 rankings
    lastChecked: new Date().toISOString(),
  };
}

/**
 * =========================================================================
 * BACKEND NODE.JS-COMPATIBLE WORKER ARCHITECTURE
 * Expressed below in pure Node.js TS style.
 * Copy-paste this implementation into your server-side worker node.
 * Requires: npm install axios cheerio
 * =========================================================================
 */
export const NODE_JS_SCRAPER_SOURCE = `
import axios from "axios";
import * as cheerio from "cheerio";
import { getDomainName } from "./rankChecker"; // or custom utility

export async function scrapeGoogleRankingsNode(
  options: GoogleScrapeOptions,
  targetUrl: string,
  proxyConfig?: any // Optional proxy integration for backend worker
): Promise<GoogleScrapedRankReport> {
  const targetDomain = getDomainName(targetUrl).toLowerCase();
  const maxPages = options.maxPages || 5;
  let allResults: GoogleOrganicResult[] = [];
  let currentPosition: number | null = null;
  let currentPage: number | null = null;

  let pageNum = 1;
  let startOffset = 0;

  while (pageNum <= maxPages) {
    const url = buildGoogleUrl(options, startOffset);
    const userAgent = getRandomUserAgent();
    
    console.log(\`[Worker] Fetching Page \${pageNum} with User-Agent: \${userAgent}\`);

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": options.languageCode ? \`\${options.languageCode},en;q=0.5\` : "en-US,en;q=0.5",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        },
        proxy: proxyConfig, // Backend Proxy Manager hooks in here
        timeout: 10000
      });

      if (response.status === 429) {
        throw new Error("HTTP 429: Rate Limit Exceeded");
      }

      const html = response.data;
      const $ = cheerio.load(html);

      // Check for CAPTCHA/Blocks
      if ($("title").text().includes("Captcha") || html.includes("detected unusual traffic")) {
        throw new Error("CAPTCHA block triggered");
      }

      const pageResults: GoogleOrganicResult[] = [];
      let index = allResults.length;

      // Extract results using Cheerio
      $("div.g, div.MjjYpe, div.tF2Cee").each((_, element) => {
        const h3 = $(element).find("h3");
        if (h3.length === 0) return;

        const anchor = h3.closest("a").length > 0 ? h3.closest("a") : $(element).find("a[href]");
        if (anchor.length === 0) return;

        const href = anchor.attr("href") || "";
        if (!href || href.startsWith("/") || href.includes("google.com/")) return;

        const title = h3.text().trim();
        const url = href.trim();
        const domain = getDomainName(url);
        
        // Target modern Google description snippet blocks
        const snippet = $(element).find(".VwiC3b, .yD4Z1c, .MUxGacf, .BNeawe").text().trim();

        if (pageResults.some(r => r.url === url)) return;

        index++;
        pageResults.push({
          position: index,
          title,
          url,
          domain,
          snippet
        });
      });

      // Google changes layouts or starts returning minimal pages under bot detection / cookie pages
      if (pageResults.length === 0) {
        $("div.kCrYT a, div.egMi0 a, a").each((_, element) => {
          let href = $(element).attr("href") || "";
          if (!href) return;

          if (href.startsWith("/url?q=")) {
            try {
              const urlObj = new URL("https://google.com" + href);
              href = urlObj.searchParams.get("q") || href;
            } catch {}
          }

          if (!href || href.startsWith("/") || href.includes("google.com/") || href.includes("google.com/search") || href.includes("youtube.com/")) return;
          const urlStr = href.trim();
          const domain = getDomainName(urlStr);

          let title = $(element).find("h3").text().trim() || $(element).text().trim() || domain;

          if (pageResults.some(r => r.url === urlStr)) return;

          index++;
          pageResults.push({
            position: index,
            title: title.slice(0, 100),
            url: urlStr,
            domain,
            snippet: ""
          });
        });
      }

      if (pageResults.length === 0) {
        console.log("[Worker] No more rankings parsed. Exiting pagination loop.");
        break;
      }

      allResults = [...allResults, ...pageResults];

      // Check matches
      const match = pageResults.find(r => r.domain.toLowerCase() === targetDomain);
      if (match && currentPosition === null) {
        currentPosition = match.position;
        currentPage = pageNum;
      }

      startOffset += 10;
      pageNum++;

      if (pageNum <= maxPages) {
        const delay = getRandomDelayMs();
        console.log(\`[Worker] Evasion Sleep: \${(delay/1000).toFixed(2)}s\`);
        await sleep(delay);
      }
    } catch (err: any) {
      console.error(\`[Worker] Error scraping page \${pageNum}:\`, err.message);
      if (err.response?.status === 429) {
        throw new Error("Google API Rate Limit Exceeded (HTTP 429). Proxy rotation required.");
      }
      throw err;
    }
  }

  return {
    currentPosition,
    currentPage,
    results: allResults.slice(0, 50),
    lastChecked: new Date().toISOString()
  };
}
`;
