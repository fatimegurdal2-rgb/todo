/**
 * Todo - Notion Stili Uygulama Mantığı & Durum Motoru
 * Özellikler: Notion Tasarımı, Oturum Yönetimi, 3 Sütunlu Pano (İncelemede kaldırıldı), Dinamik İstatistikler, Otomatik Kayıt
 */

// --- Safe Storage Utility ---
const safeStorage = {
    get(key) {
        try { return localStorage.getItem(key); } catch (e) { return window._memStore ? window._memStore[key] : null; }
    },
    set(key, val) {
        try { localStorage.setItem(key, val); } catch (e) { if (!window._memStore) window._memStore = {}; window._memStore[key] = val; }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) { if (window._memStore) delete window._memStore[key]; }
    }
};

// --- State ---
let currentUser = null;
let authMode = 'login'; // 'login' | 'register'
let tasks = [];
let activeFilter = 'all'; // 'all' | 'mine' | 'high'
let searchQuery = '';
let currentSort = 'default'; // 'default' | 'date'
let selectedPriority = 'medium';

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSupabase();
    initAuth();
    setupBoardDragAndDrop();
    setupSearch();
    setupGlobalClickListeners();
    startLiveBoardClock();
});

// ============================================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================================
function initAuth() {
    const savedUser = safeStorage.get('todo_user') || safeStorage.get('taskflow_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            loadTasks();
            initNotes();
            renderAuthenticatedState();
            return;
        } catch(e) {
            safeStorage.remove('todo_user');
            safeStorage.remove('taskflow_user');
        }
    }
    currentUser = null;
    tasks = [];
    postits = [];
    showAuthScreen();
}

function showAuthScreen() {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    if (authScreen) authScreen.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
}

function renderAuthenticatedState() {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    if (authScreen) authScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (!currentUser) return;

    const navAvatar = document.getElementById('navUserAvatar');
    const navName = document.getElementById('navUserName');
    const dropName = document.getElementById('dropdownUserName');
    const dropEmail = document.getElementById('dropdownUserEmail');

    const displayName = currentUser.name || 'Kullanıcı';
    const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

    if (navAvatar) navAvatar.textContent = initial;
    if (navName) navName.textContent = displayName;
    if (dropName) dropName.textContent = displayName;
    if (dropEmail) dropEmail.textContent = currentUser.email || 'demo@todo.app';

    renderBoard();
}

function switchAuthTab(mode) {
    authMode = mode;
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const nameField = document.getElementById('fieldNameWrapper');
    const submitBtn = document.getElementById('btnAuthSubmit');
    const subtitle = document.getElementById('authSubtitle');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        nameField.classList.add('hidden');
        submitBtn.querySelector('span').textContent = 'Giriş Yap ve Başla';
        subtitle.textContent = 'Düşüncelerinizi, görevlerinizi ve projelerinizi düzenleyin.';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        nameField.classList.remove('hidden');
        submitBtn.querySelector('span').textContent = 'Hesap Oluştur';
        subtitle.textContent = 'Ücretsiz çalışma alanınızı birkaç saniyede başlatın.';
    }
}
window.switchAuthTab = switchAuthTab;

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
}
window.togglePasswordVisibility = togglePasswordVisibility;

function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const nameInput = document.getElementById('authName');
    const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : (email.split('@')[0] || 'Kullanıcı');

    if (!email || !password) {
        showToast('Lütfen gerekli alanları doldurun.');
        return;
    }

    currentUser = {
        id: 'usr_' + Date.now(),
        name: name,
        email: email,
        avatar: name.charAt(0).toUpperCase()
    };

    safeStorage.set('todo_user', JSON.stringify(currentUser));

    // Yeni hesap oluşturulduğunda eski kayıtlar sıfırlansın, 0 görevle tertemiz başlasın
    if (authMode === 'register') {
        tasks = [];
        postits = [];
        saveTasks();
        savePostits();
    } else {
        loadTasks();
        initNotes();
    }

    renderAuthenticatedState();
    renderBoard();
    showToast(`Hoş geldiniz, ${currentUser.name}!`);
}
window.handleAuthSubmit = handleAuthSubmit;

// E-posta ile Şifre Sıfırlama & Doğrulama Kodu Mantığı (Yukarı Taşındı)
let currentRecoveryCode = '';
let currentRecoveryEmail = '';

function openEmailRecovery() {
    const authForm = document.getElementById('authForm');
    const tabsWrapper = document.getElementById('authTabsWrapper');
    const recoveryPanel = document.getElementById('emailRecoveryPanel');
    const guestLink = document.querySelector('.auth-guest-link');
    const authSubtitle = document.getElementById('authSubtitle');

    if (authForm) authForm.classList.add('hidden');
    if (tabsWrapper) tabsWrapper.classList.add('hidden');
    if (guestLink) guestLink.classList.add('hidden');
    if (authSubtitle) authSubtitle.classList.add('hidden'); // Başlığı küçülterek e-posta panelini ve butonunu yukarı taşır

    if (recoveryPanel) {
        recoveryPanel.classList.remove('hidden');
        const loginEmail = document.getElementById('authEmail');
        const recEmailInput = document.getElementById('recoveryEmail');
        if (loginEmail && recEmailInput) {
            recEmailInput.value = loginEmail.value.trim();
        }
        const emailStep = document.getElementById('recoveryEmailStep');
        const codeStep = document.getElementById('recoveryCodeStep');
        if (emailStep) emailStep.classList.remove('hidden');
        if (codeStep) codeStep.classList.add('hidden');
        if (recEmailInput) setTimeout(() => recEmailInput.focus(), 60);
    }
}
window.openEmailRecovery = openEmailRecovery;
window.togglePhoneRecovery = (show) => { if (show) openEmailRecovery(); else closeEmailRecovery(); };

function closeEmailRecovery() {
    const authForm = document.getElementById('authForm');
    const tabsWrapper = document.getElementById('authTabsWrapper');
    const recoveryPanel = document.getElementById('emailRecoveryPanel');
    const guestLink = document.querySelector('.auth-guest-link');
    const authSubtitle = document.getElementById('authSubtitle');

    if (recoveryPanel) recoveryPanel.classList.add('hidden');
    if (authForm) authForm.classList.remove('hidden');
    if (tabsWrapper) tabsWrapper.classList.remove('hidden');
    if (guestLink) guestLink.classList.remove('hidden');
    if (authSubtitle) authSubtitle.classList.remove('hidden');
}
window.closeEmailRecovery = closeEmailRecovery;

function handleSendRecoveryCode(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('recoveryEmail');
    const emailVal = emailInput ? emailInput.value.trim() : '';

    if (!emailVal || !emailVal.includes('@')) {
        showToast('Lütfen geçerli bir e-posta adresi girin.');
        return;
    }

    currentRecoveryEmail = emailVal;
    currentRecoveryCode = String(Math.floor(100000 + Math.random() * 900000));

    // Bildirimle doğrulama kodunu göster
    showToast(`📩 Doğrulama kodunuz: ${currentRecoveryCode} (${emailVal} adresine gönderildi)`);

    const emailStep = document.getElementById('recoveryEmailStep');
    const codeStep = document.getElementById('recoveryCodeStep');
    if (emailStep) emailStep.classList.add('hidden');
    if (codeStep) {
        codeStep.classList.remove('hidden');
        const codeInput = document.getElementById('recoveryCodeInput');
        if (codeInput) {
            codeInput.value = currentRecoveryCode; // Otomatik de doldur
            setTimeout(() => codeInput.focus(), 60);
        }
    }
}
window.handleSendRecoveryCode = handleSendRecoveryCode;
window.handlePhoneRecoverySubmit = handleSendRecoveryCode;

function handleVerifyAndResetPassword() {
    const codeInput = document.getElementById('recoveryCodeInput');
    const passInput = document.getElementById('recoveryNewPassword');
    const codeVal = codeInput ? codeInput.value.trim() : '';
    const passVal = passInput ? passInput.value.trim() : '';

    if (!codeVal) {
        showToast('Lütfen doğrulama kodunu girin.');
        return;
    }
    if (codeVal !== currentRecoveryCode) {
        showToast('Hatalı doğrulama kodu!');
        return;
    }
    if (passVal && passVal.length < 4) {
        showToast('Yeni şifre en az 4 karakter olmalıdır.');
        return;
    }

    showToast('✅ Şifreniz güncellendi! Giriş yapabilirsiniz.');
    closeEmailRecovery();
    const loginEmail = document.getElementById('authEmail');
    const loginPass = document.getElementById('authPassword');
    if (loginEmail) loginEmail.value = currentRecoveryEmail;
    if (loginPass && passVal) loginPass.value = passVal;
}
window.handleVerifyAndResetPassword = handleVerifyAndResetPassword;

function quickDemoLogin() {
    currentUser = {
        id: 'demo_user',
        name: 'Fatime Yılmaz',
        email: 'fatime@todo.app',
        avatar: 'F'
    };
    safeStorage.set('todo_user', JSON.stringify(currentUser));
    loadTasks();
    initNotes();
    renderAuthenticatedState();
    showToast('Demo çalışma alanı açıldı. Hoş geldiniz!');
}
window.quickDemoLogin = quickDemoLogin;

function guestLogin() {
    currentUser = {
        id: 'guest_user',
        name: 'Misafir Kullanıcı',
        email: 'misafir@todo.app',
        avatar: 'M'
    };
    safeStorage.set('todo_user', JSON.stringify(currentUser));
    loadTasks();
    initNotes();
    renderAuthenticatedState();
    showToast('Misafir olarak giriş yapıldı.');
}
window.guestLogin = guestLogin;

function logoutUser() {
    safeStorage.remove('todo_user');
    safeStorage.remove('taskflow_user');
    currentUser = null;
    
    // Eski kullanıcının kayıtlarını temizle
    tasks = [];
    postits = [];

    // Form alanlarını sıfırla
    const emailInput = document.getElementById('authEmail');
    const passInput = document.getElementById('authPassword');
    const nameInput = document.getElementById('authName');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    if (nameInput) nameInput.value = '';

    const dropdown = document.getElementById('userDropdownMenu');
    if (dropdown) dropdown.classList.add('hidden');
    showAuthScreen();
    showToast('Oturum kapatıldı.');
}
window.logoutUser = logoutUser;

function forgotPasswordMock() {
    showToast('Şifre sıfırlama bağlantısı e-postanıza iletildi.');
}
window.forgotPasswordMock = forgotPasswordMock;

function toggleUserDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('userDropdownMenu');
    if (dropdown) dropdown.classList.toggle('hidden');
}
window.toggleUserDropdown = toggleUserDropdown;

// ============================================================
// THEME (DARK / LIGHT MODE)
// ============================================================
function initTheme() {
    const savedTheme = safeStorage.get('todo_theme') || safeStorage.get('taskflow_theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.className = 'fa-solid fa-sun';
        } else {
            themeIcon.className = 'fa-solid fa-moon';
        }
    }
    safeStorage.set('todo_theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(nextTheme === 'dark' ? 'Koyu tema aktif' : 'Aydınlık tema aktif');
}
window.toggleTheme = toggleTheme;

// ============================================================
// NAVIGATION & VIEWS
// ============================================================
function switchView(viewId, clickedElement) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });

    document.querySelectorAll('.nav-tab-item').forEach(tab => {
        tab.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }

    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        const correspondingTab = document.getElementById(viewId === 'view-board' ? 'nav-board' : 'nav-notes');
        if (correspondingTab) correspondingTab.classList.add('active');
    }

    if (viewId === 'view-board') {
        renderBoard();
    } else if (viewId === 'view-notes') {
        renderPostitWall();
    }
}
window.switchView = switchView;

// ============================================================
// TASKS & KANBAN LOGIC (3 COLUMNS: todo, progress, done)
// ============================================================
function getDefaultTasks() {
    const now = new Date();
    const toISODate = (d, timeStr) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${timeStr}`;
    };

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 4);

    return [
        {
            id: '1',
            title: 'Bugün Tasarım Toplantısı ve UI/UX İncelemesi',
            status: 'todo',
            priority: 'high',
            tag: 'Tasarım',
            time: toISODate(today, '14:30')
        },
        {
            id: '2',
            title: 'Bugün Frontend API ve Durum Yönetimi Entegrasyonu',
            status: 'progress',
            priority: 'medium',
            tag: 'Geliştirme',
            time: toISODate(today, '18:00')
        },
        {
            id: '3',
            title: 'Gecikmiş Proje Dokümantasyonu & Sunum',
            status: 'done',
            priority: 'high',
            tag: 'Toplantı',
            time: toISODate(yesterday, '16:00')
        },
        {
            id: '4',
            title: 'Yarın Sprint Planlama ve Görev Dağılımı',
            status: 'todo',
            priority: 'low',
            tag: 'Pazarlama',
            time: toISODate(tomorrow, '11:00')
        },
        {
            id: '5',
            title: 'Kişisel Verimlilik ve Not Sistemi İyileştirmesi',
            status: 'progress',
            priority: 'medium',
            tag: 'Kişisel',
            time: toISODate(nextWeek, '15:30')
        }
    ];
}

function getUserStorageKey(baseKey) {
    if (!currentUser || !currentUser.email) {
        return `${baseKey}_guest`;
    }
    const safeEmail = encodeURIComponent(currentUser.email.toLowerCase().trim()).replace(/[^a-zA-Z0-9_]/g, '_');
    return `${baseKey}_${safeEmail}`;
}

let supabaseClient = null;
function initSupabase() {
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
        if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && !SUPABASE_CONFIG.url.includes('BURAYA') && SUPABASE_CONFIG.url.startsWith('http')) {
            try {
                supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
                console.log('[Supabase] Bulut veritabanı aktif!');
            } catch(e) {
                console.warn('[Supabase] Başlatılamadı:', e.message);
            }
        }
    }
}

async function syncTasksToSupabase() {
    if (!supabaseClient || !currentUser || !currentUser.email) return;
    try {
        for (const t of tasks) {
            await supabaseClient.from('tasks').upsert({
                id: String(t.id),
                title: t.title,
                status: t.status || 'todo',
                priority: t.priority || 'medium',
                tag: t.tag || 'Geliştirme',
                time: t.time || null,
                user_email: currentUser.email
            });
        }
    } catch(err) {
        console.warn('[Supabase Sync]:', err.message);
    }
}

async function fetchTasksFromSupabase() {
    if (!supabaseClient || !currentUser || !currentUser.email) return;
    try {
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_email', currentUser.email);

        if (!error && data && data.length > 0) {
            tasks = data.map(item => ({
                id: String(item.id),
                title: item.title,
                status: item.status || 'todo',
                priority: item.priority || 'medium',
                tag: item.tag || 'Geliştirme',
                time: item.time || ''
            }));
            const key = getUserStorageKey('todo_tasks');
            safeStorage.set(key, JSON.stringify(tasks));
            renderBoard();
        }
    } catch(err) {
        console.warn('[Supabase Fetch]:', err.message);
    }
}

async function deleteTaskFromSupabase(id) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('tasks').delete().eq('id', String(id));
    } catch(err) {
        console.warn('[Supabase Delete]:', err.message);
    }
}

function loadTasks() {
    const key = getUserStorageKey('todo_tasks');
    const saved = safeStorage.get(key);
    if (saved) {
        try {
            tasks = JSON.parse(saved);
            // MIGRATION: Ensure 'review' status is migrated to 'progress'
            let hasMigrated = false;
            tasks.forEach(t => {
                if (t.status === 'review') {
                    t.status = 'progress';
                    hasMigrated = true;
                }
                if (!t.priority) t.priority = 'medium';
                if (!t.tag) t.tag = 'Geliştirme';
            });
            if (hasMigrated) saveTasks();
        } catch(e) {
            tasks = [];
            saveTasks();
        }
    } else {
        tasks = [];
        saveTasks();
    }
    fetchTasksFromSupabase();
}

function saveTasks() {
    const key = getUserStorageKey('todo_tasks');
    safeStorage.set(key, JSON.stringify(tasks));
    syncTasksToSupabase();
}

function resetSampleData() {
    tasks = getDefaultTasks();
    saveTasks();
    renderBoard();
    const dropdown = document.getElementById('userDropdownMenu');
    if (dropdown) dropdown.classList.add('hidden');
    showToast('Örnek veriler yüklendi.');
}
window.resetSampleData = resetSampleData;

function formatTimeBadge(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month}, ${hours}:${mins}`;
}

function getTaskDateTimeInfo(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((compDate - today) / (1000 * 60 * 60 * 24));

    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const dateStr = `${date.getDate()} ${months[date.getMonth()]}`;

    let status = 'upcoming';
    let relativeLabel = dateStr;
    let iconClass = 'fa-regular fa-clock';

    if (diffDays === 0) {
        status = 'today';
        relativeLabel = 'Bugün';
        iconClass = 'fa-solid fa-clock';
    } else if (diffDays === 1) {
        status = 'tomorrow';
        relativeLabel = 'Yarın';
        iconClass = 'fa-solid fa-calendar-day';
    } else if (diffDays < 0) {
        status = 'overdue';
        relativeLabel = `${Math.abs(diffDays)} gün önce`;
        iconClass = 'fa-solid fa-triangle-exclamation';
    } else if (diffDays <= 7) {
        const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        status = 'upcoming';
        relativeLabel = days[date.getDay()];
        iconClass = 'fa-regular fa-calendar-check';
    }

    return {
        status,
        timeStr,
        dateStr,
        relativeLabel,
        iconClass,
        fullFormatted: `${relativeLabel}, ${timeStr}`
    };
}
window.getTaskDateTimeInfo = getTaskDateTimeInfo;

const tagClassMap = {
    'Tasarım': 'tag-tasarim',
    'Geliştirme': 'tag-gelistirme',
    'Pazarlama': 'tag-pazarlama',
    'Toplantı': 'tag-toplanti',
    'Kişisel': 'tag-kisisel'
};

function renderBoard() {
    const containers = {
        'todo': document.getElementById('cards-todo'),
        'progress': document.getElementById('cards-progress'),
        'done': document.getElementById('cards-done')
    };

    if (!containers.todo) return;

    Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

    let filtered = tasks.filter(t => {
        const matchesSearch = !searchQuery || 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (t.tag && t.tag.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        if (activeFilter === 'today') {
            if (!t.time) return false;
            const d = new Date(t.time);
            if (isNaN(d.getTime())) return false;
            const now = new Date();
            return d.getFullYear() === now.getFullYear() &&
                   d.getMonth() === now.getMonth() &&
                   d.getDate() === now.getDate();
        } else if (activeFilter === 'tomorrow') {
            if (!t.time) return false;
            const d = new Date(t.time);
            if (isNaN(d.getTime())) return false;
            const tom = new Date();
            tom.setDate(tom.getDate() + 1);
            return d.getFullYear() === tom.getFullYear() &&
                   d.getMonth() === tom.getMonth() &&
                   d.getDate() === tom.getDate();
        } else if (activeFilter === 'mine') {
            return tasks.indexOf(t) % 2 === 0;
        } else if (activeFilter === 'high') {
            return t.priority === 'high';
        }
        return true;
    });

    if (currentSort === 'date') {
        filtered.sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return new Date(a.time) - new Date(b.time);
        });
    }

    const counts = { todo: 0, progress: 0, done: 0 };

    filtered.forEach(task => {
        const container = containers[task.status];
        if (!container) return;

        counts[task.status] = (counts[task.status] || 0) + 1;
        const card = createCardElement(task);
        container.appendChild(card);
    });

    ['todo', 'progress', 'done'].forEach(status => {
        const badge = document.getElementById(`count-${status}`);
        if (badge) badge.textContent = counts[status] || 0;
    });

    updateProductivityStats();
}

function updateProductivityStats() {
    const total = tasks.length;
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const progCount = tasks.filter(t => t.status === 'progress').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    const elTodo = document.getElementById('stat-todo-count');
    const elProg = document.getElementById('stat-progress-count');
    const elDone = document.getElementById('stat-done-count');

    if (elTodo) elTodo.textContent = todoCount;
    if (elProg) elProg.textContent = progCount;
    if (elDone) elDone.textContent = doneCount;

    const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const textEl = document.getElementById('progressPercentageText');
    const fillEl = document.getElementById('progressBarFill');

    if (textEl) textEl.textContent = `%${percentage}`;
    if (fillEl) fillEl.style.width = `${percentage}%`;

    // Tamamlanma yüzdesine göre kedinin stres/rahatlama durumunu güncelle
    updateCatMood(percentage);
}

function createCardElement(task) {
    const card = document.createElement('div');
    card.className = `kanban-card ${task.status === 'done' ? 'is-completed' : ''}`;
    card.draggable = true;
    card.dataset.id = task.id;

    const prioLabels = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
    const prioLabel = prioLabels[task.priority] || 'Orta';
    const prioClass = `prio-${task.priority || 'medium'}`;

    const tagClass = tagClassMap[task.tag] || 'tag-gelistirme';
    const tagHtml = task.tag ? `<span class="notion-tag-chip ${tagClass}">${task.tag}</span>` : '';
    const prioHtml = `<span class="notion-priority-badge ${prioClass}">${prioLabel}</span>`;

    const isDone = task.status === 'done';

    // Rich Time & Date Highlight Badge
    const dtInfo = getTaskDateTimeInfo(task.time);
    let dateTimeMarkup = '';
    if (dtInfo) {
        dateTimeMarkup = `
            <div class="card-datetime-highlight status-${dtInfo.status}">
                <div class="dt-badge-left">
                    <i class="${dtInfo.iconClass}"></i>
                    <span class="dt-time-val">${dtInfo.timeStr}</span>
                    <span class="dt-date-val">• ${dtInfo.dateStr}</span>
                </div>
                <span class="dt-relative-pill">${dtInfo.relativeLabel}</span>
            </div>
        `;
    } else {
        dateTimeMarkup = `
            <button type="button" class="card-add-time-btn" onclick="openNewTaskModal('${task.status}', '${task.id}'); event.stopPropagation();">
                <i class="fa-regular fa-clock"></i> Saat Belirle
            </button>
        `;
    }

    card.innerHTML = `
        <div class="card-content-area">
            <button type="button" class="notion-checkbox ${isDone ? 'checked' : ''}" title="${isDone ? 'Geri Al' : 'Tamamlandı Yap'}" onclick="toggleTaskComplete('${task.id}', event)">
                <i class="fa-solid fa-check"></i>
            </button>
            <div class="card-text">${escapeHtml(task.title)}</div>
        </div>
        ${dateTimeMarkup}
        <div class="card-properties-row">
            ${tagHtml}
            ${prioHtml}
        </div>
        <div class="card-footer-row">
            <span class="card-drag-hint" style="color: var(--text-muted); font-size: 11px;"><i class="fa-solid fa-grip-lines"></i></span>
            <div class="card-actions-hover">
                <button type="button" class="btn-card-icon" onclick="openNewTaskModal('${task.status}', '${task.id}'); event.stopPropagation();" title="Düzenle">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="btn-card-icon delete" onclick="deleteTask('${task.id}', event)" title="Sil">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openNewTaskModal(task.status, task.id));

    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    return card;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toggleTaskComplete(id, event) {
    if (event) event.stopPropagation();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'done') {
        task.status = 'todo';
        showToast('Görev yapılacaklara taşındı.');
    } else {
        task.status = 'done';
        showToast('Görev tamamlandı.');
    }

    saveTasks();
    renderBoard();
}
window.toggleTaskComplete = toggleTaskComplete;

function deleteTask(id, event) {
    if (event) event.stopPropagation();
    if (confirm("Bu görevi silmek istediğinize emin misiniz?")) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        deleteTaskFromSupabase(id);
        renderBoard();
        showToast('Görev silindi.');
    }
}
window.deleteTask = deleteTask;

// ============================================================
// DRAG AND DROP
// ============================================================
function setupBoardDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-col');

    columns.forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
        });

        col.addEventListener('dragleave', (e) => {
            if (!col.contains(e.relatedTarget)) {
                col.classList.remove('drag-over');
            }
        });

        col.addEventListener('drop', (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');

            const taskId = e.dataTransfer.getData('text/plain');
            const targetStatus = col.dataset.status;

            if (taskId && targetStatus) {
                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== targetStatus) {
                    task.status = targetStatus;
                    saveTasks();
                    renderBoard();
                    showToast('Durum güncellendi.');
                }
            }
        });
    });
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function setFilter(type, btn) {
    activeFilter = type;
    document.querySelectorAll('.notion-filter-group .notion-filter-btn').forEach(p => p.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        const el = document.getElementById(`filter-${type}`);
        if (el) el.classList.add('active');
    }
    renderBoard();
}
window.setFilter = setFilter;

function toggleSort() {
    currentSort = currentSort === 'default' ? 'date' : 'default';
    const sortText = document.getElementById('sort-text');
    if (sortText) {
        sortText.textContent = currentSort === 'date' ? 'Tarihe Göre' : 'Sırala';
    }
    renderBoard();
}
window.toggleSort = toggleSort;

function setupSearch() {
    const searchInput = document.getElementById('liveSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderBoard();
        });
    }
}

// ============================================================
// TASK MODAL
// ============================================================
function selectPriority(level) {
    selectedPriority = level;
    document.getElementById('taskPriority').value = level;
    document.querySelectorAll('.prio-btn-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.prio === level);
    });
}
window.selectPriority = selectPriority;

function openNewTaskModal(status = 'todo', taskId = null) {
    const modal = document.getElementById('taskModal');
    if (!modal) return;

    const heading = document.getElementById('modalHeading');
    const editingIdInput = document.getElementById('editingTaskId');
    const titleInput = document.getElementById('taskTitle');
    const statusSelect = document.getElementById('taskStatus');
    const tagSelect = document.getElementById('taskTag');
    const timeInput = document.getElementById('taskTime');

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            heading.textContent = 'Görevi Düzenle';
            editingIdInput.value = task.id;
            titleInput.value = task.title;
            statusSelect.value = task.status;
            tagSelect.value = task.tag || 'Geliştirme';
            timeInput.value = task.time || '';
            selectPriority(task.priority || 'medium');

            if (task.time) {
                updateModalDateTimePreview(task.time);
                syncModalPresetButtonsWithDate(task.time);
            } else {
                applyDatePreset('today');
                applyHourPreset('18:00');
            }
        }
    } else {
        heading.textContent = 'Yeni Görev';
        editingIdInput.value = '';
        titleInput.value = '';
        statusSelect.value = status;
        tagSelect.value = 'Tasarım';
        selectPriority('medium');
        // Default new tasks to Today 18:00
        applyDatePreset('today');
        applyHourPreset('18:00');
    }

    modal.classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 60);
}
window.openNewTaskModal = openNewTaskModal;

// ============================================================
// MODAL DATE & TIME BUILDER LOGIC (Bugün, Yarın, Hızlı Saatler)
// ============================================================
function applyDatePreset(preset) {
    const timeInput = document.getElementById('taskTime');
    if (!timeInput) return;

    const now = new Date();
    let target = new Date();

    if (preset === 'today') {
        target = now;
    } else if (preset === 'tomorrow') {
        target.setDate(now.getDate() + 1);
    } else if (preset === 'nextweek') {
        const day = now.getDay();
        const daysUntilMonday = day === 0 ? 1 : (8 - day);
        target.setDate(now.getDate() + daysUntilMonday);
    }

    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    let hourStr = '18:00';
    if (timeInput.value && timeInput.value.includes('T')) {
        const parts = timeInput.value.split('T');
        if (parts[1]) hourStr = parts[1].substring(0, 5);
    }

    const fullVal = `${dateStr}T${hourStr}`;
    timeInput.value = fullVal;

    document.querySelectorAll('.dt-preset-btn').forEach(b => b.classList.remove('active'));
    if (preset === 'today') {
        const b = document.getElementById('btnPresetToday');
        if (b) b.classList.add('active');
    } else if (preset === 'tomorrow') {
        const b = document.getElementById('btnPresetTomorrow');
        if (b) b.classList.add('active');
    } else if (preset === 'nextweek') {
        const b = document.getElementById('btnPresetNextWeek');
        if (b) b.classList.add('active');
    }

    updateModalDateTimePreview(fullVal);
}
window.applyDatePreset = applyDatePreset;

function applyHourPreset(hourStr) {
    const timeInput = document.getElementById('taskTime');
    if (!timeInput) return;

    let datePart = '';
    if (timeInput.value && timeInput.value.includes('T')) {
        datePart = timeInput.value.split('T')[0];
    } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        datePart = `${yyyy}-${mm}-${dd}`;
    }

    const fullVal = `${datePart}T${hourStr}`;
    timeInput.value = fullVal;

    document.querySelectorAll('.dt-hour-chip').forEach(chip => {
        chip.classList.toggle('active', chip.textContent.includes(hourStr));
    });

    updateModalDateTimePreview(fullVal);
}
window.applyHourPreset = applyHourPreset;

function onCustomDateTimeChange(val) {
    updateModalDateTimePreview(val);
    syncModalPresetButtonsWithDate(val);
}
window.onCustomDateTimeChange = onCustomDateTimeChange;

function syncModalPresetButtonsWithDate(isoStr) {
    if (!isoStr) {
        document.querySelectorAll('.dt-preset-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dt-hour-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const comp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((comp - today) / (1000 * 60 * 60 * 24));

    document.querySelectorAll('.dt-preset-btn').forEach(b => b.classList.remove('active'));
    if (diffDays === 0) {
        const b = document.getElementById('btnPresetToday');
        if (b) b.classList.add('active');
    } else if (diffDays === 1) {
        const b = document.getElementById('btnPresetTomorrow');
        if (b) b.classList.add('active');
    }

    if (isoStr.includes('T')) {
        const hourStr = isoStr.split('T')[1].substring(0, 5);
        document.querySelectorAll('.dt-hour-chip').forEach(c => {
            c.classList.toggle('active', c.textContent.includes(hourStr));
        });
    }
}

function updateModalDateTimePreview(isoStr) {
    const textEl = document.getElementById('dtModalPreviewText');
    if (!textEl) return;
    if (!isoStr) {
        textEl.textContent = 'Tarih Seçilmedi';
        return;
    }
    const dtInfo = getTaskDateTimeInfo(isoStr);
    if (dtInfo) {
        textEl.textContent = `${dtInfo.relativeLabel} ${dtInfo.timeStr}`;
    } else {
        textEl.textContent = isoStr.replace('T', ' ');
    }
}
window.updateModalDateTimePreview = updateModalDateTimePreview;

// ============================================================
// LIVE DIGITAL CLOCK & SLEEPING CAT
// ============================================================
function startLiveBoardClock() {
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const timeFormatted = `${hours}:${mins}:${secs}`;

        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

        const dayName = days[now.getDay()];
        const dateFormatted = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

        const elTime = document.getElementById('liveClockTime');
        const elDate = document.getElementById('liveClockDate');
        const elDay = document.getElementById('clockDayName');

        if (elTime) elTime.textContent = timeFormatted;
        if (elDate) elDate.textContent = dateFormatted;
        if (elDay) elDay.textContent = dayName.toUpperCase();
    }

    updateClock();
    setInterval(updateClock, 1000);
}
window.startLiveBoardClock = startLiveBoardClock;

let currentCatMood = 'focused'; // 'stressed' | 'focused' | 'happy'

function updateCatMood(percentage) {
    const catFig = document.getElementById('catFigure');
    const floatSymbols = document.getElementById('catFloatSymbols');
    if (!catFig) return;

    catFig.classList.remove('mood-stressed', 'mood-focused', 'mood-happy');

    // Eğer henüz hiç görev yoksa kedi streslenmesin, sakin başlangıç modunda beklesin
    if (tasks.length === 0) {
        currentCatMood = 'focused';
        catFig.classList.add('mood-focused');
        if (floatSymbols) {
            floatSymbols.innerHTML = `
                <span class="z-particle z-1">z</span>
                <span class="z-particle z-2">z</span>
                <span class="z-particle z-3">Z</span>
            `;
        }
        return;
    }

    if (percentage < 40) {
        currentCatMood = 'stressed';
        catFig.classList.add('mood-stressed');
        if (floatSymbols) {
            floatSymbols.innerHTML = `
                <span class="z-particle z-1" style="color: #60a5fa;">💧</span>
                <span class="z-particle z-2" style="color: #ef4444; font-size: 13px;">!</span>
                <span class="z-particle z-3" style="color: #f59e0b;">?</span>
            `;
        }
    } else if (percentage < 80) {
        currentCatMood = 'focused';
        catFig.classList.add('mood-focused');
        if (floatSymbols) {
            floatSymbols.innerHTML = `
                <span class="z-particle z-1">z</span>
                <span class="z-particle z-2">z</span>
                <span class="z-particle z-3">Z</span>
            `;
        }
    } else {
        currentCatMood = 'happy';
        catFig.classList.add('mood-happy');
        if (floatSymbols) {
            floatSymbols.innerHTML = `
                <span class="z-particle z-1" style="color: #ec4899;">💖</span>
                <span class="z-particle z-2">z</span>
                <span class="z-particle z-3">Z</span>
            `;
        }
    }
}
window.updateCatMood = updateCatMood;

function petTheCat(e) {
    if (e) e.stopPropagation();
    const balloon = document.getElementById('catPurrBalloon');
    if (!balloon) return;

    let purrs = [];
    const total = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    if (total === 0) {
        purrs = [
            'Temiz bir başlangıç! Haydi "+" butonuna basarak ilk görevini ekle! 🐾✨',
            'mırrr... Masamız tertemiz, seninle çalışmaya hazırım! 🐱💛',
            'Yeni bir çalışma alanı! İlk görevini sabırsızlıkla bekliyorum! 🐾'
        ];
    } else if (currentCatMood === 'stressed') {
        purrs = [
            `Eyvah! Tamamlanma %${percentage}... Yetişecek mi? 😿💦`,
            'Stresliyim... Lütfen biraz görev bitir! 🐾',
            'Miyav! Yapılacak çok iş birikti! 😿',
            `%${percentage} çok az! Hadi biraz odaklanalım! 💦`
        ];
    } else if (currentCatMood === 'happy') {
        purrs = [
            `Mırrr! Görevlerin %${percentage}'i bitti! Çok huzurluyum! 💖😴`,
            'Harikasın! Patilerim seninle gurur duyuyor! 🐾✨',
            'mırr mırr... Artık rahatça uyuyabilirim! 🐱💛',
            `%${percentage} tamamlandı! Mükemmel bir gün! 🌸`
        ];
    } else {
        purrs = [
            `İyi gidiyoruz! (%${percentage}) Odaklanmaya devam! 🐾`,
            'mırrr... Görevler yavaş yavaş bitiyor ✨',
            'patilerim sana odak getirsin! 🐾',
            'Fena değil, devam edelim! 🐱'
        ];
    }

    const randomPurr = purrs[Math.floor(Math.random() * purrs.length)];
    balloon.querySelector('span').textContent = randomPurr;
    balloon.classList.add('show');

    const catHead = document.querySelector('.cat-head-sphere');
    if (catHead) {
        catHead.style.transform = 'rotate(-8deg)';
        setTimeout(() => { if (catHead) catHead.style.transform = ''; }, 320);
    }

    clearTimeout(window._catPurrTimer);
    window._catPurrTimer = setTimeout(() => {
        balloon.classList.remove('show');
    }, 2800);
}
window.petTheCat = petTheCat;

function closeModal() {
    const modal = document.getElementById('taskModal');
    if (modal) modal.classList.add('hidden');
    const form = document.getElementById('newTaskForm');
    if (form) form.reset();
}
window.closeModal = closeModal;

function handleModalBackdropClick(e) {
    if (e.target.id === 'taskModal') {
        closeModal();
    }
}
window.handleModalBackdropClick = handleModalBackdropClick;

function handleTaskFormSubmit(e) {
    e.preventDefault();
    const editingId = document.getElementById('editingTaskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const status = document.getElementById('taskStatus').value;
    const tag = document.getElementById('taskTag').value;
    const priority = document.getElementById('taskPriority').value || 'medium';
    const time = document.getElementById('taskTime').value;

    if (!title) return;

    if (editingId) {
        const task = tasks.find(t => t.id === editingId);
        if (task) {
            task.title = title;
            task.status = status;
            task.tag = tag;
            task.priority = priority;
            task.time = time;
            showToast('Görev güncellendi.');
        }
    } else {
        const newTask = {
            id: 'task_' + Date.now(),
            title,
            status,
            tag,
            priority,
            time
        };
        tasks.push(newTask);
        showToast('Yeni görev eklendi.');
    }

    saveTasks();
    renderBoard();
    closeModal();
}
window.handleTaskFormSubmit = handleTaskFormSubmit;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        const userDropdown = document.getElementById('userDropdownMenu');
        if (userDropdown) userDropdown.classList.add('hidden');
    }
});

// ============================================================
// POST-IT STICKY NOTES & TEXTURED WALL ENGINE
// ============================================================
let postits = [];
let selectedPostitColor = 'yellow';

function getDefaultPostits() {
    return [
        {
            id: 'postit_1',
            title: '📌 Haftalık Öncelikler',
            body: '• Tasarım revizyonlarını onayla\n• Yeni API dökümanını oku\n• Çarşamba toplantısı için slayt hazırla',
            color: 'yellow',
            rot: -2,
            date: 'Bugün, 10:30'
        },
        {
            id: 'postit_2',
            title: '☕ Alışveriş & İhtiyaç',
            body: 'Kahve çekirdeği (Filtre)\nYulaf sütü\nNot defteri & yapışkan kağıt',
            color: 'pink',
            rot: 1.8,
            date: 'Dün, 17:15'
        },
        {
            id: 'postit_3',
            title: '💡 Fikir Karalaması',
            body: 'Mobil uygulama için bildirim seslerini özelleştirilebilir yapalım!',
            color: 'green',
            rot: -1.2,
            date: '22 Eyl'
        },
        {
            id: 'postit_4',
            title: '⚡ Önemli Hatırlatma',
            body: 'Sunucu yedeklemesini cuma günü saat 18:00 de kontrol etmeyi unutma.',
            color: 'blue',
            rot: 2.4,
            date: '21 Eyl'
        }
    ];
}

function initNotes() {
    const key = getUserStorageKey('todo_postits');
    const saved = safeStorage.get(key);
    if (saved) {
        try {
            postits = JSON.parse(saved);
        } catch (e) {
            postits = [];
            savePostits();
        }
    } else {
        postits = [];
        savePostits();
    }

    renderPostitWall();
}

function savePostits() {
    const key = getUserStorageKey('todo_postits');
    safeStorage.set(key, JSON.stringify(postits));
}

function selectPostitColor(colorName, btnEl) {
    selectedPostitColor = colorName;
    document.querySelectorAll('.color-circle-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.textContent = '';
    });
    if (btnEl) {
        btnEl.classList.add('active');
        btnEl.textContent = '✓';
    }

    const pad = document.getElementById('composerPreviewPad');
    if (pad) {
        pad.className = `postit-live-preview theme-${colorName}`;
    }
}
window.selectPostitColor = selectPostitColor;

function stickCurrentNoteToWall() {
    const titleInput = document.getElementById('postitTitleInput');
    const bodyInput = document.getElementById('postitBodyInput');

    const title = titleInput ? titleInput.value.trim() : '';
    const body = bodyInput ? bodyInput.value.trim() : '';

    if (!title && !body) {
        showToast('Lütfen yapıştırmadan önce bir not yazın!');
        if (bodyInput) bodyInput.focus();
        return;
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `Bugün, ${hours}:${mins}`;

    // Natural random tilt between -3deg and +3deg
    const randomTilt = +(Math.random() * 5.4 - 2.7).toFixed(1);

    const newPostit = {
        id: 'postit_' + Date.now(),
        title: title || 'Not',
        body: body,
        color: selectedPostitColor,
        rot: randomTilt,
        date: dateStr
    };

    postits.unshift(newPostit);
    savePostits();
    renderPostitWall();

    // Reset composer
    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.value = '';

    showToast('Post-it duvara yapıştırıldı! 📌');
}
window.stickCurrentNoteToWall = stickCurrentNoteToWall;

function deletePostit(id, event) {
    if (event) event.stopPropagation();
    postits = postits.filter(p => p.id !== id);
    savePostits();
    renderPostitWall();
    showToast('Post-it duvardan söküldü.');
}
window.deletePostit = deletePostit;

function editPostit(id, event) {
    if (event) event.stopPropagation();
    const note = postits.find(p => p.id === id);
    if (!note) return;

    const titleInput = document.getElementById('postitTitleInput');
    const bodyInput = document.getElementById('postitBodyInput');

    if (titleInput) titleInput.value = note.title;
    if (bodyInput) bodyInput.value = note.body;

    // Match color button
    const colorBtn = document.querySelector(`.color-circle-btn[data-color="${note.color}"]`);
    if (colorBtn) selectPostitColor(note.color, colorBtn);

    // Remove old note so it can be re-stuck
    postits = postits.filter(p => p.id !== id);
    savePostits();
    renderPostitWall();

    if (bodyInput) bodyInput.focus();
    showToast('Not düzenleme alanına alındı.');
}
window.editPostit = editPostit;

function shufflePostitTilts() {
    postits.forEach(p => {
        p.rot = +(Math.random() * 6 - 3).toFixed(1);
    });
    savePostits();
    renderPostitWall();
    showToast('Duvardaki notların eğimleri yenilendi!');
}
window.shufflePostitTilts = shufflePostitTilts;

function clearAllPostits() {
    if (postits.length === 0) {
        showToast('Duvarda zaten not yok.');
        return;
    }
    if (confirm('Duvardaki tüm post-it notları temizlemek istediğinize emin misiniz?')) {
        postits = [];
        savePostits();
        renderPostitWall();
        showToast('Duvar temizlendi.');
    }
}
window.clearAllPostits = clearAllPostits;

function renderPostitWall() {
    const canvas = document.getElementById('postitWallCanvas');
    const countBadge = document.getElementById('notesWallCountBadge');
    const wallCountPill = document.getElementById('wallCountPill');

    const total = postits.length;
    if (countBadge) countBadge.textContent = `Duvarda: ${total}`;
    if (wallCountPill) wallCountPill.textContent = `${total} Not`;

    if (!canvas) return;
    canvas.innerHTML = '';

    if (total === 0) {
        canvas.innerHTML = `
            <div class="empty-wall-banner">
                <i class="fa-solid fa-thumbtack"></i>
                <span>Duvarda henüz hiç post-it yok.</span>
                <p style="font-size: 13px; opacity: 0.8;">Soldaki kutuya bir not yazıp "Duvara Yapıştır"a tıklayın!</p>
            </div>
        `;
        return;
    }

    postits.forEach(note => {
        const card = document.createElement('div');
        card.className = `postit-note theme-${note.color || 'yellow'}`;
        card.style.setProperty('--rot', `${note.rot || 0}deg`);

        card.innerHTML = `
            <div class="postit-pushpin" title="Raptiye"></div>
            
            <div class="postit-card-header">
                <div class="postit-card-title">${escapeHtml(note.title)}</div>
                <button type="button" class="postit-delete-btn" onclick="deletePostit('${note.id}', event)" title="Duvardan sök (Sil)">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="postit-card-body">${escapeHtml(note.body)}</div>

            <div class="postit-card-footer">
                <span class="postit-date-badge">${escapeHtml(note.date || '')}</span>
                <button type="button" class="postit-quick-edit-btn" onclick="editPostit('${note.id}', event)" title="Düzenle">
                    <i class="fa-solid fa-pen"></i> Düzenle
                </button>
            </div>
        `;

        canvas.appendChild(card);
    });
}


// ============================================================
// FLOATING TOAST
// ============================================================
let toastTimeout;
function showToast(message) {
    let toast = document.getElementById('floatingToast');
    if (!toast) return;

    const msgEl = document.getElementById('toastMessage');
    if (msgEl) msgEl.textContent = message;

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}
window.showToast = showToast;

function setupGlobalClickListeners() {
    document.addEventListener('click', (e) => {
        const userDropdown = document.getElementById('userDropdownMenu');
        const userWrapper = document.querySelector('.user-menu-wrapper');
        if (userDropdown && userWrapper && !userWrapper.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}
