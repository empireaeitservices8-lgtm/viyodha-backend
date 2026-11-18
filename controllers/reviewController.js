const pool = require("../config/db");

// Add review for product
exports.addReviewController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const { productId, rating, comment } = req.body;

        if (!productId || rating === undefined || !comment) {
            return res.status(400).json({
                success: false,
                message: "Product ID, rating, and comment are required.",
            });
        }

        const numRating = parseInt(rating, 10);
        if (isNaN(numRating) || numRating < 1 || numRating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be a number between 1 and 5.",
            });
        }

        // Check product exists (by id or slug)
        const [products] = await pool.query(
            "SELECT id FROM products WHERE id = ? OR slug = ? LIMIT 1",
            [productId, productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        const actualProductId = products[0].id;

        // Fetch user name
        const [users] = await pool.query("SELECT username FROM users WHERE email = ? LIMIT 1", [userEmail]);
        const username = users.length > 0 ? users[0].username : userEmail.split("@")[0];

        const [result] = await pool.query(
            "INSERT INTO reviews (product_id, user_email, username, rating, comment) VALUES (?, ?, ?, ?, ?)",
            [actualProductId, userEmail, username, numRating, comment.trim()]
        );

        const [newReview] = await pool.query("SELECT * FROM reviews WHERE id = ?", [result.insertId]);

        return res.status(201).json({
            success: true,
            message: "Review added successfully.",
            review: newReview[0],
        });
    } catch (error) {
        console.error("Add review error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add review.",
            error: error.message,
        });
    }
};

// Get reviews for a specific product
exports.getProductReviewsController = async (req, res) => {
    try {
        const { productId } = req.params;

        // Resolve product id if slug was passed
        let targetId = productId;
        const [products] = await pool.query("SELECT id FROM products WHERE id = ? OR slug = ? LIMIT 1", [productId, productId]);
        if (products.length > 0) {
            targetId = products[0].id;
        }

        const [reviews] = await pool.query(
            "SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC",
            [targetId]
        );

        return res.status(200).json(reviews);
    } catch (error) {
        console.error("Get reviews error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch reviews.",
            error: error.message,
        });
    }
};

// Delete review (by review author or admin)
exports.deleteReviewController = async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.payload;
        const role = req.role;

        const [existing] = await pool.query("SELECT * FROM reviews WHERE id = ? LIMIT 1", [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Review not found.",
            });
        }

        const review = existing[0];

        // Only author or admin can delete
        if (review.user_email !== userEmail && role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own reviews.",
            });
        }

        await pool.query("DELETE FROM reviews WHERE id = ?", [id]);

        return res.status(200).json({
            success: true,
            message: "Review deleted successfully.",
            reviewId: id,
        });
    } catch (error) {
        console.error("Delete review error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete review.",
            error: error.message,
        });
    }
};

// Get reviews submitted by logged-in user
exports.getMyReviewsController = async (req, res) => {
    try {
        const userEmail = req.payload;

        const [reviews] = await pool.query(
            `SELECT r.*, p.name as product_name, p.slug as product_slug, p.image as product_image
             FROM reviews r
             JOIN products p ON r.product_id = p.id
             WHERE r.user_email = ?
             ORDER BY r.id DESC`,
            [userEmail]
        );

        return res.status(200).json(reviews);
    } catch (error) {
        console.error("Get my reviews error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch reviews.",
            error: error.message,
        });
    }
};
