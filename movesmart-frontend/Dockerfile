# --- STAGE 1: Build Stage ---
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies cleanly
RUN npm ci

# Copy the rest of your frontend source code
COPY . .

# CRA bakes REACT_APP_* vars into the JS bundle at build time. Railway's
# Variables tab only reaches this build stage if declared as ARG here and
# re-exported as ENV before the build runs.
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG REACT_APP_GOOGLE_MAPS_API_KEY
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_GOOGLE_MAPS_API_KEY=$REACT_APP_GOOGLE_MAPS_API_KEY

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