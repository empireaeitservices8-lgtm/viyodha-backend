const pool = require('../config/db');

// Add order (Customer)
exports.addOrderController = async (req, res) => {
    try {
        const userEmail = req.payload;
        const {
            username,
            phone,
            address,
            city,
            state,
            pin,
            paymentMethod,
            items,
            subtotal,
            shippingFee,
            totalAmount,
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order items cannot be empty.",
            });
        }

        if (!address || !phone) {
            return res.status(400).json({
                success: false,
                message: "Delivery address and phone number are required.",
            });
        }

        // Calculate totals
        let calculatedSubtotal = 0;
        for (const item of items) {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity || item.qty, 10) || 1;
            calculatedSubtotal += price * qty;
        }

        const parsedSubtotal = subtotal ? parseFloat(subtotal) : calculatedSubtotal;

        let parsedShipping;
        if (shippingFee !== undefined && shippingFee !== null) {
            parsedShipping = parseFloat(shippingFee);
        } else {
            let defKerala = 40, defNational = 70, defThreshold = 999;
            try {
                const [ds] = await pool.query("SELECT * FROM delivery_settings WHERE id = 1 LIMIT 1");
                if (ds.length > 0) {
                    defKerala = parseFloat(ds[0].delivery_kerala);
                    defNational = parseFloat(ds[0].delivery_national);
                    defThreshold = parseFloat(ds[0].free_shipping_threshold);
                }
            } catch (e) {
                console.warn("Could not query delivery_settings fallback:", e);
            }
            const isKerala = String(state || "").trim().toLowerCase() === "kerala";
            parsedShipping = (defThreshold > 0 && parsedSubtotal >= defThreshold) ? 0 : (isKerala ? defKerala : defNational);
        }

        const finalTotal = totalAmount ? parseFloat(totalAmount) : (parsedSubtotal + parsedShipping);

        const method = paymentMethod || "Cash on Delivery";
        const paymentStatus = method === "Cash on Delivery" ? "Pending" : "Paid";

        const [result] = await pool.query(
            `INSERT INTO orders (
                user_email, username, phone, address, city, state, pin, 
                payment_method, payment_status, order_status, subtotal, shipping_fee, total_amount, items_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Placed', ?, ?, ?, ?)`,
            [
                userEmail,
                username || userEmail.split("@")[0],
                String(phone).trim(),
                address.trim(),
                city ? city.trim() : "",
                state ? state.trim() : "",
                pin ? pin.trim() : "",
                method,
                paymentStatus,
                parsedSubtotal,
                parsedShipping,
                finalTotal,
                JSON.stringify(items),
            ]
        );

        // Clear cart for this user
        await pool.query("DELETE FROM carts WHERE user_email = ?", [userEmail]);

        const [newOrder] = await pool.query("SELECT * FROM orders WHERE id = ?", [result.insertId]);

        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            order: newOrder[0],
        });
    } catch (error) {
        console.error("Add order error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to place order.",
            error: error.message,
        });
    }
};

// Customer: Get my orders
exports.getMyOrdersController = async (req, res) => {
    try {
        const userEmail = req.payload;

        const [myOrders] = await pool.query(
            "SELECT * FROM orders WHERE user_email = ? ORDER BY id DESC",
            [userEmail]
        );

        const formatted = myOrders.map((o) => {
            let items = [];
            try {
                items = typeof o.items_json === "string" ? JSON.parse(o.items_json) : o.items_json;
            } catch {
                items = [];
            }
            return {
                ...o,
                items,
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Get my orders error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: error.message,
        });
    }
};

// View single order (by customer or admin)
exports.viewOrderController = async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.payload;
        const role = req.role;

        let query = "SELECT * FROM orders WHERE id = ? LIMIT 1";
        const params = [id];

        if (role !== "admin") {
            query = "SELECT * FROM orders WHERE id = ? AND user_email = ? LIMIT 1";
            params.push(userEmail);
        }

        const [orders] = await pool.query(query, params);

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        const order = orders[0];
        let items = [];
        try {
            items = typeof order.items_json === "string" ? JSON.parse(order.items_json) : order.items_json;
        } catch {
            items = [];
        }

        return res.status(200).json({
            ...order,
            items,
        });
    } catch (error) {
        console.error("View order error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order details.",
            error: error.message,
        });
    }
};

// Customer: Cancel my order (only if Placed)
exports.cancelMyOrderController = async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.payload;

        const [existing] = await pool.query(
            "SELECT * FROM orders WHERE id = ? AND user_email = ? LIMIT 1",
            [id, userEmail]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        const order = existing[0];

        if (order.order_status !== "Placed") {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled because it is already ${order.order_status}.`,
            });
        }

        await pool.query("UPDATE orders SET order_status = 'Cancelled' WHERE id = ?", [id]);
        const [updated] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully.",
            order: updated[0],
        });
    } catch (error) {
        console.error("Cancel order error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel order.",
            error: error.message,
        });
    }
};

// Admin: Get all orders
exports.getAllOrdersController = async (req, res) => {
    try {
        const [orders] = await pool.query("SELECT * FROM orders ORDER BY id DESC");

        const formatted = orders.map((o) => {
            let items = [];
            try {
                items = typeof o.items_json === "string" ? JSON.parse(o.items_json) : o.items_json;
            } catch {
                items = [];
            }
            return {
                ...o,
                items,
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Get all orders error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: error.message,
        });
    }
};

// Admin: Update order status (Mark as Shipped / Delivered / Cancelled)
exports.updateOrderStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;

        const validStatuses = ["Placed", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "Status must be one of: " + validStatuses.join(", "),
            });
        }

        const [existing] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        await pool.query("UPDATE orders SET order_status = ? WHERE id = ?", [orderStatus, id]);
        const [updated] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);

        return res.status(200).json({
            success: true,
            message: `Order status updated to ${orderStatus}.`,
            order: updated[0],
        });
    } catch (error) {
        console.error("Update order status error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order status.",
            error: error.message,
        });
    }
};

// Admin: Delete order permanently from database
exports.deleteOrderController = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        await pool.query("DELETE FROM orders WHERE id = ?", [id]);

        return res.status(200).json({
            success: true,
            message: `Order #${id} deleted successfully from database.`,
        });
    } catch (error) {
        console.error("Delete order error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete order.",
            error: error.message,
        });
    }
};
