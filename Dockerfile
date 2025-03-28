FROM node:18

WORKDIR /app
COPY . /app
RUN yarn && npx next build renderer && npx next export -o app renderer && yarn add tsx tsc
RUN cd /app/node_modules/xal-node && yarn && yarn build
COPY . .
EXPOSE 9003

CMD ["npx", "tsx", "./main/application.ts"]
