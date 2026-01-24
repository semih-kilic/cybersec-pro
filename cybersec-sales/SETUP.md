# CyberSec Pro - Production Configuration Guide

## 🚀 Quick Setup (Systemd Services)

```bash
sudo bash /home/sam/APPS/cybersec-sales/scripts/setup-production.sh
```

This will:
- Install systemd services (auto-restart on failure)
- Enable services on boot
- Setup 5-minute monitoring cron job

---

## 📧 Email Alert Configuration

### Step 1: Create Gmail App Password
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication if not enabled
3. Go to "App Passwords" (search in settings)
4. Create new app password for "Mail" on "Linux"
5. Copy the 16-character password

### Step 2: Configure Service
Edit the service file:
```bash
sudo nano /etc/systemd/system/cybersec-sales.service
```

Uncomment and set these lines:
```ini
Environment="EMAIL_USER=your-email@gmail.com"
Environment="EMAIL_PASS=xxxx-xxxx-xxxx-xxxx"
Environment="ALERT_EMAIL=your-alert-email@gmail.com"
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart cybersec-sales
```

### Step 3: Test Email
```bash
EMAIL_USER=your@email.com EMAIL_PASS=xxxx bash /home/sam/APPS/cybersec-sales/scripts/monitor.sh alert
```

---

## 💳 Stripe Webhook Configuration

### Step 1: Create Webhook in Stripe Dashboard
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://semihkilic.com/api/webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)

### Step 2: Add to Service
```bash
sudo nano /etc/systemd/system/cybersec-sales.service
```

Add:
```ini
Environment="STRIPE_WEBHOOK_SECRET=whsec_your_secret_here"
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart cybersec-sales
```

### Step 3: Test Webhook
In Stripe Dashboard → Webhooks → Your endpoint → "Send test webhook"

---

## 🔧 Service Management Commands

```bash
# Check status
sudo systemctl status cybersec-sales
sudo systemctl status cybersec-frontend

# Restart services
sudo systemctl restart cybersec-sales
sudo systemctl restart cybersec-frontend

# View logs
journalctl -u cybersec-sales -f
journalctl -u cybersec-frontend -f

# Monitor status
bash /home/sam/APPS/cybersec-sales/scripts/monitor.sh status
bash /home/sam/APPS/cybersec-sales/scripts/monitor.sh monitor
```

---

## 🌐 Cloudflare Tunnel (Already Configured)

Tunnel ID: `3d58ef29-b086-46ae-a21c-b68ddd11725f`

To restart tunnel:
```bash
cloudflared tunnel run cybersec-tunnel
```

---

## ✅ Checklist

- [ ] Systemd services installed (`sudo bash setup-production.sh`)
- [ ] Gmail App Password created
- [ ] Email credentials added to service file
- [ ] Stripe webhook endpoint created
- [ ] Webhook secret added to service file
- [ ] Test purchase completed
- [ ] Email alerts working

---

## 🆘 Troubleshooting

### Service won't start
```bash
journalctl -u cybersec-sales -n 50 --no-pager
```

### Health check failing
```bash
curl http://localhost:5002/api/health
```

### Database issues
```bash
cd /home/sam/APPS/cybersec-sales/backend
rm sales.db
python3 -c "from app import db, app; app.app_context().push(); db.create_all()"
```

### Stripe issues
```bash
# Check if API key is valid
python3 -c "import stripe; stripe.api_key='sk_live_xxx'; print(stripe.Balance.retrieve())"
```
