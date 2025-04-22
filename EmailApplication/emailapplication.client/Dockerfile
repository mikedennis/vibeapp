# Stage 1: Build the React application
FROM node:20 AS build

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
# Use CI for potentially faster/cleaner installs
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the application for production
# Ensure REACT_APP environment variables are available if needed during build
# ARG REACT_APP_API_BASE_URL
# ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
# ARG REACT_APP_KEYCLOAK_URL
# ENV REACT_APP_KEYCLOAK_URL=$REACT_APP_KEYCLOAK_URL
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

# Copy built assets from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy a custom Nginx configuration file (optional but recommended for SPAs)
# If you have a custom nginx.conf, copy it here:
# COPY nginx.conf /etc/nginx/conf.d/default.conf
# Example basic SPA config (put in nginx.conf):
# server {
#   listen 80;
#   server_name localhost;
# 
#   location / {
#     root /usr/share/nginx/html;
#     index index.html index.htm;
#     try_files $uri $uri/ /index.html;
#   }
# 
#   # Optional: Add cache control headers for assets
#   location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|woff|woff2|ttf|eot)$ {
#     root /usr/share/nginx/html;
#     expires 1y;
#     add_header Cache-Control "public";
#   }
# }

# Expose port 80 (default Nginx port)
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"] 