const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const fs = require("fs/promises");
const path = require("path");

function slugify(text) {
    const cleaned = text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return cleaned || `spice-${Date.now().toString().slice(-4)}`;
}

function formatProduct(p) {
    let details = [];
    if (p.details_json) {
        try {
            details = typeof p.details_json === "string" ? JSON.parse(p.details_json) : p.details_json;
        } catch {
            details = [];
        }
    }

    let images = [];
    if (p.images_json) {
        try {
            images = typeof p.images_json === "string" ? JSON.parse(p.images_json) : p.images_json;
        } catch {
            images = [];
        }
    }
    if (!images || images.length === 0) {
        images = p.image ? [p.image] : [];
    }

    const p100 = p.price100g ? Number(p.price100g) : Number(p.price);
    const p200 = p.price200g ? Number(p.price200g) : Math.round(p100 * 1.9);

    return {
        ...p,
        price: p100,
        price100g: p100,
        price200g: p200,
        mrp: null,
        image: images[0] || p.image,
        image2: images.length > 1 ? images[1] : null,
        images,
        details
    };
}

// Add product (Admin)
exports.addProductController = async (req, res) => {
    try {
        const { name, slug, price, price100g, price200g, category, brand, type, description, details, details_json, stock } = req.body;

        const files = req.files || (req.file ? [req.file] : []);
        const uploadedImages = [];

        for (const file of files) {
            try {
                const cloudRes = await cloudinary.uploader.upload(file.path, {
                    folder: "viyodha/products",
                    use_filename: true,
                    unique_filename: true
                });
                uploadedImages.push(cloudRes.secure_url);
                await fs.unlink(file.path).catch(() => {});
            } catch (cloudErr) {
                console.warn("Cloudinary upload failed, using local file:", cloudErr);
                uploadedImages.push(`/uploads/${file.filename}`);
            }
        }

        if (uploadedImages.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please upload at least one product image.",
            });
        }

        if (!name || (!price && !price100g) || !description) {
            return res.status(400).json({
                success: false,
                message: "Product name, prices (100g / 200g), and description are required.",
            });
        }

        const primaryImage = uploadedImages[0];
        const imagesJson = JSON.stringify(uploadedImages);

        // Generate or clean slug
        let finalSlug = slug ? slugify(slug) : slugify(name);
        
        // Ensure slug uniqueness
        const [existingSlug] = await pool.query("SELECT id FROM products WHERE slug = ? LIMIT 1", [finalSlug]);
        if (existingSlug.length > 0) {
            finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
        }

        const p100 = price100g !== undefined && price100g !== "" ? parseFloat(price100g) : (parseFloat(price) || 0.00);
        const p200 = price200g !== undefined && price200g !== "" ? parseFloat(price200g) : Math.round(p100 * 1.9);
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
                { label: "Available sizes", value: "100 g, 200 g" },
                { label: "Grade", value: "Premium" },
                { label: "Form", value: "Whole" }
            ]);
        }

        const [result] = await pool.query(
            `INSERT INTO products (name, slug, price, price100g, price200g, mrp, category, brand, type, description, image, images_json, details_json, stock) 
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name.trim(),
                finalSlug,
                p100,
                p100,
                p200,
                productCategory,
                productBrand,
                productType,
                description.trim(),
                primaryImage,
                imagesJson,
                parsedDetails,
                productStock
            ]
        );

        const [newProduct] = await pool.query("SELECT * FROM products WHERE id = ?", [result.insertId]);

        return res.status(201).json({
            success: true,
            message: "Product added successfully.",
            product: formatProduct(newProduct[0])
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
        const formatted = products.map(formatProduct);

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

        const formatted = formatProduct(product);

        return res.status(200).json({
            ...formatted,
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
        const stock = req.body.stock !== undefined ? parseInt(req.body.stock, 10) : current.stock;

        const p100 = req.body.price100g !== undefined && req.body.price100g !== ""
            ? parseFloat(req.body.price100g)
            : (req.body.price !== undefined ? parseFloat(req.body.price) : (current.price100g || current.price));
        const p200 = req.body.price200g !== undefined && req.body.price200g !== ""
            ? parseFloat(req.body.price200g)
            : (current.price200g || Math.round(Number(p100) * 1.9));

        let details_json = current.details_json;
        if (req.body.details_json !== undefined) {
            details_json = typeof req.body.details_json === "string" ? req.body.details_json : JSON.stringify(req.body.details_json);
        } else if (req.body.details !== undefined) {
            details_json = typeof req.body.details === "string" ? req.body.details : JSON.stringify(req.body.details);
        } else if (typeof details_json === "object" && details_json !== null) {
            details_json = JSON.stringify(details_json);
        }

        // Process images
        const files = req.files || (req.file ? [req.file] : []);
        const newUploadedUrls = [];

        for (const file of files) {
            try {
                const cloudRes = await cloudinary.uploader.upload(file.path, {
                    folder: "viyodha/products",
                    use_filename: true,
                    unique_filename: true
                });
                newUploadedUrls.push(cloudRes.secure_url);
                await fs.unlink(file.path).catch(() => {});
            } catch (cloudErr) {
                console.warn("Cloudinary upload failed, using local file:", cloudErr);
                newUploadedUrls.push(`/uploads/${file.filename}`);
            }
        }

        // Kept existing images
        let keptImages = [];
        if (req.body.existingImages !== undefined) {
            try {
                keptImages = typeof req.body.existingImages === "string"
                    ? JSON.parse(req.body.existingImages)
                    : req.body.existingImages;
                if (!Array.isArray(keptImages)) keptImages = [keptImages];
            } catch {
                keptImages = [];
            }
        } else if (files.length === 0) {
            if (current.images_json) {
                try {
                    keptImages = typeof current.images_json === "string" ? JSON.parse(current.images_json) : current.images_json;
                } catch {
                    keptImages = [current.image];
                }
            } else {
                keptImages = [current.image];
            }
        }

        const finalImages = [...keptImages, ...newUploadedUrls].filter(Boolean);
        if (finalImages.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Product must have at least one image.",
            });
        }

        const primaryImage = finalImages[0];
        const imagesJson = JSON.stringify(finalImages);

        await pool.query(
            `UPDATE products SET name = ?, slug = ?, category = ?, brand = ?, type = ?, description = ?, price = ?, price100g = ?, price200g = ?, mrp = NULL, image = ?, images_json = ?, details_json = ?, stock = ? 
             WHERE id = ?`,
            [name, slug, category, brand, type, description, p100, p100, p200, primaryImage, imagesJson, details_json, stock, current.id]
        );

        const [updatedRows] = await pool.query("SELECT * FROM products WHERE id = ?", [current.id]);

        return res.status(200).json({
            success: true,
            message: "Product updated successfully.",
            product: formatProduct(updatedRows[0]),
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
