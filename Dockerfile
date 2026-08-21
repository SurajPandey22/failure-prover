FROM node:20-alpine

WORKDIR /app

# Install git, python3 and pytest for sandbox experiments
RUN apk add --no-cache git python3 py3-pytest

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
