# 🐉 CyberSec Pro - Backend Dockerfile
# Production-ready Flask API with WebSocket support

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Set working directory
WORKDIR /app

# Install system dependencies (for security tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    nmap \
    nikto \
    whatweb \
    whois \
    dnsutils \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Run with gunicorn + eventlet for WebSocket support
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--worker-class", "eventlet", "--workers", "1", "--threads", "100", "--timeout", "120", "app:app"]
