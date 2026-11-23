const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'qt0w2fbm',
  api_key: process.env.CLOUDINARY_API_KEY || '994741817675717',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'tX6b_721684h2wS4dpCReqlFOr0',
  secure: true,
});

module.exports = cloudinary;
