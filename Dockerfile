# Use the official Node.js 22 image as the base
# Node 22 supports TypeScript type stripping natively
FROM node:22-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend application (Vite)
RUN npm run build

# Remove development dependencies to keep the image small
RUN npm prune --omit=dev

# Expose the port the app runs on (hardcoded to 3000 in server.ts)
EXPOSE 3000

# Set the environment to production
ENV NODE_ENV=production

# Start the server
# We use --experimental-strip-types to run the TypeScript server file directly
CMD ["node", "--experimental-strip-types", "server.ts"]
