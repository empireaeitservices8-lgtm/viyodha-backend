# Viyodha Backend API

A high-performance Node.js & Express REST API powered by MySQL (`mysql2/promise`) for the **Viyodha Spices** e-commerce platform.

---

## 🌟 Key Features

1. **Product Catalog & Management**:
   - Preserves all 9 authentic Kerala spice products (Cardamom, Black Pepper, Nutmeg, Bay Leaf, Cinnamon, Star Anise, Mace, Cloves).
   - Admin can add new products with image upload (Multer) or image URL.
   - Admin can update existing product details (pricing, MRP, category, description, stock, details).
   - Admin can delete products.
   - Public product browsing with search and category filters.

2. **Customer & Admin Authentication**:
   - Customer registration with bcrypt password hashing.
   - Secure login with JWT token issuance.
   - Default administrator account seeded on first boot.
   - Profile management: user and admin can update name, email, phone number, and change passwords with current password verification.
   - Admin can view all registered users and delete customer accounts.

3. **Cart & Shopping Experience**:
   - Add items to cart with pack size and quantity.
   - Dynamic quantity increment / decrement and item removal.
   - Automatic cart clear upon order placement.

4. **Order Management & Status Tracking**:
   - Order placement supporting both **Cash on Delivery** and **Online Payment** (UPI, Cards, Net Banking).
   - Delivery address, contact information, item details, subtotal, shipping fee, and grand total.
   - Customer order history with live status updates (`Placed`, `Shipped`, `Delivered`, `Cancelled`).
   - Customer can cancel an order before it ships.
   - Admin can view all customer orders and mark fulfillment status (`Shipped`, `Delivered`).

5. **Customer Reviews**:
   - Authenticated customers can submit product reviews with star ratings (1-5) and comments.
   - Public endpoint to view all customer reviews and average rating per product.
   - Review authors and administrators can delete reviews.

---

## 🔑 Default Credentials

- **Admin Email**: `viyodhatradingpvtlimited@gmail.com`
- **Admin Password**: `admin123`

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd viyodha-backend
npm install
```

### 2. Environment Configuration (`.env`)
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Rameesa@1991
DB_NAME=viyodha_db
DB_PORT=3306
JWT_SECRET=viyodha_super_secret_jwt_key_2026
ADMIN_EMAIL=viyodhatradingpvtlimited@gmail.com
ADMIN_PASSWORD=admin123
```

### 3. Start Server
```bash
# Production
npm start

# Development (Node watch mode)
npm run dev
```

### 4. Run Automated Integration Test Suite
```bash
node test_api.js
```

---

## 📡 API Endpoints

### Public Routes
- `GET /` — API health check
- `POST /register` — Register a new customer
- `POST /login` — Authenticate customer or administrator
- `POST /logout` — Logout
- `GET /products` — List all spice products (supports `?search=`, `?category=`, `?sort=`)
- `GET /product/:id` — Get product details by ID or slug (includes customer reviews and average rating)
- `GET /reviews/:productId` — Get reviews for a specific spice
- `POST /send` or `POST /contact` — Submit customer enquiry

### Authenticated User Routes (`Authorization: Bearer <token>`)
- `GET /profile` — Get logged-in user profile
- `PUT /profile` — Update profile & optionally change password
- `POST /cart/add` — Add spice item to cart
- `GET /cart` — Get cart items with product details
- `PUT /cart/increment/:cartId` — Increment item quantity
- `PUT /cart/decrement/:cartId` — Decrement item quantity (removes if 1)
- `DELETE /cart/remove/:cartId` — Remove specific cart item
- `DELETE /cart/remove` — Clear entire cart
- `POST /order/add` — Place order (Cash on Delivery or Online Payment)
- `GET /myOrders` — View order history and statuses
- `GET /order/:id` — View single order tracking details
- `PUT /myOrders/cancel/:id` — Cancel order before shipping
- `POST /review/add` — Submit product review
- `DELETE /review/:id` — Delete own review

### Admin Routes (`Authorization: Bearer <admin_token>`)
- `POST /product/add` — Add new product (Multer image upload supported)
- `PUT /product/:id` — Update existing product details
- `DELETE /product/:id` — Delete product
- `GET /admin/orders` — View all customer orders
- `PUT /order/status/:id` — Mark order status (`Shipped` / `Delivered`)
- `GET /admin/users` — View all registered customer accounts
- `DELETE /admin/users/:id` — Delete customer account
- `DELETE /admin/review/:id` — Moderate / delete any review
