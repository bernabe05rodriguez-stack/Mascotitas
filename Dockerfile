FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
COPY robots.txt /usr/share/nginx/html/robots.txt
COPY sitemap.xml /usr/share/nginx/html/sitemap.xml
COPY og-image.jpg /usr/share/nginx/html/og-image.jpg
COPY logo.png /usr/share/nginx/html/logo.png
EXPOSE 80
