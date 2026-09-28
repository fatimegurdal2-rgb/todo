const express = require('express');
const cors = require('cors');
const { startReminderCron, checkAndSendReminders } = require('./src/cronJob');
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
// Direct reminder endpoint (called from frontend or external scheduler)
app.post('/api/send-reminder', async (req, res) => {
    const { taskId, email, title, time } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'E-posta adresi gereklidir.' });
    }

    try {
        const success = await sendReminderEmail(
            email,
            title || 'Görev Hatırlatıcı',
            time || new Date().toISOString()
        );

        if (success && taskId) {
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase.from('tasks').update({ reminder_sent: true }).eq('id', taskId);
            }
        }

        res.json({ success, message: 'Hatırlatıcı e-posta başarıyla işlendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// External cron trigger (can be pinged every 1-5 minutes by cron-job.org or uptimerobot to keep Render awake and on time)
app.get('/api/cron-check', async (req, res) => {
    try {
        const result = await checkAndSendReminders();
        res.json({
            status: 'ok',
            serverTimeUTC: new Date().toISOString(),
            turkeyTime: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16),
            result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Debug endpoint to inspect server time and EmailJS / Supabase status
app.get('/debug', async (req, res) => {
    const nowUtc = new Date();
    const turkeyDate = new Date(nowUtc.getTime() + (3 * 60 * 60 * 1000));
    
    let debugInfo = {
        serverTimeUTC: nowUtc.toISOString(),
        turkeyTimeCalculated: turkeyDate.toISOString().slice(0, 16),
        supabaseConfigured: !!process.env.SUPABASE_URL,
        emailJsConfigured: !!(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY),
        supabaseTest: 'Not started'
    };

    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
        
        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: tasks, error: supabaseError } = await supabase.from('tasks').select('*').limit(3);
            if (supabaseError) {
                debugInfo.supabaseTest = 'ERROR: ' + supabaseError.message;
            } else {
                debugInfo.supabaseTest = `SUCCESS: Found ${tasks ? tasks.length : 0} sample tasks.`;
            }
        } else {
            debugInfo.supabaseTest = 'SKIPPED: Supabase credentials not set.';
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
