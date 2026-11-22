#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  npm install || exit $?
fi
npm start
