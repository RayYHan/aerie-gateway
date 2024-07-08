FROM node:lts-alpine AS build
RUN apk update
RUN apk add git
COPY . /app
WORKDIR /app
RUN npm install
RUN npm run build

FROM node:lts-alpine
COPY --from=build /app /app
WORKDIR /app
CMD [ "npm", "start" ]
