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
# Create React App outputs to 'build', not 'dist'
COPY --from=build /app/build /usr/share/nginx/html

# Use a template so $PORT (injected by Railway at runtime) gets substituted into
# the actual nginx config before nginx starts. The base nginx image automatically
# runs envsubst on any *.template file placed in /etc/nginx/templates/.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway assigns PORT dynamically; default to 80 for local/non-Railway use
ENV PORT=80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]