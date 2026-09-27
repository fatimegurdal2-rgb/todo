# 🌙 Notion Pano - To-Do List & Hatırlatıcı Uygulaması

Bu proje, Notion tarzı bir Kanban panosu (Frontend) ve arka planda e-posta bildirimleri gönderen bir Node.js servisinden (Backend) oluşmaktadır.

---

## 📁 Proje Yapısı

```
todo/
├── frontend/             --> Vercel'e yüklenecek kısım (HTML, CSS, JavaScript)
│   ├── index.html        --> Notion Pano Ana Sayfası
│   ├── style.css         --> Notion tarzı tasarım
│   ├── app.js            --> Pano mantığı, sürükle-bırak, arama ve filtreleme
│   └── pages/
│       ├── login.html    --> Giriş Sayfası
│       └── register.html --> Kayıt Sayfası
│
└── backend/              --> Render'a yüklenecek kısım (Node.js & Express)
    ├── server.js         --> Ana sunucu dosyası
    ├── package.json      --> Bağımlılıklar (Express, node-cron, nodemailer)
    └── src/
        ├── cronJob.js    --> Zamanı gelen görevleri kontrol eden saatlik sistem
        └── emailService.js -> E-posta gönderme şablonu ve servisi
```

---

## 🗄️ Supabase Veritabanı Kurulumu (1 Dakika)

Supabase panelinizde sol menüdeki **SQL Editor** kısmına girip aşağıdaki kodu yapıştırıp **Run** demeniz yeterlidir:

```sql
create table tasks (
  id text primary key,
  title text not null,
  status text default 'todo',
  time text,
  user_email text,
  reminder_sent boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS (Güvenlik) izni
alter table tasks enable row level security;
create policy "Herkes görev ekleyebilir ve okuyabilir" on tasks for all using (true);
```

---

## 🚀 Canlıya Alma (Deploy) Rehberi

### 1. Frontend -> Vercel
1. [vercel.com](https://vercel.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. **"Add New Project"** diyerek `todo` reponuzu seçin.
3. **Root Directory** kısmını `frontend` olarak ayarlayın.
4. **Deploy** butonuna tıklayın. Siteniz 30 saniye içinde dünya çapında canlıya alınır!

### 2. Backend -> Render
1. [render.com](https://render.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. **New +** -> **Web Service** seçin.
3. `todo` reponuzu seçin.
4. **Root Directory**: `backend`
5. **Build Command**: `npm install`
6. **Start Command**: `node server.js`
7. **Create Web Service** butonuna tıklayın.
