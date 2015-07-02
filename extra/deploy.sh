#!/bin/bash
git pull --rebase && npm install && git status && chmod +x ./extra/deploy.sh