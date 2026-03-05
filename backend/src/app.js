require('dotenv').config()
const express = require('express')
const cors = require('cors')

// Start background jobs
require('./jobs/pollScraperStatus.job')
require('./jobs/weeklyAutoScrape.job')

const routes = require('./routes')

const app = express()

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// ======================
// ✅ CORS (FIXED)
// ======================
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin) and configured frontend origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ======================
// Middleware
// ======================
app.use(express.json({ limit: '10mb' }))

// ======================
// Routes
// ======================
app.use('/api', routes)

// ======================
// Health check
// ======================
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

module.exports = app
