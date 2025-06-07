# Use official Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package.json .

# Install dependencies
RUN npm install --production


# Copy the rest of the application code
COPY . .

# Ensure static files are served from the correct working directory
WORKDIR /app/src/backend

# Expose the port the app runs on
EXPOSE 3000

# Set environment variable for production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
