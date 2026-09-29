# Nginx tabanlı hafif bir web sunucusu kullanıyoruz
FROM nginx:alpine

# Frontend klasöründeki tüm statik dosyaları Nginx'in yayın klasörüne kopyalıyoruz
COPY . /usr/share/nginx/html

# Nginx'in varsayılan olarak dinlediği 80 portunu dışarı açıyoruz
EXPOSE 80

# Nginx sunucusunu başlatıyoruz
CMD ["nginx", "-g", "daemon off;"]
