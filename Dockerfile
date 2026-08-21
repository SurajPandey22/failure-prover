FROM node:24-alpine

WORKDIR /app

# Install git for git commands
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install --only=production

# Install ts-node globally to run typescript directly in production for the hackathon
# In a real app we'd build with tsc first.
RUN npm install -g ts-node typescript

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["ts-node", "src/server.ts"]
