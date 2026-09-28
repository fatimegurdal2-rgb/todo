const fetch = require('node-fetch');
require('dotenv').config();

const sendReminderEmail = async (toEmail, taskTitle, taskTime) => {
    try {
        const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
        const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
        const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
        const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY; // Optional depending on EmailJS settings

        if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
            console.log('[Email] EmailJS ayarları eksik. Lütfen Render ortam değişkenlerini (Environment) kontrol edin.');
            return false;
        }

        // Use native fetch if available (Node 18+), otherwise use node-fetch
        const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        const response = await fetchFn('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_id: SERVICE_ID,
                template_id: TEMPLATE_ID,
                user_id: PUBLIC_KEY,
        // Tarihi Türkiye saat dilimine uygun formatla
        let formattedTime = taskTime;
        try {
            if (taskTime) {
                const dateObj = taskTime.includes('+') || taskTime.endsWith('Z')
                    ? new Date(taskTime)
                    : new Date(`${taskTime}:00+03:00`);

                if (!isNaN(dateObj.getTime())) {
                    formattedTime = dateObj.toLocaleString('tr-TR', {
                        timeZone: 'Europe/Istanbul',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }
        } catch(e) {
            formattedTime = taskTime;
        }

        const response = await fetchFn('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_id: SERVICE_ID,
                template_id: TEMPLATE_ID,
                user_id: PUBLIC_KEY,
                accessToken: PRIVATE_KEY || undefined,
                template_params: {
                    to_email: toEmail,
                    title: taskTitle,
                    time: formattedTime
                }
            })
        });

        if (response.ok) {
            console.log(`[Email] Başarıyla EmailJS üzerinden gönderildi -> ${toEmail}`);
            return true;
        } else {
            const errorText = await response.text();
            console.error('[Email] Gönderim hatası (EmailJS API):', errorText);
            return false;
        }

    } catch (error) {
        console.error('[Email] Gönderim hatası:', error.message);
        return false;
    }
};

module.exports = {
    sendReminderEmail
};
