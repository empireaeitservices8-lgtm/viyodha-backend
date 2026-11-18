// Public logout controller
exports.logoutController = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Logout successful",
    });
};
