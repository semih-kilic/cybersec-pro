#!/bin/bash
DBURL=$(grep -oP '^DATABASE_URL=.*' /home/cybersec/cybersec-pro/rust-backend/.env | sed 's/^DATABASE_URL=//')
psql "$DBURL" -tA -c "$1"
