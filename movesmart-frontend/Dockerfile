# --- STAGE 1: Build Stage ---
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies cleanly
RUN npm ci

# Copy the rest of your frontend source code
COPY . .

# Build the optimized static files (creates a 'dist' or 'build' folder)
RUN npm run build

# --- STAGE 2: Production Stage ---
FROM nginx:stable-alpine

# Copy the compiled static assets from the build stage to Nginx's public folder
# Note: If your framework uses 'build' instead of 'dist', change 'dist' to 'build' below.
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for the web server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]