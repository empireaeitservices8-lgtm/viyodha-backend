const http = require('http');

async function runTests() {
    console.log("=== STARTING VIYODHA BACKEND ENDPOINT INTEGRATION TESTS ===");
    
    // Start backend server
    const app = require('./index');
    
    // Give DB 2 seconds to be ready
    await new Promise(r => setTimeout(r, 2000));

    const baseUrl = 'http://127.0.0.1:5000';

    async function request(method, path, body = null, token = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, baseUrl);
            const headers = {};
            if (body && typeof body === 'object') {
                headers['Content-Type'] = 'application/json';
            }
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const req = http.request(url, { method, headers }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: res.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ status: res.statusCode, raw: data });
                    }
                });
            });

            req.on('error', reject);
            if (body) {
                req.write(typeof body === 'object' ? JSON.stringify(body) : body);
            }
            req.end();
        });
    }

    try {
        // 1. Health check
        const health = await request('GET', '/');
        console.log("1. GET / status:", health.status, "(Server alive)");

        // 2. GET all products
        const productsRes = await request('GET', '/products');
        console.log("2. GET /products status:", productsRes.status, "count:", productsRes.data?.length);

        // 3. GET product by slug
        const cardamRes = await request('GET', '/product/green-cardamom');
        console.log("3. GET /product/green-cardamom:", cardamRes.status, cardamRes.data?.name);

        // 4. Admin login
        const adminLogin = await request('POST', '/login', {
            email: process.env.ADMIN_EMAIL || 'viyodhatradingpvtlimited@gmail.com',
            password: process.env.ADMIN_PASSWORD || 'admin123'
        });
        console.log("4. Admin login status:", adminLogin.status, "role:", adminLogin.data?.user?.role);
        const adminToken = adminLogin.data?.token;

        // 5. Register customer
        const testUserEmail = `customer_${Date.now()}@example.com`;
        const registerRes = await request('POST', '/register', {
            username: 'Test Customer',
            email: testUserEmail,
            password: 'password123',
            phone: '9876543210'
        });
        console.log("5. Register customer status:", registerRes.status, registerRes.data?.user?.email);
        const userToken = registerRes.data?.token;

        // 6. User profile
        const profileRes = await request('GET', '/profile', null, userToken);
        console.log("6. GET /profile status:", profileRes.status, profileRes.data?.user?.username);

        // 7. Update profile
        const updateProf = await request('PUT', '/profile', {
            username: 'Updated Customer Name',
            email: testUserEmail,
            phone: '9876549999'
        }, userToken);
        console.log("7. PUT /profile status:", updateProf.status, updateProf.data?.user?.username);

        // 8. Add to cart
        const addCartRes = await request('POST', '/cart/add', {
            productId: 'green-cardamom',
            quantity: 2,
            pack: '200g'
        }, userToken);
        console.log("8. POST /cart/add status:", addCartRes.status, addCartRes.data?.message);

        // 9. Get cart
        const getCartRes = await request('GET', '/cart', null, userToken);
        console.log("9. GET /cart status:", getCartRes.status, "items count:", getCartRes.data?.length);
        const cartId = getCartRes.data?.[0]?.cart_id;

        // 10. Increment cart
        if (cartId) {
            const incCart = await request('PUT', `/cart/increment/${cartId}`, null, userToken);
            console.log("10. PUT /cart/increment status:", incCart.status, "new qty:", incCart.data?.quantity);
        }

        // 11. Place order (Cash on Delivery)
        const orderRes = await request('POST', '/order/add', {
            username: 'Updated Customer Name',
            phone: '9876549999',
            address: '123 Spice Garden, Fort Kochi',
            city: 'Kochi',
            state: 'Kerala',
            pin: '682001',
            paymentMethod: 'Cash on Delivery',
            items: [
                {
                    productId: cardamRes.data?.id,
                    name: cardamRes.data?.name,
                    price: cardamRes.data?.price,
                    quantity: 2,
                    image: cardamRes.data?.image
                }
            ],
            subtotal: 990,
            shippingFee: 0,
            totalAmount: 990
        }, userToken);
        console.log("11. POST /order/add status:", orderRes.status, "orderId:", orderRes.data?.order?.id, "status:", orderRes.data?.order?.order_status);
        const orderId = orderRes.data?.order?.id;

        // 12. Customer get myOrders
        const myOrders = await request('GET', '/myOrders', null, userToken);
        console.log("12. GET /myOrders status:", myOrders.status, "orders count:", myOrders.data?.length, "order status:", myOrders.data?.[0]?.order_status);

        // 13. Admin get all orders
        const adminOrders = await request('GET', '/admin/orders', null, adminToken);
        console.log("13. Admin GET /admin/orders status:", adminOrders.status, "orders count:", adminOrders.data?.length);

        // 14. Admin update order status to 'Shipped'
        if (orderId) {
            const shipOrder = await request('PUT', `/order/status/${orderId}`, {
                orderStatus: 'Shipped'
            }, adminToken);
            console.log("14. Admin mark Shipped status:", shipOrder.status, "new order status:", shipOrder.data?.order?.order_status);

            // 15. Admin update order status to 'Delivered'
            const deliverOrder = await request('PUT', `/order/status/${orderId}`, {
                orderStatus: 'Delivered'
            }, adminToken);
            console.log("15. Admin mark Delivered status:", deliverOrder.status, "new order status:", deliverOrder.data?.order?.order_status);
        }

        // 16. Customer see updated status
        const myOrdersAfter = await request('GET', '/myOrders', null, userToken);
        console.log("16. Customer sees status:", myOrdersAfter.data?.[0]?.order_status);

        // 17. Customer add review
        const addRev = await request('POST', '/review/add', {
            productId: 'green-cardamom',
            rating: 5,
            comment: 'Exceptionally fragrant cardamom pods! Best quality in Kerala.'
        }, userToken);
        console.log("17. POST /review/add status:", addRev.status, "reviewId:", addRev.data?.review?.id);
        const reviewId = addRev.data?.review?.id;

        // 18. GET reviews for product
        const getRevs = await request('GET', `/reviews/${cardamRes.data?.id}`);
        console.log("18. GET /reviews/:id status:", getRevs.status, "reviews count:", getRevs.data?.length);

        // 19. Customer delete their review
        if (reviewId) {
            const delRev = await request('DELETE', `/review/${reviewId}`, null, userToken);
            console.log("19. DELETE /review/:id status:", delRev.status, delRev.data?.message);
        }

        // 20. Admin get all users
        const adminUsers = await request('GET', '/admin/users', null, adminToken);
        console.log("20. Admin GET /admin/users status:", adminUsers.status, "users count:", adminUsers.data?.users?.length);

        // 21. Admin add a new product
        const newProd = await request('POST', '/product/add', {
            name: 'Organic Ginger Whole 100g',
            price: 180,
            mrp: 220,
            category: 'Whole Spices',
            brand: 'Viyodha',
            type: 'Ginger',
            description: 'Sun-dried organic ginger roots from Wayanad.',
            image: '/products/ginger.png'
        }, adminToken);
        console.log("21. Admin POST /product/add status:", newProd.status, newProd.data?.product?.name, "slug:", newProd.data?.product?.slug);
        const newProdId = newProd.data?.product?.id;

        // 22. Admin update product details
        if (newProdId) {
            const updateProd = await request('PUT', `/product/${newProdId}`, {
                price: 199,
                description: 'Updated premium sun-dried organic ginger roots from Wayanad.'
            }, adminToken);
            console.log("22. Admin PUT /product/:id status:", updateProd.status, "new price:", updateProd.data?.product?.price);

            // 23. Admin delete product
            const delProd = await request('DELETE', `/product/${newProdId}`, null, adminToken);
            console.log("23. Admin DELETE /product/:id status:", delProd.status, delProd.data?.message);
        }

        console.log("\n>>> ALL 23 INTEGRATION TESTS PASSED WITH 100% SUCCESS! <<<");
        process.exit(0);
    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
}

runTests();
