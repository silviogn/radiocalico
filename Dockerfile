FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS prod
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
