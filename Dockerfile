FROM node:18-alpine

WORKDIR /app
COPY . /app
RUN apk add git
RUN npm i && npx next build renderer && npx next export -o app renderer && npm i tsx tsc
RUN cd /app/node_modules/xal-node && npm i && npm run build
EXPOSE 9003

CMD ["npx", "tsx", "./main/application.ts"]
