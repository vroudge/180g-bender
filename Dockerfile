FROM node:6.5.0
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY ./package.json ./
RUN npm install
COPY ./.build/ ./
EXPOSE 8081
CMD ["node", "index.js"]
