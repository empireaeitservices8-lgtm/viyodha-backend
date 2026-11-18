const pool = require('../config/db');

// Add item to cart
exports.addToCartController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const { productId, quantity, pack } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID or slug is required.",
            });
        }

        const qty = parseInt(quantity, 10) || 1;
        const packSize = pack || "100g";

        // Check if product exists (allow query by id or slug)
        const [products] = await pool.query(
            "SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1",
            [productId, productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        const product = products[0];

        // Check if already in user's cart
        const [existing] = await pool.query(
            "SELECT * FROM carts WHERE user_email = ? AND product_id = ? LIMIT 1",
            [userEmail, product.id]
        );

        if (existing.length > 0) {
            const newQty = existing[0].quantity + qty;
            await pool.query(
                "UPDATE carts SET quantity = ?, pack = ? WHERE id = ?",
                [newQty, packSize, existing[0].id]
            );

            const [updated] = await pool.query("SELECT * FROM carts WHERE id = ?", [existing[0].id]);
            return res.status(200).json({
                success: true,
                message: "Cart quantity updated.",
                data: updated[0],
            });
        }

        const [result] = await pool.query(
            "INSERT INTO carts (user_email, product_id, quantity, pack) VALUES (?, ?, ?, ?)",
            [userEmail, product.id, qty, packSize]
        );

        const [newItem] = await pool.query("SELECT * FROM carts WHERE id = ?", [result.insertId]);

        return res.status(201).json({
            success: true,
            message: "Product added to cart.",
            data: newItem[0],
        });
    } catch (error) {
        console.error("Add to cart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add product to cart.",
            error: error.message,
        });
    }
};

// Get cart items with product details
exports.getCartController = async (req, res) => {
    try {
        const userEmail = req.payload;

        const [items] = await pool.query(
            `SELECT c.id as cart_id, c.quantity, c.pack, c.created_at,
                    p.id as product_id, p.name, p.slug, p.price, p.mrp, p.image, p.category, p.brand, p.type
             FROM carts c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_email = ?
             ORDER BY c.id DESC`,
            [userEmail]
        );

        return res.status(200).json(items);
    } catch (error) {
        console.error("Get cart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cart items.",
            error: error.message,
        });
    }
};

// Increment quantity
exports.incrementQuantityController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const { cartId } = req.params;

        const [existing] = await pool.query(
            "SELECT * FROM carts WHERE id = ? AND user_email = ? LIMIT 1",
            [cartId, userEmail]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found.",
            });
        }

        const newQty = existing[0].quantity + 1;
        await pool.query("UPDATE carts SET quantity = ? WHERE id = ?", [newQty, cartId]);

        return res.status(200).json({
            success: true,
            message: "Quantity increased.",
            quantity: newQty,
        });
    } catch (error) {
        console.error("Increment quantity error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to increment quantity.",
            error: error.message,
        });
    }
};

// Decrement quantity
exports.decrementQuantityController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const { cartId } = req.params;

        const [existing] = await pool.query(
            "SELECT * FROM carts WHERE id = ? AND user_email = ? LIMIT 1",
            [cartId, userEmail]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found.",
            });
        }

        if (existing[0].quantity > 1) {
            const newQty = existing[0].quantity - 1;
            await pool.query("UPDATE carts SET quantity = ? WHERE id = ?", [newQty, cartId]);

            return res.status(200).json({
                success: true,
                message: "Quantity decreased.",
                quantity: newQty,
            });
        }

        // Remove item if quantity was 1
        await pool.query("DELETE FROM carts WHERE id = ? AND user_email = ?", [cartId, userEmail]);

        return res.status(200).json({
            success: true,
            message: "Product removed from cart.",
        });
    } catch (error) {
        console.error("Decrement quantity error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to decrement quantity.",
            error: error.message,
        });
    }
};

// Remove single cart item
exports.removeCartItemController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const { cartId } = req.params;

        const [result] = await pool.query(
            "DELETE FROM carts WHERE id = ? AND user_email = ?",
            [cartId, userEmail]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from cart.",
        });
    } catch (error) {
        console.error("Remove cart item error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove cart item.",
            error: error.message,
        });
    }
};

// Remove all cart items for user
exports.removeAllCartItemsController = async (req, res) => {
    try {
        const userEmail = req.payload;

        const [result] = await pool.query("DELETE FROM carts WHERE user_email = ?", [userEmail]);

        return res.status(200).json({
            success: true,
            message: "All cart items removed.",
            deletedCount: result.affectedRows,
        });
    } catch (error) {
        console.error("Clear cart error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to clear cart.",
            error: error.message,
        });
    }
};
