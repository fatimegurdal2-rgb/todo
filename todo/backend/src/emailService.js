const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter
const createTransporter = () => {
    // If SMTP credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
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
        from: `"Notion Pano Hatırlatıcı" <${process.env.EMAIL_USER || 'noreply@notion-todo.com'}>`,
        to: toEmail,
        subject: `⏰ Hatırlatıcı: ${taskTitle}`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e9e9e7; border-radius: 8px;">
                <div style="font-size: 28px; margin-bottom: 12px;">🌙 <b>Yönetim Paneli</b></div>
                <h2 style="color: #37352f; margin-bottom: 8px;">Görev Zamanı Geldi!</h2>
                <p style="color: #787774; font-size: 15px; margin-bottom: 20px;">Panonuzda belirlediğiniz görevin hatırlatma saati ulaştı:</p>
                
                <div style="background-color: #f7f7f5; padding: 16px; border-radius: 6px; border-left: 4px solid #2383e2; margin-bottom: 20px;">
                    <div style="font-size: 16px; font-weight: 600; color: #37352f; margin-bottom: 4px;">${taskTitle}</div>
                    <div style="font-size: 13px; color: #337ea9;">⏰ Zaman: ${formattedDate}</div>
                </div>

                <p style="font-size: 13px; color: #9b9a97; margin-top: 24px; border-top: 1px solid #e9e9e7; padding-top: 12px;">
                    Bu e-posta Notion Pano Hatırlatıcı Servisi tarafından otomatik olarak gönderilmiştir.
                </p>
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
