const pool = require("../config/db");
const fs = require("fs/promises");
const path = require("path");

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

// Add product (Admin)
exports.addProductController = async (req, res) => {
    try {
        const { name, slug, price, mrp, category, brand, type, description, details, details_json, stock } = req.body;

        const uploadimage = req.file
            ? `/uploads/${req.file.filename}`
            : req.body.image;

        if (!name || !price || !description || !uploadimage) {
            return res.status(400).json({
                success: false,
                message: "Product name, price, description, and image are required.",
            });
        }

        // Generate or clean slug
        let finalSlug = slug ? slugify(slug) : slugify(name);
        
        // Ensure slug uniqueness
        const [existingSlug] = await pool.query("SELECT id FROM products WHERE slug = ? LIMIT 1", [finalSlug]);
        if (existingSlug.length > 0) {
            finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
        }

        const productPrice = parseFloat(price) || 0.00;
        const productMrp = mrp ? parseFloat(mrp) : productPrice;
        const productCategory = category ? category.trim() : "Whole Spices";
        const productBrand = brand ? brand.trim() : "Viyodha";
        const productType = type ? type.trim() : "Spices";
        const productStock = parseInt(stock, 10) || 100;

        let parsedDetails = null;
        if (details_json) {
            parsedDetails = typeof details_json === "string" ? details_json : JSON.stringify(details_json);
        } else if (details) {
            parsedDetails = typeof details === "string" ? details : JSON.stringify(details);
        } else {
            parsedDetails = JSON.stringify([
                { label: "Origin", value: "Kerala" },
                { label: "Grade", value: "Premium" },
                { label: "Form", value: "Whole" }
            ]);
        }

        const [result] = await pool.query(
            `INSERT INTO products (name, slug, price, mrp, category, brand, type, description, image, details_json, stock) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name.trim(),
                finalSlug,
                productPrice,
                productMrp,
                productCategory,
                productBrand,
                productType,
                description.trim(),
                uploadimage,
                parsedDetails,
                productStock
            ]
        );

        const [newProduct] = await pool.query("SELECT * FROM products WHERE id = ?", [result.insertId]);

        return res.status(201).json({
            success: true,
            message: "Product added successfully.",
            product: newProduct[0]
        });
    } catch (error) {
        console.error("Add product error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to add product.",
        });
    }
};

// Get all products (Public, with optional search, category, brand, sort)
exports.getAllProductsController = async (req, res) => {
    try {
        const { search, category, brand, sort } = req.query;

        let query = "SELECT * FROM products WHERE 1=1";
        const params = [];

        if (category && category !== "All" && category !== "all") {
            query += " AND category = ?";
            params.push(category);
        }

        if (brand && brand !== "All" && brand !== "all") {
            query += " AND brand = ?";
            params.push(brand);
        }

        if (search && search.trim() !== "") {
            const searchTerm = `%${search.trim()}%`;
            query += " AND (name LIKE ? OR slug LIKE ? OR description LIKE ? OR category LIKE ? OR type LIKE ?)";
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (sort === "price-asc") {
            query += " ORDER BY price ASC";
        } else if (sort === "price-desc") {
            query += " ORDER BY price DESC";
        } else {
            query += " ORDER BY id DESC";
        }

        const [products] = await pool.query(query, params);

        // Normalize details_json for each product
        const formatted = products.map((p) => {
            let details = [];
            if (p.details_json) {
                try {
                    details = typeof p.details_json === "string" ? JSON.parse(p.details_json) : p.details_json;
                } catch {
                    details = [];
                }
            }
            return {
                ...p,
                details
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Get products error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch products.",
        });
    }
};

// View single product by id OR slug
exports.viewProductController = async (req, res) => {
    try {
        const { id } = req.params;

        let query = "SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1";
        const [products] = await pool.query(query, [id, id]);

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        const product = products[0];

        // Fetch reviews
        const [reviews] = await pool.query(
            "SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC",
            [product.id]
        );

        const avgRating = reviews.length > 0
            ? (reviews.reduce((acc, r) => acc + Number(r.rating), 0) / reviews.length).toFixed(1)
            : 0;

        let details = [];
        if (product.details_json) {
            try {
                details = typeof product.details_json === "string" ? JSON.parse(product.details_json) : product.details_json;
            } catch {
                details = [];
            }
        }

        return res.status(200).json({
            ...product,
            details,
            reviews,
            avgRating: Number(avgRating),
            reviewCount: reviews.length,
        });
    } catch (error) {
        console.error("View product error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to fetch product details.",
        });
    }
};

// Update product (Admin)
exports.updateProductController = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query("SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1", [id, id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        const current = existing[0];
        const name = req.body.name !== undefined ? req.body.name.trim() : current.name;
        const slug = req.body.slug !== undefined ? slugify(req.body.slug) : current.slug;
        const category = req.body.category !== undefined ? req.body.category.trim() : current.category;
        const brand = req.body.brand !== undefined ? req.body.brand.trim() : current.brand;
        const type = req.body.type !== undefined ? req.body.type.trim() : current.type;
        const description = req.body.description !== undefined ? req.body.description.trim() : current.description;
        const price = req.body.price !== undefined ? parseFloat(req.body.price) : current.price;
        const mrp = req.body.mrp !== undefined ? parseFloat(req.body.mrp) : current.mrp;
        const stock = req.body.stock !== undefined ? parseInt(req.body.stock, 10) : current.stock;

        let details_json = current.details_json;
        if (req.body.details_json !== undefined) {
            details_json = typeof req.body.details_json === "string" ? req.body.details_json : JSON.stringify(req.body.details_json);
        } else if (req.body.details !== undefined) {
            details_json = typeof req.body.details === "string" ? req.body.details : JSON.stringify(req.body.details);
        } else if (typeof details_json === "object" && details_json !== null) {
            details_json = JSON.stringify(details_json);
        }

        let image = current.image;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            image = req.body.image;
        }

        await pool.query(
            `UPDATE products SET name = ?, slug = ?, category = ?, brand = ?, type = ?, description = ?, price = ?, mrp = ?, image = ?, details_json = ?, stock = ? 
             WHERE id = ?`,
            [name, slug, category, brand, type, description, price, mrp, image, details_json, stock, current.id]
        );

        const [updatedRows] = await pool.query("SELECT * FROM products WHERE id = ?", [current.id]);

        return res.status(200).json({
            success: true,
            message: "Product updated successfully.",
            product: updatedRows[0],
        });
    } catch (error) {
        console.error("Update product error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to update product.",
        });
    }
};

// Delete product (Admin)
exports.deleteProductController = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query("SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1", [id, id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        const product = existing[0];

        // Delete from database
        await pool.query("DELETE FROM products WHERE id = ?", [product.id]);

        // Clean up uploaded image if in /uploads
        if (product.image && product.image.startsWith("/uploads/")) {
            const fileName = path.basename(product.image);
            const filePath = path.join(process.cwd(), "uploads", fileName);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                // Ignore if missing
            }
        }

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully.",
            productId: product.id,
        });
    } catch (error) {
        console.error("Delete product error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete product.",
        });
    }
};
