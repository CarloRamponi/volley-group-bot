FROM node:latest

COPY --chown=1000:1000 ./src /app
WORKDIR /app
RUN npm install
RUN npm run build
CMD [ "dist/bot.js" ]