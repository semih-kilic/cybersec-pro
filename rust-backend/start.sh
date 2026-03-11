#!/bin/bash
# CyberSec Pro - Rust Backend Starter
# This replaces the Flask backend (saas-backend/app.py)

export DATABASE_URL="sqlite:../saas-backend/instance/cybersec_saas.db?mode=rwc"
export JWT_SECRET_KEY="***REDACTED_JWT_SECRET***"
export RUST_LOG="info"
export HOST="0.0.0.0"
export PORT="5001"

# GitHub OAuth
export GITHUB_CLIENT_ID="***REDACTED_GH_OAUTH_CLIENT_ID***"
export GITHUB_CLIENT_SECRET="42133aa4989168391711dc5f26abb05f83dfe341"

cd /home/cybersec/cybersec-pro/rust-backend

exec ./target/release/cybersec-pro-backend
