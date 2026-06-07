import { checkGoogleRankBrowser } from "./googleScraper";

export async function runScraperTest(keyword: string, targetUrl: string, country = "us", language = "en") {
  console.log(`=== STARTING GOOGLE SCRAPER TEST ===`);
  console.log(`Keyword: "${keyword}"`);
  console.log(`Target Domain: "${targetUrl}"`);
  console.log(`Localization: Country=${country}, Language=${language}`);

  const startTime = Date.now();
  try {
    const report = await checkGoogleRankBrowser({
      keyword,
      countryCode: country,
      languageCode: language,
      maxPages: 2 // Keep it small to run quickly and avoid rate limiting
    }, targetUrl);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`=== TEST SUCCESSFUL (${elapsed}s) ===`);
    console.log(`Rank: ${report.currentPosition ? `#${report.currentPosition}` : "Not ranked in top 20 results"}`);
    console.log(`Page: ${report.currentPage || "N/A"}`);
    console.log(`Total Organic Results Parsed: ${report.results.length}`);
    
    if (report.results.length > 0) {
      console.log("\nTop 5 Results Sample:");
      report.results.slice(0, 5).forEach((r) => {
        console.log(`  [Rank #${r.position}] Title: "${r.title}"`);
        console.log(`               Domain: ${r.domain}`);
        console.log(`               URL:    ${r.url}`);
        console.log(`               Snippet: ${r.snippet.slice(0, 80)}...`);
      });
    }

    return {
      success: true,
      elapsedSeconds: parseFloat(elapsed),
      ...report
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("=== TEST FAILED ===");
    console.error(err);
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}
