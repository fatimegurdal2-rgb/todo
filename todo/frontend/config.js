// ============================================================
// SUPABASE & CANLI SUNUCU BAĞLANTI AYARLARI
// 
// Supabase panelinden (supabase.com) aldığınız URL ve Anon Key'i
// aşağıdaki tırnakların içine yapıştırmanız yeterlidir.
// Bilgileri girmeden önce de uygulama yerel hafızayla (localStorage)
// sorunsuz çalışmaya devam eder.
// ============================================================

const SUPABASE_CONFIG = {
    // Supabase Dashboard -> Project Settings -> API kısmından alabilirsiniz:
    url: '', // Örn: 'https://xyzabcdefghijklm.supabase.co'
    anonKey: '' // Örn: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

const BACKEND_CONFIG = {
    // Render'a yüklediğinizde Render'ın size verdiği Web Service adresi:
    apiUrl: 'http://localhost:5000' // Örn: 'https://todo-backend-xyz.onrender.com'
};
