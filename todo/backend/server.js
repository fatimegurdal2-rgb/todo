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

// Debug endpoint to test everything from the browser
app.get('/debug', async (req, res) => {
    let debugInfo = {
        serverTimeUTC: new Date().toISOString(),
        supabaseUrl: process.env.SUPABASE_URL || 'MISSING',
        smtpHost: process.env.SMTP_HOST || 'MISSING',
        smtpUser: process.env.SMTP_USER || 'MISSING',
        supabaseTest: 'Not started',
        emailTest: 'Not started'
    };

    try {
        // Test Supabase
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
            process.env.SUPABASE_URL || 'https://missing.supabase.co', 
            process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing'
        );
        
        const { data: tasks, error: supabaseError } = await supabase.from('tasks').select('*').limit(1);
        if (supabaseError) {
            debugInfo.supabaseTest = 'ERROR: ' + supabaseError.message;
        } else {
            debugInfo.supabaseTest = `SUCCESS: Found ${tasks ? tasks.length : 0} tasks.`;
        }

        // Test Email
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        try {
            await transporter.verify();
            debugInfo.emailTest = 'SUCCESS: SMTP login verified!';
        } catch (emailErr) {
            debugInfo.emailTest = 'ERROR: ' + emailErr.message;
        }

        res.json(debugInfo);
    } catch (globalErr) {
        debugInfo.globalError = globalErr.message;
        res.status(500).json(debugInfo);
    }
});

// Start Cron Service
startReminderCron();

// Start Server
app.listen(PORT, () => {
    console.log(`[Server] Backend sunucusu ${PORT} portunda çalışıyor.`);
});
