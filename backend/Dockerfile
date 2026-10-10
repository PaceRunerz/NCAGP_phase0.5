FROM node:20-alpine

# Added python3, make, and g++ to compile bcrypt successfully
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build NestJS
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/src/main.js"]