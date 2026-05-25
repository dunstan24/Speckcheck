FROM node:20-alpine

WORKDIR /app

# Install dependencies dulu
COPY package*.json ./
RUN npm install

# Copy source code (akan di-override oleh volume mount saat development)
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
