FROM node:18

WORKDIR /app
COPY . /app
RUN yarn && npx next build renderer && npx next export -o app renderer && yarn add tsx
COPY . .
EXPOSE 9003

CMD ["npx", "tsx", "./main/application.ts"]
