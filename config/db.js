const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const poolConfig = process.env.DATABASE_URL
    ? {
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: { rejectUnauthorized: false }
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Rameesa@1991',
        database: process.env.DB_NAME || 'viyodha_db',
        port: Number(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

const pool = mysql.createPool(poolConfig);

async function initDB() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log("Viyodha MySQL Database connected successfully");

        // 1. Users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Products table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                price100g DECIMAL(10, 2) DEFAULT NULL,
                price200g DECIMAL(10, 2) DEFAULT NULL,
                mrp DECIMAL(10, 2) DEFAULT NULL,
                category VARCHAR(150) NOT NULL DEFAULT 'Whole Spices',
                brand VARCHAR(150) NOT NULL DEFAULT 'Viyodha',
                type VARCHAR(150) NOT NULL DEFAULT 'Spices',
                description TEXT NOT NULL,
                image VARCHAR(500) NOT NULL,
                details_json JSON NULL,
                stock INT DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Ensure price100g, price200g, and images_json exist
        try {
            await connection.query("ALTER TABLE products ADD COLUMN price100g DECIMAL(10, 2) DEFAULT NULL");
        } catch (_) {}
        try {
            await connection.query("ALTER TABLE products ADD COLUMN price200g DECIMAL(10, 2) DEFAULT NULL");
        } catch (_) {}
        try {
            await connection.query("ALTER TABLE products ADD COLUMN images_json JSON DEFAULT NULL");
        } catch (_) {}

        // 3. Reviews table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                rating INT NOT NULL DEFAULT 5,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Carts table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS carts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                pack VARCHAR(100) DEFAULT '100g',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Orders table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                address TEXT NOT NULL,
                city VARCHAR(100) DEFAULT '',
                state VARCHAR(100) DEFAULT '',
                pin VARCHAR(20) DEFAULT '',
                payment_method VARCHAR(100) DEFAULT 'Cash on Delivery',
                payment_status ENUM('Pending', 'Paid', 'Failed') DEFAULT 'Pending',
                order_status ENUM('Placed', 'Shipped', 'Delivered', 'Cancelled') DEFAULT 'Placed',
                subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                items_json JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 6. Delivery Settings table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS delivery_settings (
                id INT PRIMARY KEY DEFAULT 1,
                delivery_kerala DECIMAL(10, 2) NOT NULL DEFAULT 40.00,
                delivery_national DECIMAL(10, 2) NOT NULL DEFAULT 70.00,
                free_shipping_threshold DECIMAL(10, 2) NOT NULL DEFAULT 999.00,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Seed delivery settings default (Kerala: 40, Outside Kerala: 70)
        await connection.query(`
            INSERT INTO delivery_settings (id, delivery_kerala, delivery_national, free_shipping_threshold)
            VALUES (1, 40.00, 70.00, 999.00)
            ON DUPLICATE KEY UPDATE 
                delivery_kerala = IF(delivery_kerala = 0.00 OR delivery_kerala = 60.00, 40.00, delivery_kerala),
                delivery_national = IF(delivery_national = 0.00 OR delivery_national = 60.00, 70.00, delivery_national);
        `);

        // Seed default admin if not exists
        const adminEmail = process.env.ADMIN_EMAIL || 'viyodhatradingpvtlimited@gmail.com';

        // Clean up legacy default admin email if present
        if (adminEmail !== 'admin@viyodha.com') {
            await connection.query(`DELETE FROM users WHERE email = 'admin@viyodha.com'`);
        }

        const [adminRows] = await connection.query(`SELECT * FROM users WHERE email = ? LIMIT 1`, [adminEmail]);
        if (adminRows.length === 0) {
            const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
            await connection.query(
                `INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, 'admin')`,
                ['Viyodha Admin', adminEmail, adminPass, '9876543210']
            );
            console.log(`Default Viyodha admin created: ${adminEmail} / admin123`);
        }

        // Clean up legacy separate products
        await connection.query(`DELETE FROM products WHERE slug = 'bay-leaf-200g'`);

        // Check products count and ensure all initial products exist
        const initialProducts = [
            {
                slug: "green-cardamom",
                name: "Green Cardamom (ഏലക്ക)",
                image: "/products/cardamom.png",
                images: ["/products/cardamom.png", "/products/cardamom2.png"],
                price: 499.00,
                price100g: 499.00,
                price200g: 899.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cardamom",
                description: "Plump, aromatic pods graded by size and sealed fresh. Use whole in tea, biryani and desserts, or crush the seeds just before cooking.",
                details: [
                    { label: "Malayalam name", value: "ഏലക്ക (Elakka)" },
                    { label: "Grade", value: "8mm+" },
                    { label: "Origin", value: "Idukki, Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole pods" }
                ]
            },
            {
                slug: "black-pepper",
                name: "Black Pepper (കുരുമുളക്)",
                image: "/products/black_pepper.png",
                images: ["/products/black_pepper.png", "/products/black_pepper2.png"],
                price: 99.00,
                price100g: 99.00,
                price200g: 189.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Pepper",
                description: "Bold, sharp peppercorns with a strong aroma. Grind fresh over any dish for a warmth that pre-ground pepper cannot match.",
                details: [
                    { label: "Malayalam name", value: "കുരുമുളക് (Kurumulaku)" },
                    { label: "Grade", value: "Bold" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "nutmeg",
                name: "Nutmeg (ജാതിക്ക)",
                image: "/products/nutmeg.png",
                images: ["/products/nutmeg.png", "/products/nutmeg2.png"],
                price: 299.00,
                price100g: 299.00,
                price200g: 589.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Nutmeg",
                description: "Whole nutmeg, slow-dried so it keeps its oils. Grate a little into sauces, milk drinks, baking and curries.",
                details: [
                    { label: "Malayalam name", value: "ജാതിക്ക (Jathikka)" },
                    { label: "Grade", value: "Whole" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "bay-leaf",
                name: "Bay Leaf (വഴനയില)",
                image: "/products/bay_leaf.png",
                images: ["/products/bay_leaf.png", "/products/bay_leaf2.png"],
                price: 49.00,
                price100g: 49.00,
                price200g: 189.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Bay Leaf",
                description: "Whole leaves, dried gently to keep their colour and aroma. Add to rice, dals, stews and stocks.",
                details: [
                    { label: "Malayalam name", value: "വഴനയില (Vazhanayila)" },
                    { label: "Grade", value: "Hand-picked" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole leaves" }
                ]
            },
            {
                slug: "cinnamon",
                name: "Cinnamon (കറുവപ്പട്ട)",
                image: "/products/cinnamon.png",
                images: ["/products/cinnamon.png", "/products/cinnamon2.png"],
                price: 59.00,
                price100g: 59.00,
                price200g: 119.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cinnamon",
                description: "Cinnamon with a bold, warm flavour and a sweet finish. Simmer the sticks in tea, curries, biryani and desserts.",
                details: [
                    { label: "Malayalam name", value: "കറുവപ്പട്ട (Karuvapatta)" },
                    { label: "Type", value: "Cinnamon" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Sticks" }
                ]
            },
            {
                slug: "cassia-cinnamon",
                name: "Cassia Cinnamon (ചുരുൾ പട്ട)",
                image: "/products/cassia_cinnamon.png",
                images: ["/products/cassia_cinnamon.png", "/products/cinnamon2.png"],
                price: 99.00,
                price100g: 99.00,
                price200g: 189.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cassia",
                description: "Cassia cinnamon with a bold, warm flavour and a sweet finish. Simmer the sticks in tea, curries, biryani and desserts.",
                details: [
                    { label: "Malayalam name", value: "ചുരുൾ പട്ട (Churul patta)" },
                    { label: "Type", value: "Cassia" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Sticks" }
                ]
            },
            {
                slug: "star-anise",
                name: "Star Anise (തക്കോലം)",
                image: "/products/star_anise.jpeg",
                images: ["/products/star_anise.jpeg", "/products/star_anise2.png"],
                price: 99.00,
                price100g: 99.00,
                price200g: 189.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Star Anise",
                description: "Whole, star-shaped pods with a sweet, licorice-like aroma. Add to biryani, masala chai, stocks and slow-cooked curries.",
                details: [
                    { label: "Malayalam name", value: "തക്കോലം (Thakkolam)" },
                    { label: "Grade", value: "Whole stars" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "mace",
                name: "Mace (ജാതിപത്രി)",
                image: "/products/mace.png",
                images: ["/products/mace.png", "/products/mace2.png"],
                price: 299.00,
                price100g: 299.00,
                price200g: 589.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Mace",
                description: "Delicate blades of mace with a warm, floral flavour milder than nutmeg. Use in rich gravies, biryani, baking and spice blends.",
                details: [
                    { label: "Malayalam name", value: "ജാതിപത്രി (Jathipathri)" },
                    { label: "Grade", value: "Whole blades" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "cloves",
                name: "Cloves (ഗ്രാമ്പൂ)",
                image: "/products/cloves.png",
                images: ["/products/cloves.png", "/products/cloves2.png"],
                price: 149.00,
                price100g: 149.00,
                price200g: 289.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cloves",
                description: "Plump, intensely aromatic cloves with a strong, warming flavour. Use in rice dishes, curries, teas and pickles, a few at a time.",
                details: [
                    { label: "Malayalam name", value: "ഗ്രാമ്പൂ (Gramboo)" },
                    { label: "Grade", value: "Hand-picked" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Available sizes", value: "100 g, 200 g" },
                    { label: "Form", value: "Whole" }
                ]
            }
        ];

        for (const p of initialProducts) {
            const [exists] = await connection.query(`SELECT id FROM products WHERE slug = ? LIMIT 1`, [p.slug]);
            const pImages = p.images || [p.image];
            if (exists.length === 0) {
                await connection.query(
                    `INSERT INTO products (name, slug, price, price100g, price200g, mrp, category, brand, type, description, image, images_json, details_json) 
                     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        p.name,
                        p.slug,
                        p.price,
                        p.price100g,
                        p.price200g,
                        p.category,
                        p.brand,
                        p.type,
                        p.description,
                        p.image,
                        JSON.stringify(pImages),
                        JSON.stringify(p.details)
                    ]
                );
            } else {
                await connection.query(
                    `UPDATE products SET name = ?, price = ?, price100g = ?, price200g = ?, mrp = NULL, category = ?, brand = ?, type = ?, description = ?, image = ?, images_json = ?, details_json = ? WHERE slug = ?`,
                    [p.name, p.price, p.price100g, p.price200g, p.category, p.brand, p.type, p.description, p.image, JSON.stringify(pImages), JSON.stringify(p.details), p.slug]
                );
            }
        }
        console.log("All existing Viyodha spice products verified and seeded.");
    } catch (err) {
        console.error("Viyodha database initialization error:", err);
    } finally {
        if (connection) connection.release();
    }
}

initDB();

module.exports = pool;
