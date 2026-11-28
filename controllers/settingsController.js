const pool = require('../config/db');

// Get current delivery settings
exports.getDeliverySettingsController = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM delivery_settings WHERE id = 1 LIMIT 1");
        if (rows.length === 0) {
            await pool.query(
                "INSERT INTO delivery_settings (id, delivery_kerala, delivery_national, free_shipping_threshold) VALUES (1, 40.00, 70.00, 999.00)"
            );
            return res.status(200).json({
                success: true,
                settings: {
                    deliveryKerala: 40,
                    deliveryNational: 70,
                    freeShippingThreshold: 999,
                },
            });
        }

        const s = rows[0];
        return res.status(200).json({
            success: true,
            settings: {
                deliveryKerala: parseFloat(s.delivery_kerala),
                deliveryNational: parseFloat(s.delivery_national),
                freeShippingThreshold: parseFloat(s.free_shipping_threshold),
            },
        });
    } catch (error) {
        console.error("Get delivery settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch delivery settings.",
            error: error.message,
        });
    }
};

// Update delivery settings (Admin only)
exports.updateDeliverySettingsController = async (req, res) => {
    try {
        const { deliveryKerala, deliveryNational, freeShippingThreshold } = req.body;

        if (deliveryKerala === undefined || deliveryNational === undefined) {
            return res.status(400).json({
                success: false,
                message: "Both deliveryKerala and deliveryNational amounts are required.",
            });
        }

        const keralaFee = Math.max(0, parseFloat(deliveryKerala) || 0);
        const nationalFee = Math.max(0, parseFloat(deliveryNational) || 0);
        const freeThreshold = freeShippingThreshold !== undefined ? Math.max(0, parseFloat(freeShippingThreshold) || 0) : 999;

        await pool.query(
            `INSERT INTO delivery_settings (id, delivery_kerala, delivery_national, free_shipping_threshold)
             VALUES (1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                delivery_kerala = VALUES(delivery_kerala),
                delivery_national = VALUES(delivery_national),
                free_shipping_threshold = VALUES(free_shipping_threshold)`,
            [keralaFee, nationalFee, freeThreshold]
        );

        return res.status(200).json({
            success: true,
            message: "Delivery settings updated successfully.",
            settings: {
                deliveryKerala: keralaFee,
                deliveryNational: nationalFee,
                freeShippingThreshold: freeThreshold,
            },
        });
    } catch (error) {
        console.error("Update delivery settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update delivery settings.",
            error: error.message,
        });
    }
};
