FROM node:16

WORKDIR /app
COPY . /app
RUN next build renderer && next export -o app renderer
COPY . .
EXPOSE 9003

CMD ["npx", "tsx", "./main/application.ts"]
