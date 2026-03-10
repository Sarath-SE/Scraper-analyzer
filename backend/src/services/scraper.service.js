const { Client } = require("@webscraperio/api-client-nodejs");
const axios = require("axios");
const dotenv = require('dotenv');
dotenv.config();

let client = null;


function getClient() {
  if (!client) {
    if (!process.env.WEBSCRAPER_TOKEN) {
      throw new Error("WEBSCRAPER_TOKEN is not set");
    }

    client = new Client({
      token: process.env.WEBSCRAPER_TOKEN,
      useBackoffSleep: true
    });
  }
  return client;
}

/**
 * Start a scraping job
 */
exports.startScrape = async (sitemapId, options = {}) => {
  const config = {
    sitemap_id: parseInt(sitemapId),
    driver: "fulljs",
    proxy: "datacenter-us",
    request_interval: 2000,
    page_load_delay: 2000,
    ...options
  };

  const client = getClient();
  const res = await client.createScrapingJob(config);

  if (!res || !res.id) {
    throw new Error("Invalid response from WebScraper");
  }

  return res.id;
};

/**
 * Check job status
 */
exports.getJobStatus = async (jobId) => {
  const client = getClient();
  const res = await client.getScrapingJob(jobId);

  if (!res || !res.status) {
    throw new Error("Invalid scraping job response");
  }

  return res.status; // running | finished | failed
};

/**
 * Download scraped data (JSONL)
 */
exports.getScrapedData = async (jobId) => {
  const url = `${process.env.SCRAPER_BASE_URL}/v1/scraping-job/${jobId}/json?api_token=${process.env.WEBSCRAPER_TOKEN}`;

  const response = await axios.get(url, {
    responseType: "text",
    timeout: 60000
  });

  
  const raw = response.data;

  console.log("scraper json=====", raw);
  

  if (!raw || raw.trim().length === 0) return [];

  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

/**
 * Fetch sitemap metadata (name) from WebScraper.
 */
exports.getSitemapMetadata = async (sitemapId) => {
  const parsedId = parseInt(sitemapId, 10);
  if (Number.isNaN(parsedId)) {
    throw new Error('Invalid sitemap id');
  }

  const client = getClient();
  const res = await client.getSitemap(parsedId);

  if (!res || typeof res.name !== 'string') {
    throw new Error('Invalid sitemap metadata response');
  }

  return {
    name: res.name.trim() || null
  };
};
