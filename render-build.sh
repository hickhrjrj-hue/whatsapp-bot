#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR
npx puppeteer browsers install chrome
