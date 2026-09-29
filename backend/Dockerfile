# Node.js 18 alpine sürümünü kullanıyoruz (Hafif ve hızlı)
FROM node:18-alpine

# Çalışma dizinini ayarlıyoruz
WORKDIR /usr/src/app

# package.json ve package-lock.json (varsa) dosyalarını kopyalıyoruz
COPY package*.json ./

# Gerekli kütüphaneleri yüklüyoruz
RUN npm install

# Kalan tüm backend kodlarını (server.js vs.) kopyalıyoruz
COPY . .

# Backend'in çalışacağı port (server.js'de 5000 ayarlı)
EXPOSE 5000

# Sunucuyu başlatıyoruz
CMD ["npm", "start"]
