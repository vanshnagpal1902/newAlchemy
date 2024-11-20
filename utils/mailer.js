const nodemailer = require('nodemailer');

// Create a function to get a fresh transporter
const getTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        // Shorter timeouts to fail fast
        connectionTimeout: 5000,
        socketTimeout: 5000,
        // Force IPv4
        family: 4
    });
};

// Non-blocking email send function
const sendEmailAsync = async (mailOptions) => {
    let transporter = null;
    try {
        transporter = getTransporter();
        
        // Set a timeout for the entire operation
        const emailPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Email timeout')), 10000);
        });

        // Race between email send and timeout
        const info = await Promise.race([emailPromise, timeoutPromise]);
        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Email error:', error.message);
        return false;
    } finally {
        if (transporter) {
            transporter.close();
        }
    }
};

// Update verification OTP function to be non-blocking
const sendVerificationOTP = async (userEmail, otp) => {
    const mailOptions = {
        from: {
            name: 'Alchemy Team',
            address: process.env.SMTP_USER
        },
        to: userEmail,
        subject: 'Email Verification - Alchemy',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">Verify Your Email</h2>
                <p>Your verification code is:</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                    <h1 style="color: #2c3e50; letter-spacing: 5px;">${otp}</h1>
                </div>
                <p>This code will expire in 10 minutes.</p>
            </div>
        `
    };

    // Send email in background
    sendEmailAsync(mailOptions).catch(console.error);
    return true; // Return immediately
};

// Update password reset function
const sendPasswordEmail = async (userEmail, password) => {
    const mailOptions = {
        from: {
            name: 'Alchemy Team',
            address: process.env.SMTP_USER
        },
        to: userEmail,
        subject: 'Your Alchemy Account Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #2c3e50; text-align: center;">Your Alchemy Account Password</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">
                    Here is the password you saved for accessing your Alchemy account:
                </p>
                <p style="font-size: 18px; font-weight: bold; color: #2c3e50; text-align: center;">
                    ${password}
                </p>
                <p style="font-size: 16px; color: #333;">
                    Please keep this information secure and do not share it with anyone.
                </p>
                <p style="font-size: 16px; color: #333;">Thank you,<br>The Alchemy Team</p>
            </div>
        `
        
    };

    // Send email in background
    sendEmailAsync(mailOptions).catch(console.error);
    return true; // Return immediately
};

// Update request notification function
const sendRequestNotification = async (userEmail, projectTitle, requestType) => {
    let subject, htmlContent;
    switch (requestType) {
        case 'project_application':
            subject = '🔥 New  Request';
            htmlContent = ` <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #2c3e50; margin-bottom: 0;">New Request Alert! 🚀</h1>
                            <p style="color: #666; font-size: 16px;">You are just one click away from your dream team!</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="font-size: 16px; color: #2c3e50;">
                                You have received a new application for your project:
                                <strong style="color: #3498db;">${projectTitle}</strong>
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.WEBSITE_URL}/requests" 
                                   style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                   Review Application Now
                                </a>
                            </div>
                        </div>
                    </div>`; 
            break;
        case 'application_accepted':
            subject = '🎉 Application Accepted';
            htmlContent = ` <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #2c3e50; margin-bottom: 0;">Great News! 🎊</h1>
                            <p style="color: #666; font-size: 16px;">Your application has been accepted!</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="font-size: 16px; color: #2c3e50;">
                                Your application for <strong style="color: #3498db;">${projectTitle}</strong> has been accepted.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.WEBSITE_URL}/" 
                                   style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                   Start Collaborating
                                </a>
                            </div>
                        </div>
                    </div>`; 
            break;
        case 'application_rejected':
            subject = 'Application Update';
            htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #2c3e50; margin-bottom: 0;">Application Update</h1>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="font-size: 16px; color: #2c3e50;">
                                Your application for <strong>${projectTitle}</strong> was not accepted at this time.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.WEBSITE_URL}/" 
                                   style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                   Explore More Projects
                                </a>
                            </div>
                        </div>
                    </div>`; // Your existing HTML
            break;
    }

    const mailOptions = {
        from: {
            name: 'Alchemy Team',
            address: process.env.SMTP_USER
        },
        to: userEmail,
        subject,
        html: htmlContent
    };

    // Send email in background
    sendEmailAsync(mailOptions).catch(console.error);
    return true; // Return immediately
};

module.exports = {
    sendVerificationOTP,
    sendPasswordEmail,
    sendRequestNotification
}; 
