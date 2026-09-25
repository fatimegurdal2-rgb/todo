const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const createTransporter = () => {
    // If SMTP credentials are provided
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            service: 'gmail', // Use Gmail natively to bypass Render IPv6/Port connection issues
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    // Fallback logger transporter if not yet configured
    return null;
};

const sendReminderEmail = async (toEmail, taskTitle, taskTime) => {
    const transporter = createTransporter();
    const formattedDate = new Date(taskTime).toLocaleString('tr-TR');

    const mailOptions = {
        from: `"Notion Pano Hatırlatıcı" <${process.env.SMTP_FROM || 'onboarding@resend.dev'}>`,
        to: toEmail,
        subject: `⏰ Hatırlatıcı: ${taskTitle}`,
        html: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 550px; margin: 0 auto; padding: 32px; border: 1px solid #EAEAEA; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
                    <div style="font-size: 14px; font-weight: 600; color: #6B7280; letter-spacing: 1px; text-transform: uppercase;">Todo Workspace</div>
                </div>
                <h2 style="color: #111827; font-size: 24px; text-align: center; margin-bottom: 12px;">Planlanan Görevinizin Zamanı Geldi</h2>
                <p style="color: #4B5563; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 32px;">Çalışma alanınızda planladığınız aşağıdaki görevin zamanı şu an itibarıyla gelmiştir. Lütfen ilgili işlemi gerçekleştiriniz.</p>
                
                <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; border-left: 4px solid #3B82F6; margin-bottom: 32px;">
                    <div style="font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px;">${taskTitle}</div>
                    <div style="font-size: 14px; color: #3B82F6; display: flex; align-items: center;">
                        <span style="margin-right: 6px;">🕒</span> Planlanan Zaman: <b>${formattedDate}</b>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a href="https://todo-eosin-delta.vercel.app" style="display: inline-block; padding: 12px 24px; background-color: #111827; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px; font-size: 15px;">Çalışma Alanına Git</a>
                </div>

                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #EAEAEA; text-align: center;">
                    <p style="font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                        Bu sistem mesajı, Todo Workspace üzerinden kurduğunuz hatırlatıcıya istinaden otomatik olarak gönderilmiştir.<br>
                        © 2026 Todo Workspace. Tüm hakları saklıdır.
                    </p>
                </div>
            </div>
        `
    };

    if (transporter) {
        try {
            const info = await transporter.sendMail(mailOptions);
            console.log(`[Email] Hatırlatıcı gönderildi: ${toEmail} - MessageID: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error('[Email] Gönderim hatası:', error.message);
            return false;
        }
    } else {
        console.log(`[Email Mock Modu] E-posta ayarlanmamış. Hatırlatıcı simüle edildi: Kime: ${toEmail} | Görev: "${taskTitle}" | Zaman: ${formattedDate}`);
        return true;
    }
};

module.exports = {
    sendReminderEmail
};
