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

const startReminderCron = () => {
    console.log('[Cron] Hatırlatıcı zamanlayıcı servisi başlatıldı (Her dakika kontrol edilir).');

    // Runs every minute: * * * * *
    cron.schedule('* * * * *', async () => {
        if (!supabase) {
            // Supabase not yet configured
            return;
        }

        try {
            // Generate current time in YYYY-MM-DDTHH:mm format specifically for Turkey Time (UTC+3)
            const d = new Date();
            const istDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
            const localNow = istDate.toISOString().slice(0, 16);
            
            // Find tasks where time <= localNow
            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('*')
                .lte('time', localNow)
                .neq('status', 'done')
                .or('reminder_sent.is.null,reminder_sent.eq.false')
                .not('time', 'is', null);

            if (error) {
                console.error('[Cron Error] Görevler sorgulanırken hata:', error.message);
                return;
            }

            if (tasks && tasks.length > 0) {
                console.log(`[Cron] Zamanı gelen ${tasks.length} adet hatırlatıcı bulundu.`);

                for (const task of tasks) {
                    const recipientEmail = task.user_email || process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev';

                    if (recipientEmail) {
                        const sent = await sendReminderEmail(recipientEmail, task.title, task.time);
                        if (sent) {
                            // Mark as sent in Supabase
                            await supabase
                                .from('tasks')
                                .update({ reminder_sent: true })
                                .eq('id', task.id);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Cron Unhandled Error]:', err.message);
        }
    });
};

module.exports = {
    startReminderCron
};
