const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const cartController = require('../controllers/cartController');
const orderController = require('../controllers/orderController');
const reviewController = require('../controllers/reviewController');
const contactController = require('../controllers/contactController');
const adminMiddleware = require('../middlewares/adminMiddleware');
const jwtMiddleware = require('../middlewares/jwtMiddleware');
const multerMiddleware = require('../middlewares/multerMiddleware');

const router = new express.Router();

// ======================== Public Routes ========================
// Auth
router.post('/register', userController.registerController);
router.post('/login', userController.loginController);
router.post('/logout', authController.logoutController);

// Products
router.get('/products', productController.getAllProductsController);
router.get('/product/:id', productController.viewProductController);

// Reviews (Public read)
router.get('/reviews/:productId', reviewController.getProductReviewsController);

// Contact / Enquiries
router.post('/send', contactController.sendContactEmail);
router.post('/contact', contactController.sendContactEmail);


// ======================== Admin Routes ========================
// Product management
router.post('/product/add', adminMiddleware, multerMiddleware.single('image'), productController.addProductController);
router.put('/product/:id', adminMiddleware, multerMiddleware.single('image'), productController.updateProductController);
router.delete('/product/:id', adminMiddleware, productController.deleteProductController);

// User management
router.get('/admin/users', adminMiddleware, userController.getAllUsersController);
router.delete('/admin/users/:id', adminMiddleware, userController.deleteUserController);

// Order management
router.get('/admin/orders', adminMiddleware, orderController.getAllOrdersController);
router.put('/order/status/:id', adminMiddleware, orderController.updateOrderStatusController);

// Review moderation
router.delete('/admin/review/:id', adminMiddleware, reviewController.deleteReviewController);


// ======================== Authenticated User Routes ========================
// Profile (User & Admin)
router.get('/profile', jwtMiddleware, userController.getMyProfileController);
router.put('/profile', jwtMiddleware, userController.updateMyProfileController);

// Cart
router.post('/cart/add', jwtMiddleware, cartController.addToCartController);
router.get('/cart', jwtMiddleware, cartController.getCartController);
router.put('/cart/increment/:cartId', jwtMiddleware, cartController.incrementQuantityController);
router.put('/cart/decrement/:cartId', jwtMiddleware, cartController.decrementQuantityController);
router.delete('/cart/remove/:cartId', jwtMiddleware, cartController.removeCartItemController);
router.delete('/cart/remove', jwtMiddleware, cartController.removeAllCartItemsController);

// Orders
router.post('/order/add', jwtMiddleware, orderController.addOrderController);
router.get('/myOrders', jwtMiddleware, orderController.getMyOrdersController);
router.get('/order/:id', jwtMiddleware, orderController.viewOrderController);
router.put('/myOrders/cancel/:id', jwtMiddleware, orderController.cancelMyOrderController);

// Reviews
router.post('/review/add', jwtMiddleware, reviewController.addReviewController);
router.get('/myReviews', jwtMiddleware, reviewController.getMyReviewsController);
router.delete('/review/:id', jwtMiddleware, reviewController.deleteReviewController);

module.exports = router;
