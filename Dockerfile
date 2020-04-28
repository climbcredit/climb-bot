FROM node:12.16.1-buster

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN groupadd -r nodejs \
  && useradd -m -r -g nodejs nodejs

COPY package.json /usr/src/app
COPY package-lock.json /usr/src/app

RUN npm ci \
  && npm install pm2 -g

COPY . /usr/src/app
USER nodejs

ENV PATH="/usr/src/app/node_modules/.bin:/usr/src/app/node_modules/hubot/node_modules/.bin:$PATH"

EXPOSE 8080
CMD ["node_modules/.bin/hubot", "--name", "sherpa", "--adapter", "slack"]
