require('dotenv').config()
const express = require('express')
const cors = require('cors')

// Start background jobs
require('./jobs/pollScraperStatus.job')
require('./jobs/weeklyAutoScrape.job')

const routes = require('./routes')

const app = express()

const normalizeOrigin = (value) => value.trim().replace(/\/+$/, '')

const corsOriginConfig = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || ''
const parsedOrigins = corsOriginConfig
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean)
const allowAllOrigins = parsedOrigins.length === 0 || parsedOrigins.includes('*')
const allowedOrigins = parsedOrigins.filter((origin) => origin !== '*')

// ======================
// ✅ CORS (FIXED)
// ======================
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin) and configured frontend origins.
    if (!origin || allowAllOrigins) return callback(null, true)

    const requestOrigin = normalizeOrigin(origin)
    if (allowedOrigins.includes(requestOrigin)) return callback(null, true)

    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
