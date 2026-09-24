const express = require('express');
const cors = require('cors');
const { startReminderCron } = require('./src/cronJob');
const { sendReminderEmail } = require('./src/emailService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (for Render)
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Todo Notion Backend & Cron Reminder Service',
        timestamp: new Date().toISOString()
    });
});

// Manual test email endpoint
app.post('/api/send-test-email', async (req, res) => {
    const { email, title, time } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
    }

    try {
        const success = await sendReminderEmail(
            email,
            title || 'Test Görevi',
            time || new Date().toISOString()
        );
        res.json({ success, message: 'Hatırlatıcı e-posta isteği işlendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Cron Service
startReminderCron();

// Start Server
app.listen(PORT, () => {
    console.log(`[Server] Backend sunucusu ${PORT} portunda çalışıyor.`);
});
