FROM node:alpine

# Installs latest Chromium (63) package.
RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
        udev \
        ttf-freefont \
        chromium

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
# Puppeteer v0.11.0 works with Chromium 63.

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json ./
RUN npm install
RUN yarn add puppeteer@0.12.0
COPY ./.build/ ./
EXPOSE 8081
CMD ["node", "index.js"]
