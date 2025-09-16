const nodemailer = require("nodemailer");
// --- HELPER FUNCTION TO SEND EMAIL ---
// (It's better to move this to a separate 'services/emailService.js' file in a real app)
const sendTemporaryPasswordEmail = async (userEmail, tempPassword) => {
  try {
    // Configure your email transporter (using Gmail as an example)
    // You'll need to use an "App Password" for Gmail if you have 2FA enabled.
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your email address from .env file
        pass: process.env.EMAIL_PASS, // Your email password or app password from .env
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: "Welcome! Your Temporary Password",
      html: `
        <h1>Welcome to our Clinic!</h1>
        <p>Your account has been created successfully.</p>
        <p>Please use the following temporary password to log in for the first time: <strong>${tempPassword}</strong></p>
        <p>You will be prompted to change your password immediately after logging in.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Temporary password email sent successfully to:", userEmail);
  } catch (error) {
    console.error("Error sending temporary password email:", error);
    // You might want to log this error but not block the user creation process
  }
};

module.exports = { sendTemporaryPasswordEmail };
