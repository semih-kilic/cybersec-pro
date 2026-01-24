# CyberSec Pro - Installation Guide

## 🚀 Quick Start (Recommended)

```bash
curl -sSL https://semihkilic.com/install.sh | bash
cd ~/cybersec-pro
./start.sh
```

Then open: http://localhost:5173

---

## 📦 Manual Installation

### Requirements
- Linux (Ubuntu 20.04+, Debian 11+, Kali Linux)
- Python 3.8+
- 4GB RAM minimum
- 10GB disk space

### Step 1: Extract
```bash
tar -xzf cybersec-pro-linux.tar.gz
cd cybersec-kali
```

### Step 2: Setup Python Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### Step 2.1: Configure Environment
```bash
cp backend/.env.example backend/.env
# Update backend/.env with your own SECRET_KEY/JWT_SECRET_KEY values
```

### Step 3: Start Application
```bash
./start.sh
```

### Step 4: Access
Open http://localhost:5173 in your browser

---

## 🐳 Docker Installation

```bash
# Download docker-compose.yml
curl -O https://semihkilic.com/downloads/docker-compose.yml

# Set your license key
export LICENSE_KEY=your_license_key_here

# Start
docker-compose up -d

# Access
open http://localhost:5173
```

---

## 🔑 License Activation

1. After purchase, you'll receive a license key via email
2. Go to Settings → License in the application
3. Enter your license key
4. Click Activate

---

## 🔐 Security Configuration

- Admin and audit keys are stored at /etc/cybersec/admin.env when using the installer.
- ADMIN_ALLOWED_IPS defaults to 127.0.0.1; add your trusted IPs to allow remote admin actions.
- Keep this file readable only by root.
- The installer creates a dedicated service user (cybersec) and runs services with least privilege.
- Set CORS_ORIGINS in backend/.env to restrict API access to trusted frontends.

Update allowed admin IPs (recommended for remote access):

```
sudo /home/sam/APPS/cybersec-kali/scripts/update_admin_env.sh "127.0.0.1,10.0.0.240"
```

---

## ⚠️ Troubleshooting

### Port already in use
```bash
# Kill existing processes
pkill -f "python.*app.py"
# Or change port in backend/app.py
```

### Permission denied
```bash
chmod +x start.sh stop.sh
```

### Python not found
```bash
sudo apt install python3 python3-pip python3-venv
```

---

## 📧 Support

- Email: cybersecpro@semihkilic.com
- Website: https://semihkilic.com

---

## 📋 What's Included

- 230+ Security Tools
- Web-based Dashboard
- Integrated Terminal
- Report Generator
- License Management

---

## 📦 Release Update

After any change, rebuild downloadable artifacts:

```bash
./scripts/rebuild_downloads.sh
```

This refreshes the tar/zip packages and updates version.json checksums.

## ⚙️ Systemd Units

Apply systemd units with sudo (avoids editor permission errors):

```bash
sudo ./scripts/apply_systemd_units.sh
```

---

© 2026 CyberSec Pro. All rights reserved.
