const express = require('express');
const scrapeController = require('../controllers/scrape.controller');
const autoScrapeController = require('../controllers/autoScrape.controller');
const sitemapController = require('../controllers/sitemap.controller');
const authenticateRequest = require('../middlewares/auth.middleware');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use(authenticateRequest);

router.post('/scrapes/trigger', scrapeController.triggerScrape);
router.get('/scrapes/status/:jobId', scrapeController.getJobStatus);
router.get('/sitemaps', sitemapController.listSitemaps);

// Auto-scraping management routes
router.post('/auto-scrape/enable', autoScrapeController.enableAutoScrape);
router.post('/auto-scrape/disable', autoScrapeController.disableAutoScrape);
router.post('/auto-scrape/bulk-enable', autoScrapeController.bulkEnableAutoScrape);
router.get('/auto-scrape/status', autoScrapeController.getAutoScrapeStatus);

router.use('/pivot', require('./pivot.routes'));

module.exports = router;
