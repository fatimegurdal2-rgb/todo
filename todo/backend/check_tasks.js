const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/fatime/Desktop/todo/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTasks() {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching tasks:", error);
    } else {
        console.log("Tasks in Supabase:");
        console.log(JSON.stringify(data, null, 2));
    }
}
checkTasks();
