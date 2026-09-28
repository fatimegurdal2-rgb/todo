const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { sendReminderEmail } = require('./emailService');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY && !SUPABASE_URL.includes('BURAYA')) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Check and send pending reminders (can be called by cron or by HTTP endpoint /api/cron-check)
const checkAndSendReminders = async () => {
    if (!supabase) return { count: 0, sent: 0 };

    try {
        const nowMs = Date.now();
        const trFormatted = new Date(nowMs + (3 * 60 * 60 * 1000)).toISOString().slice(0, 16).replace('T', ' ');
        console.log(`[Reminder Check] Kontrol başlatıldı. Türkiye Saati: ${trFormatted}, UTC: ${new Date(nowMs).toISOString()}`);

        // Fetch all unfinished tasks where reminder has not been sent
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .neq('status', 'done')
            .or('reminder_sent.is.null,reminder_sent.eq.false')
            .not('time', 'is', null);

        if (error) {
            console.error('[Reminder Error] Görevler sorgulanırken hata:', error.message);
            return { error: error.message };
        }

        if (!tasks || tasks.length === 0) {
            return { count: 0, sent: 0 };
        }

        let sentCount = 0;

        for (const task of tasks) {
            if (!task.time) continue;

            // Normalize task.time to exact Unix millisecond timestamp
            // Formats: "YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss", etc.
            // If string has no timezone offset, treat it as Turkey Time (+03:00)
            const cleanTime = task.time.slice(0, 16); // "2026-09-27T20:15"
            const isoStr = task.time.includes('+') || task.time.endsWith('Z')
                ? task.time
                : `${cleanTime}:00+03:00`;

            const taskMs = new Date(isoStr).getTime();

            if (isNaN(taskMs)) {
                console.warn(`[Reminder Warning] Geçersiz tarih formatı: ${task.time}`);
                continue;
            }

            // Trigger conditions:
            // 1. Task time is due: taskMs <= nowMs (Tam zamanı geldi veya geçti)
            // 2. Task is not older than 48 hours (Eski unutulmuş görevleri spamlememek için)
            const isDue = taskMs <= nowMs;
            const notTooOld = (nowMs - taskMs) < 48 * 60 * 60 * 1000;

            if (isDue && notTooOld) {
                const recipientEmail = task.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL;

                if (recipientEmail) {
                    console.log(`[Reminder] "${task.title}" zamanı geldi! Alıcı: ${recipientEmail}, Görev Saati: ${task.time}`);
                    const sent = await sendReminderEmail(recipientEmail, task.title, task.time);

                    if (sent) {
                        sentCount++;
                        await supabase
                            .from('tasks')
                            .update({ reminder_sent: true })
                            .eq('id', task.id);
                        console.log(`[Reminder] Görev "${task.title}" için bildirim işaretlendi.`);
                    }
                }
            } else if (taskMs < nowMs && !notTooOld) {
                // 48 saatten daha eski görevleri sessizce 'gönderildi' olarak işaretle (kuyruğu tıkamasın)
                await supabase
                    .from('tasks')
                    .update({ reminder_sent: true })
                    .eq('id', task.id);
            }
        }

        return { count: tasks.length, sent: sentCount };
    } catch (err) {
        console.error('[Reminder Unhandled Error]:', err.message);
        return { error: err.message };
    }
};

const startReminderCron = () => {
    console.log('[Cron] Hatırlatıcı zamanlayıcı servisi başlatıldı (Her dakika kontrol edilir).');

    // Runs every minute: * * * * *
    cron.schedule('* * * * *', async () => {
        await checkAndSendReminders();
    });
};

module.exports = {
    startReminderCron,
    checkAndSendReminders
};
