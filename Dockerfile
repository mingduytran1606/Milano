FROM nginx:1-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY inbox/           /usr/share/nginx/html/inbox/
COPY calendar/        /usr/share/nginx/html/calendar/
COPY stone-calendar/  /usr/share/nginx/html/stone-calendar/
COPY address/         /usr/share/nginx/html/address/
COPY stage-summary/   /usr/share/nginx/html/stage-summary/

EXPOSE 8080
