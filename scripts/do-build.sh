#!/bin/bash
cd /home/cybersec/cybersec-pro
mkdir -p logs
docker compose build --no-cache rust-backend > logs/build.log 2>&1
RESULT=$?
if [ $RESULT -eq 0 ]; then
    docker compose up -d rust-backend >> logs/build.log 2>&1
    echo "BUILD_SUCCESS" >> logs/build.log
else
    echo "BUILD_FAILED" >> logs/build.log
fi
