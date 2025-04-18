# Stage 1: Build the React application
FROM node:20 AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
# Pass build-time environment variables using ARG and ENV
# These should correspond to the ones set in the AppHost
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

ARG REACT_APP_KEYCLOAK_URL
ENV REACT_APP_KEYCLOAK_URL=$REACT_APP_KEYCLOAK_URL

RUN npm run build

# Stage 2: Serve the static files using a lightweight web server
FROM nginx:stable-alpine

# Copy the build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy a custom nginx config, if needed, otherwise use default
# COPY nginx.conf /etc/nginx/conf.d/default.conf 

# Expose port 80 (nginx default)
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 