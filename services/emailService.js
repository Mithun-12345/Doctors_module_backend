const nodemailer = require("nodemailer");

/**
 * Sends a welcome email with a link for the user to set their password.
 * @param {string} userEmail - The recipient's email address.
 * @param {string} setPasswordUrl - The unique URL for setting the password.
 */
const sendSetPasswordEmail = async (userEmail, setPasswordUrl) => {
  try {
    // Configure your email transporter for Brevo
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // From Brevo: smtp-relay.brevo.com
      port: process.env.EMAIL_PORT, // From Brevo: 587
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER, // Your Brevo login email
        pass: process.env.EMAIL_PASS, // Your Brevo Master Password
      },
    });

    const mailOptions = {
      from: `"Consult Homeopathy Clinic" <${process.env.EMAIL_USER}>`, // This MUST be your validated sender email in Brevo
      to: userEmail,
      subject: "Begin Your Healing Journey with Consult Homeopathy Clinic",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h1 style="color: #2c3e50;">Welcome to Consult Homeopathy Clinic!</h1>
          <p>We are so glad to have you with us. Your patient profile has been created, and the next step is to secure your account by setting a password.</p>
          <p>Please click the button below to create your password and log in to your dashboard.</p>
          <a href="${setPasswordUrl}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; margin: 20px 0;">
            Set Your Password
          </a>
          <p>If the button above doesn't work, you can copy and paste the following link into your browser:</p>
          <p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>
          <p>This link is valid for the next 10 minutes.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <div style="font-size: 12px; color: #7f8c8d;">
            <p>If you did not request this, please ignore this email.</p>
            <p>For any assistance, please contact us:</p>
            <p><strong>Phone:</strong> +91-9876543210 (Temporary)</p>
            <p><strong>Email:</strong> support.clinic@example.com (Temporary)</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Set password email sent successfully to:", userEmail);
  } catch (error) {
    console.error("Error sending 'set password' email:", error);
    // In a real application, you might add this failed job to a queue to retry later.
    throw new Error("Email could not be sent.");
  }
};
const sendPasswordResetEmail = async (userEmail, resetUrl) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // From Brevo: smtp-relay.brevo.com
      port: process.env.EMAIL_PORT, // From Brevo: 587
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER, // Your Brevo login email
        pass: process.env.EMAIL_PASS, // Your Brevo Master Password
      },
    });

    const mailOptions = {
      from: `"Consult Homeopathy Clinic" <${process.env.EMAIL_USER}>`, // This MUST be your validated sender email in Brevo
      to: userEmail,
      subject: "Password Reset Request for Your Account",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h1 style="color: #2c3e50;">Password Reset Request</h1>
          <p>We received a request to reset the password for your account.</p>
          <p>If you made this request, please click the button below to set a new password. If you did not make this request, you can safely ignore this email.</p>
          <a href="${resetUrl}" style="background-color: #e74c3c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; margin: 20px 0;">
            Reset Your Password
          </a>
          <p>This link is valid for the next 10 minutes.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully to:", userEmail);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Email could not be sent.");
  }
};


module.exports = { sendSetPasswordEmail,sendPasswordResetEmail};