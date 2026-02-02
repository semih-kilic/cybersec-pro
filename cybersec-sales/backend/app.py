#!/usr/bin/env python3
"""
CyberSec Pro Sales Backend
Professional cybersecurity platform sales and subscription management
"""

import os
import json
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template_string, redirect, url_for, session
from flask_cors import CORS
import stripe
from email_service import EmailService
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'cybersec-pro-secret-key-2026')
CORS(app)

# Stripe Configuration - Using environment variables for security
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_your_publishable_key_here')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_your_secret_key_here')
stripe.api_key = STRIPE_SECRET_KEY

YOUR_DOMAIN = os.environ.get('DOMAIN', 'https://semihkilic.com')
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', 'cybersec-admin-2026')

# Stripe Webhook Secret (get from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

# Email service
email_service = EmailService()

# ============================================================================
# SUBSCRIPTION PLANS - Updated for Monthly Model
# ============================================================================

PLANS = {
    'starter': {
        'name': 'Starter',
        'price': 0,
        'currency': 'eur',
        'interval': 'month',
        'features': [
            '33 Essential Security Tools',
            'Basic Web Dashboard',
            'Email Support',
            '10 scans per day',
            '14-day free trial'
        ],
        'stripe_price_id': os.environ.get('STRIPE_STARTER_PRICE_ID', 'price_starter_monthly'),
        'description': 'Perfect for trying the platform'
    },
    'professional': {
        'name': 'Professional', 
        'price': 19,
        'currency': 'eur',
        'interval': 'month',
        'features': [
            '120 Advanced Security Tools',
            'Advanced Web Dashboard',
            'API Access',
            '50 scans per day',
            'Multi-tool scan (3)',
            'PDF/HTML Reports'
        ],
        'stripe_price_id': os.environ.get('STRIPE_PROFESSIONAL_PRICE_ID', 'price_professional_monthly'),
        'description': 'For security professionals'
    },
    'team': {
        'name': 'Team',
        'price': 49,
        'currency': 'eur',
        'interval': 'month',
        'features': [
            '130 Security Tools',
            '100 scans per day',
            'Multi-tool scan (5)',
            'Remote agent (1)',
            '5 team members',
            'Slack/Teams integration'
        ],
        'stripe_price_id': os.environ.get('STRIPE_TEAM_PRICE_ID', 'price_team_monthly'),
        'description': 'For security teams'
    },
    'enterprise': {
        'name': 'Enterprise',
        'price': 99,
        'currency': 'eur', 
        'interval': 'month',
        'features': [
            'All 143+ Premium Tools',
            'Unlimited scans',
            'Unlimited remote agents',
            'Unlimited users & projects',
            'SSO / SAML / LDAP',
            'Compliance reports',
            '24/7 priority support'
        ],
        'stripe_price_id': os.environ.get('STRIPE_ENTERPRISE_PRICE_ID', 'price_enterprise_monthly'),
        'description': 'Complete solution for organizations'
    }
}

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def init_db():
    """Initialize the sales database"""
    conn = sqlite3.connect('cybersec_sales.db')
    cursor = conn.cursor()
    
    # Create customers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            stripe_customer_id TEXT,
            plan TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create subscriptions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            stripe_subscription_id TEXT UNIQUE,
            plan TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            current_period_start TIMESTAMP,
            current_period_end TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
    ''')
    
    # Create payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            stripe_payment_intent_id TEXT,
            amount INTEGER,
            currency TEXT DEFAULT 'usd',
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_customer_by_email(email):
    """Get customer by email"""
    conn = sqlite3.connect('cybersec_sales.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM customers WHERE email = ?', (email,))
    customer = cursor.fetchone()
    conn.close()
    return customer

def create_customer(email, name, stripe_customer_id, plan):
    """Create new customer"""
    conn = sqlite3.connect('cybersec_sales.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO customers (email, name, stripe_customer_id, plan)
        VALUES (?, ?, ?, ?)
    ''', (email, name, stripe_customer_id, plan))
    customer_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return customer_id

def create_subscription(customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end):
    """Create new subscription"""
    conn = sqlite3.connect('cybersec_sales.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO subscriptions (customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end))
    conn.commit()
    conn.close()

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/')
@app.route('/api')
def index():
    """Main landing page"""
    return jsonify({
        'service': 'CyberSec Pro Sales API',
        'version': '2.1.0',
        'status': 'active',
        'plans': PLANS,
        'endpoints': {
            'create_checkout': '/create-checkout-session',
            'webhook': '/webhook',
            'admin': '/admin',
            'health': '/health'
        }
    })

@app.route('/health')
@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.1.0'
    })

@app.route('/plans')
@app.route('/api/plans')
def get_plans():
    """Get available subscription plans"""
    return jsonify({
        'plans': PLANS,
        'currency': 'usd',
        'billing_cycle': 'monthly'
    })

@app.route('/create-checkout-session', methods=['POST'])
@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout_session():
    """Create Stripe checkout session for subscription"""
    try:
        data = request.get_json()
        plan_id = data.get('plan_id')
        customer_email = data.get('customer_email', '')
        
        if plan_id not in PLANS:
            return jsonify({'error': 'Invalid plan'}), 400
        
        plan = PLANS[plan_id]
        
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': plan['stripe_price_id'],
                'quantity': 1,
            }],
            mode='subscription',
            success_url=YOUR_DOMAIN + '/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=YOUR_DOMAIN + '/cancel',
            customer_email=customer_email if customer_email else None,
            metadata={
                'plan_id': plan_id,
                'plan_name': plan['name']
            }
        )
        
        return jsonify({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/webhook', methods=['POST'])
@app.route('/api/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhooks"""
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        handle_successful_subscription_payment(invoice)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_cancelled(subscription)
    
    return jsonify({'status': 'success'})

def handle_successful_payment(session):
    """Handle successful checkout session"""
    try:
        customer_email = session.get('customer_email')
        plan_id = session['metadata'].get('plan_id')
        
        if customer_email and plan_id:
            # Get or create customer
            customer = get_customer_by_email(customer_email)
            if not customer:
                stripe_customer = stripe.Customer.retrieve(session['customer'])
                customer_id = create_customer(
                    customer_email,
                    stripe_customer.get('name', ''),
                    session['customer'],
                    plan_id
                )
            else:
                customer_id = customer[0]
            
            # Get subscription details
            subscription = stripe.Subscription.retrieve(session['subscription'])
            
            # Create subscription record
            create_subscription(
                customer_id,
                subscription['id'],
                plan_id,
                subscription['status'],
                datetime.fromtimestamp(subscription['current_period_start']),
                datetime.fromtimestamp(subscription['current_period_end'])
            )
            
            # Send welcome email
            email_service.send_welcome_email(customer_email, plan_id)
            
    except Exception as e:
        print(f"Error handling successful payment: {e}")

def handle_successful_subscription_payment(invoice):
    """Handle successful subscription renewal"""
    # Update subscription status and period
    pass

def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    # Update subscription status to cancelled
    pass

@app.route('/admin')
def admin_dashboard():
    """Admin dashboard"""
    token = request.args.get('token')
    if token != ADMIN_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get statistics
    conn = sqlite3.connect('cybersec_sales.db')
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM customers')
    total_customers = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM subscriptions WHERE status = "active"')
    active_subscriptions = cursor.fetchone()[0]
    
    cursor.execute('SELECT plan, COUNT(*) FROM subscriptions WHERE status = "active" GROUP BY plan')
    plan_distribution = cursor.fetchall()
    
    conn.close()
    
    return jsonify({
        'total_customers': total_customers,
        'active_subscriptions': active_subscriptions,
        'plan_distribution': dict(plan_distribution),
        'plans': PLANS
    })

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    init_db()
    print("🚀 CyberSec Pro Sales API starting...")
    print(f"📊 Available plans: {list(PLANS.keys())}")
    print(f"🌐 Domain: {YOUR_DOMAIN}")
    print(f"🔑 Stripe configured: {'✅' if STRIPE_SECRET_KEY.startswith('sk_') else '❌'}")
    
    port = int(os.environ.get('PORT', 5002))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )