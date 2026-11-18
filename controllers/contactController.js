const nodemailer = require("nodemailer");

exports.sendContactEmail = async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and message are required.",
            });
        }

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Viyodha Contact Form" <${process.env.EMAIL_USER}>`,
                to: process.env.EMAIL_USER,
                replyTo: email,
                subject: `New Enquiry from ${name} (Viyodha Spices)`,
                text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "Not provided"}\n\nMessage:\n${message}`,
                html: `
                    <h2>New Enquiry from Viyodha Spices Website</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
                    <p><strong>Message:</strong></p>
                    <p>${message}</p>
                `,
            });
        } else {
            console.log(`[Contact Form] From: ${name} <${email}> (${phone || 'No phone'}): ${message}`);
        }

        return res.status(200).json({
            success: true,
            message: "Thank you for reaching out! We will get back to you shortly.",
        });
    } catch (error) {
        console.error("Contact form error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to send enquiry. Please try again later.",
            error: error.message,
        });
    }
};
