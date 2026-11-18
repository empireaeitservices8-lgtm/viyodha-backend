const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "viyodha_super_secret_jwt_key_2026";

// Register user
exports.registerController = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;

        if (!username || !email || !password || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: "Username, email, password, and phone number are all required." 
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        const [existing] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
        if (existing.length > 0) {
            return res.status(409).json({ 
                success: false,
                message: "An account with this email already exists. Please sign in." 
            });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            "INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, 'user')",
            [username.trim(), normalizedEmail, encryptedPassword, phone.trim()]
        );

        const newUser = {
            id: result.insertId,
            username: username.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            role: "user"
        };

        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: newUser,
            token
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error during registration.", 
            error: error.message 
        });
    }
};

// User & Admin login
exports.loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required." 
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);

        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: "No account found with this email. Please check your credentials or register." 
            });
        }

        const user = rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({ 
                success: false,
                message: "Incorrect password. Please try again." 
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                role: user.role,
                created_at: user.created_at
            },
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error during login.", 
            error: error.message 
        });
    }
};

// Get profile (User or Admin)
exports.getMyProfileController = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, username, email, phone, role, created_at FROM users WHERE email = ? LIMIT 1",
            [req.payload]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        return res.status(200).json({
            success: true,
            user: rows[0],
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile.",
            error: error.message,
        });
    }
};

// Update profile (User or Admin)
exports.updateMyProfileController = async (req, res) => {
    try {
        const {
            username,
            email,
            phone,
            currentPassword,
            newPassword,
        } = req.body;

        const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [req.payload]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        const user = rows[0];

        if (
            typeof username !== "string" || !username.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof phone !== "string" || !phone.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Username, email, and phone are required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if new email is used by another account
        const [existing] = await pool.query(
            "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
            [normalizedEmail, user.id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email is already in use by another account.",
            });
        }

        let updatedPassword = user.password;

        if (newPassword && newPassword.trim() !== "") {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter your current password to set a new password.",
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 6 characters long.",
                });
            }

            const passwordMatches = await bcrypt.compare(currentPassword, user.password);
            if (!passwordMatches) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect.",
                });
            }

            updatedPassword = await bcrypt.hash(newPassword, 10);
        }

        await pool.query(
            "UPDATE users SET username = ?, email = ?, phone = ?, password = ? WHERE id = ?",
            [username.trim(), normalizedEmail, phone.trim(), updatedPassword, user.id]
        );

        // Issue new token with updated email
        const token = jwt.sign(
            { id: user.id, email: normalizedEmail, role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        const safeUser = {
            id: user.id,
            username: username.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            role: user.role,
        };

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: safeUser,
            token,
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
            error: error.message,
        });
    }
};

// Admin: Get all users
exports.getAllUsersController = async (req, res) => {
    try {
        const [users] = await pool.query(
            "SELECT id, username, email, phone, role, created_at, updated_at FROM users ORDER BY id DESC"
        );

        return res.status(200).json({
            success: true,
            users,
        });
    } catch (error) {
        console.error("Get all users error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users.",
            error: error.message,
        });
    }
};

// Admin: Delete user
exports.deleteUserController = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        const user = rows[0];
        if (user.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin accounts cannot be deleted.",
            });
        }

        await pool.query("DELETE FROM users WHERE id = ?", [id]);

        return res.status(200).json({
            success: true,
            message: "User account deleted successfully.",
        });
    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete user.",
            error: error.message,
        });
    }
};
