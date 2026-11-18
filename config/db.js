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
                mrp DECIMAL(10, 2) DEFAULT 0.00,
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

        // Seed default admin if not exists
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@viyodha.com';
        const [adminRows] = await connection.query(`SELECT * FROM users WHERE email = ? LIMIT 1`, [adminEmail]);
        if (adminRows.length === 0) {
            const adminPass = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
            await connection.query(
                `INSERT INTO users (username, email, password, phone, role) VALUES (?, ?, ?, ?, 'admin')`,
                ['Viyodha Admin', adminEmail, adminPass, '9876543210']
            );
            console.log(`Default Viyodha admin created: ${adminEmail} / admin123`);
        }

        // Check products count and ensure all initial products exist
        const initialProducts = [
            {
                slug: "green-cardamom",
                name: "Green Cardamom 200g",
                image: "/products/cardamom.png",
                price: 495.00,
                mrp: 599.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cardamom",
                description: "Plump, aromatic pods graded by size and sealed fresh. Use whole in tea, biryani and desserts, or crush the seeds just before cooking.",
                details: [
                    { label: "Grade", value: "8mm+" },
                    { label: "Origin", value: "Idukki, Kerala" },
                    { label: "Net weight", value: "200 g" },
                    { label: "Form", value: "Whole pods" }
                ]
            },
            {
                slug: "black-pepper",
                name: "Black Pepper 100g",
                image: "/products/black_pepper.png",
                price: 349.00,
                mrp: 429.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Pepper",
                description: "Bold, sharp peppercorns with a strong aroma. Grind fresh over any dish for a warmth that pre-ground pepper cannot match.",
                details: [
                    { label: "Grade", value: "Bold" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "100 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "nutmeg",
                name: "Nutmeg (Whole) 100 g",
                image: "/products/nutmeg.png",
                price: 599.00,
                mrp: 749.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Nutmeg",
                description: "Whole nutmeg, slow-dried so it keeps its oils. Grate a little into sauces, milk drinks, baking and curries.",
                details: [
                    { label: "Grade", value: "Whole" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "100 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "bay-leaf",
                name: "Bay Leaf 100g",
                image: "/products/bay_leaf.png",
                price: 129.00,
                mrp: 159.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Bay Leaf",
                description: "Whole leaves, dried gently to keep their colour and aroma. Add to rice, dals, stews and stocks.",
                details: [
                    { label: "Grade", value: "Hand-picked" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "100 g" },
                    { label: "Form", value: "Whole leaves" }
                ]
            },
            {
                slug: "bay-leaf-200g",
                name: "Bay Leaf 200g",
                image: "/products/bay_leaf.png",
                price: 239.00,
                mrp: 259.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Bay Leaf",
                description: "Whole leaves, dried gently to keep their colour and aroma. Add to rice, dals, stews and stocks.",
                details: [
                    { label: "Grade", value: "Hand-picked" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "200 g" },
                    { label: "Form", value: "Whole leaves" }
                ]
            },
            {
                slug: "cinnamon",
                name: "Cinnamon (Cassia) 100g",
                image: "/products/cinnamon.png",
                price: 249.00,
                mrp: 299.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cinnamon",
                description: "Cassia cinnamon with a bold, warm flavour and a sweet finish. Simmer the sticks in tea, curries, biryani and desserts.",
                details: [
                    { label: "Type", value: "Cassia" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "100 g" },
                    { label: "Form", value: "Sticks" }
                ]
            },
            {
                slug: "star-anise",
                name: "Star Anise 200g",
                image: "/products/star_anise.png",
                price: 299.00,
                mrp: 349.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Star Anise",
                description: "Whole, star-shaped pods with a sweet, licorice-like aroma. Add to biryani, masala chai, stocks and slow-cooked curries.",
                details: [
                    { label: "Grade", value: "Whole stars" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "200 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "mace",
                name: "Mace 100g",
                image: "/products/mace.png",
                price: 449.00,
                mrp: 529.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Mace",
                description: "Delicate blades of mace with a warm, floral flavour milder than nutmeg. Use in rich gravies, biryani, baking and spice blends.",
                details: [
                    { label: "Grade", value: "Whole blades" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "100 g" },
                    { label: "Form", value: "Whole" }
                ]
            },
            {
                slug: "cloves",
                name: "Cloves(Laung) 200g",
                image: "/products/cloves.png",
                price: 279.00,
                mrp: 329.00,
                category: "Whole Spices",
                brand: "Viyodha",
                type: "Cloves",
                description: "Plump, intensely aromatic cloves with a strong, warming flavour. Use in rice dishes, curries, teas and pickles, a few at a time.",
                details: [
                    { label: "Grade", value: "Hand-picked" },
                    { label: "Origin", value: "Kerala" },
                    { label: "Net weight", value: "200 g" },
                    { label: "Form", value: "Whole" }
                ]
            }
        ];

        for (const p of initialProducts) {
            const [exists] = await connection.query(`SELECT id FROM products WHERE slug = ? LIMIT 1`, [p.slug]);
            if (exists.length === 0) {
                await connection.query(
                    `INSERT INTO products (name, slug, price, mrp, category, brand, type, description, image, details_json) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        p.name,
                        p.slug,
                        p.price,
                        p.mrp,
                        p.category,
                        p.brand,
                        p.type,
                        p.description,
                        p.image,
                        JSON.stringify(p.details)
                    ]
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
