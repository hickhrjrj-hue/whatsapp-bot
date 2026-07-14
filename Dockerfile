FROM ghcr.io/puppeteer/puppeteer:22.12.0

# Set up the app folder inside the secure server container
WORKDIR /usr/src/app

# Copy system files and install node packages
COPY package*.json ./
RUN npm ci

# Copy the rest of your bot code
COPY . .

# Run your bot script
CMD [ "node", "index.js" ]
