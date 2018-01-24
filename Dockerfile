FROM node:9-alpine

RUN apk update && \
    apk upgrade && \
    apk add --update ca-certificates && \
    apk add --no-cache curl && \
    apk add chromium --update-cache --repository http://nl.alpinelinux.org/alpine/edge/community \
    rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
# Puppeteer v0.11.0 works with Chromium 63.

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json ./
RUN npm install
COPY ./.build/ ./
EXPOSE 8081
CMD ["node", "index.js"]
