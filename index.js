require('dotenv').config();
require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes/allRoutes');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();

// 1. Security Headers via Helmet
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: false,
    })
);

// 2. CORS configuration (allows all origins, localhost, dev servers, tunnels)
app.use(
    cors({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Bypass-Tunnel-Reminder",
            "bypass-tunnel-reminder",
        ],
    })
);

// 3. Body parsers with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate Limiting protection
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes.",
    },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again after 15 minutes.",
    },
});

app.use("/login", authLimiter);
app.use("/register", authLimiter);
app.use(apiLimiter);

// 5. Routes and Static uploads
app.use(routes);
app.use('/uploads', express.static(uploadDir));

// Health / Status check
app.get('/', (req, res) => {
    res.status(200).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #1F4D1F;">Viyodha Spices API Server Running</h1>
            <p style="color: #555;">Nurture • Grow • Thrive</p>
            <p>Database connected & ready for requests.</p>
        </div>
    `);
});

// 6. Global sanitized error handler
app.use((err, req, res, next) => {
    console.error("Viyodha Server uncaught error:", err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

const PORT = parseInt(process.env.PORT, 10) || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Viyodha backend started on port ${PORT}... Ready for client requests!`);
});
