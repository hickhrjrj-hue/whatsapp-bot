#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Install your project's npm dependencies
npm install

# 2. Download and cache Chrome specifically for Puppeteer on Render
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR
npx puppeteer browsers install chrome
