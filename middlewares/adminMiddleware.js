const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "viyodha_super_secret_jwt_key_2026";

const adminMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Authorization header is missing. Please log in as admin.",
        });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization header format.",
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.payload = decoded.email;
        req.role = decoded.role;
        req.user = decoded;

        if (decoded.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin authorization required.",
            });
        }

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token. Please log in as admin again.",
        });
    }
};

module.exports = adminMiddleware;
