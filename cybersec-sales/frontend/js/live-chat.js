/**
 * CyberSec Pro Live Chat Widget
 * AI-powered chat assistant with full platform knowledge
 */

(function() {
  'use strict';

  // Platform Knowledge Base
  const KNOWLEDGE_BASE = {
    platform: {
      name: 'CyberSec Pro',
      description: 'Cloud-based Kali Linux security platform with 350+ penetration testing tools',
      website: 'https://semihkilic.com',
      support_email: 'support@cybersecpro.com',
      sales_email: 'sales@cybersecpro.com',
    },
    pricing: {
      starter: { price: 0, period: '14 days trial', tools: 33, scans: 10, projects: 1 },
      professional: { price: 29, period: '/month', tools: 120, scans: 50, projects: 5 },
      team: { price: 79, period: '/month', tools: 200, scans: 100, projects: 20, agents: 1 },
      enterprise: { price: 149, period: '/month', tools: '350+', scans: 'Unlimited', projects: 'Unlimited', agents: 'Unlimited' },
    },
    features: {
      tools: '350+ Kali Linux security tools including Nmap, Metasploit, Burp Suite, SQLMap, Nikto, and more',
      terminal: 'Browser-based Kali Linux terminal with full command-line access',
      agents: 'Remote scanning agents for internal network testing (Team & Enterprise plans)',
      reports: 'PDF/HTML/JSON reports with compliance templates (OWASP, PCI-DSS)',
      api: 'RESTful API for automation and integration (Professional+ plans)',
      sso: 'SSO/SAML/LDAP integration (Enterprise plan)',
    },
    tools: [
      'Nmap', 'Metasploit', 'Burp Suite', 'SQLMap', 'Nikto', 'Dirb', 'Gobuster', 
      'WPScan', 'Hydra', 'John the Ripper', 'Hashcat', 'Aircrack-ng', 'Wireshark',
      'Maltego', 'Recon-ng', 'theHarvester', 'Amass', 'Subfinder', 'Nuclei',
      'OWASP ZAP', 'Wfuzz', 'FFuf', 'Masscan', 'Netcat', 'Curl', 'Wget'
    ],
    faq: [
      {
        q: 'What is CyberSec Pro?',
        a: 'CyberSec Pro is a cloud-based cybersecurity platform that gives you access to 350+ Kali Linux security tools directly from your browser. No installation required.'
      },
      {
        q: 'Is it legal?',
        a: 'Yes, CyberSec Pro is 100% legal for authorized security testing. You must only test systems you own or have explicit permission to test.'
      },
      {
        q: 'How do I get started?',
        a: 'Sign up for a free 14-day trial, verify your email, and start scanning! No credit card required for trial.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, MasterCard, Amex), PayPal, and bank transfers for Enterprise plans via Stripe.'
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes! You can cancel your subscription at any time. Your access continues until the end of your billing period.'
      },
      {
        q: 'Do you offer refunds?',
        a: 'Yes, we offer a 30-day money-back guarantee. If you are not satisfied, contact us for a full refund.'
      },
      {
        q: 'What is a remote agent?',
        a: 'Remote agents let you deploy scanning capabilities inside your network for internal testing. Available on Team and Enterprise plans.'
      },
      {
        q: 'Is my data secure?',
        a: 'Absolutely. We use AES-256 encryption, secure data centers in EU/US, and comply with GDPR. Scan results are encrypted and only accessible to you.'
      },
    ],
    responses: {
      greeting: [
        "👋 Hi! I'm CyberBot, your CyberSec Pro assistant. How can I help you today?",
        "Hello! Welcome to CyberSec Pro. I'm here to answer any questions about our security platform.",
        "Hey there! 🔐 Ready to help you with CyberSec Pro. What would you like to know?"
      ],
      pricing: "💰 **Our Plans:**\n\n• **Starter (Free Trial)**: €0 for 14 days - 33 tools, 10 scans/day\n• **Professional**: €29/month - 120 tools, 50 scans/day, API access\n• **Team**: €79/month - 200 tools, 100 scans/day, 1 remote agent\n• **Enterprise**: €149/month - All 350+ tools, unlimited everything\n\nWant me to explain any plan in detail?",
      tools: "🛠️ We have **350+ Kali Linux security tools** including:\n\n• **Reconnaissance**: Nmap, Recon-ng, theHarvester, Amass\n• **Web Testing**: Burp Suite, OWASP ZAP, Nikto, SQLMap\n• **Password Attacks**: Hydra, John the Ripper, Hashcat\n• **Exploitation**: Metasploit Framework\n• **Wireless**: Aircrack-ng, Wifite\n\nAll tools run in the cloud - no installation needed!",
      trial: "🎉 **Free Trial Details:**\n\n• 14 days full access\n• 33 security tools\n• 10 scans per day\n• No credit card required\n• Basic JSON reports\n\n[Start Free Trial →](https://semihkilic.com/dashboard)",
      support: "📞 **Contact Support:**\n\n• **Email**: support@cybersecpro.com\n• **Live Chat**: Available Mon-Fri, 9AM-6PM CET (Pro & Team users)\n• **Priority Support**: 24/7 for Enterprise users\n\nI can also help answer most questions right here!",
      enterprise: "🏢 **Enterprise Plan (€149/month):**\n\n• All 350+ Kali tools\n• Unlimited scans & projects\n• Unlimited remote agents\n• Unlimited team members\n• SSO / SAML / LDAP\n• Compliance reports (OWASP, PCI)\n• 24/7 priority support\n• Custom integrations\n\n[Contact Sales →](mailto:sales@cybersecpro.com)",
      agents: "🖥️ **Remote Agents:**\n\nDeploy scanning agents inside your network for:\n• Internal vulnerability scanning\n• Private asset discovery\n• Continuous monitoring\n• Distributed scanning\n\nSupported on: Linux, Windows, macOS, Docker\n\nAvailable on Team (1 agent) and Enterprise (unlimited) plans.",
      notFound: "🤔 I'm not sure about that. Here's what I can help with:\n\n• 💰 Pricing & plans\n• 🛠️ Tools & features\n• 🎉 Free trial info\n• 📞 Contact support\n• 🖥️ Remote agents\n\nOr contact us at support@cybersecpro.com"
    }
  };

  // Chat State
  let isOpen = false;
  let messages = [];

  // Create Chat Widget
  function createChatWidget() {
    // Check if already exists
    if (document.getElementById('cybersec-chat-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'cybersec-chat-widget';
    widget.innerHTML = `
      <style>
        #cybersec-chat-widget {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .chat-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #367bf0, #9b59b6);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(54, 123, 240, 0.4);
          transition: all 0.3s ease;
        }
        
        .chat-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 30px rgba(54, 123, 240, 0.5);
        }
        
        .chat-button svg {
          width: 28px;
          height: 28px;
          fill: white;
        }
        
        .chat-button .badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 20px;
          height: 20px;
          background: #e74c3c;
          border-radius: 50%;
          font-size: 11px;
          font-weight: bold;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-window {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 380px;
          max-width: calc(100vw - 48px);
          height: 500px;
          max-height: calc(100vh - 120px);
          background: #1a1a2e;
          border-radius: 16px;
          box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
          display: none;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(54, 123, 240, 0.3);
        }
        
        .chat-window.open {
          display: flex;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .chat-header {
          background: linear-gradient(135deg, #367bf0, #9b59b6);
          padding: 16px;
          color: white;
        }
        
        .chat-header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .chat-header p {
          margin: 0;
          font-size: 12px;
          opacity: 0.9;
        }
        
        .chat-header .close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .chat-message {
          max-width: 85%;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .chat-message.bot {
          background: #2a2a4e;
          color: #e0e0e0;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        
        .chat-message.user {
          background: #367bf0;
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        
        .chat-message a {
          color: #00d4ff;
          text-decoration: none;
        }
        
        .chat-message a:hover {
          text-decoration: underline;
        }
        
        .chat-input-area {
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
          display: flex;
          gap: 8px;
        }
        
        .chat-input {
          flex: 1;
          padding: 12px 16px;
          background: #2a2a4e;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          color: white;
          font-size: 14px;
          outline: none;
        }
        
        .chat-input::placeholder {
          color: #888;
        }
        
        .chat-input:focus {
          border-color: #367bf0;
        }
        
        .chat-send {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #367bf0;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .chat-send:hover {
          background: #2563eb;
        }
        
        .chat-send svg {
          width: 20px;
          height: 20px;
          fill: white;
        }
        
        .quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        .quick-action {
          padding: 8px 12px;
          background: #2a2a4e;
          border: 1px solid rgba(54, 123, 240, 0.3);
          border-radius: 20px;
          color: #367bf0;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .quick-action:hover {
          background: #367bf0;
          color: white;
        }
        
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: #2a2a4e;
          border-radius: 12px;
          align-self: flex-start;
          width: fit-content;
        }
        
        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: #888;
          border-radius: 50%;
          animation: typing 1.4s infinite;
        }
        
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      </style>
      
      <div class="chat-window" id="chat-window">
        <div class="chat-header">
          <h3>💬 CyberSec Pro Support</h3>
          <p>AI-powered • Usually responds instantly</p>
          <button class="close-btn" onclick="CyberSecChat.toggle()">✕</button>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="quick-actions">
          <button class="quick-action" onclick="CyberSecChat.send('pricing')">💰 Pricing</button>
          <button class="quick-action" onclick="CyberSecChat.send('tools')">🛠️ Tools</button>
          <button class="quick-action" onclick="CyberSecChat.send('free trial')">🎉 Trial</button>
          <button class="quick-action" onclick="CyberSecChat.send('support')">📞 Support</button>
        </div>
        <div class="chat-input-area">
          <input type="text" class="chat-input" id="chat-input" placeholder="Type your message..." 
                 onkeypress="if(event.key==='Enter')CyberSecChat.sendInput()">
          <button class="chat-send" onclick="CyberSecChat.sendInput()">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
      
      <button class="chat-button" onclick="CyberSecChat.toggle()">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
    `;
    
    document.body.appendChild(widget);
  }

  // Process user message and generate response
  function processMessage(text) {
    const lowerText = text.toLowerCase();
    const kb = KNOWLEDGE_BASE;
    
    // Greetings
    if (/^(hi|hello|hey|merhaba|selam)/.test(lowerText)) {
      return kb.responses.greeting[Math.floor(Math.random() * kb.responses.greeting.length)];
    }
    
    // Pricing
    if (/price|pricing|plan|cost|how much|ücret|fiyat/.test(lowerText)) {
      return kb.responses.pricing;
    }
    
    // Tools
    if (/tool|nmap|sqlmap|metasploit|what tools|araç/.test(lowerText)) {
      return kb.responses.tools;
    }
    
    // Trial
    if (/trial|free|try|deneme|ücretsiz/.test(lowerText)) {
      return kb.responses.trial;
    }
    
    // Support / Contact
    if (/support|contact|help|email|phone|destek|iletişim/.test(lowerText)) {
      return kb.responses.support;
    }
    
    // Enterprise
    if (/enterprise|unlimited|sso|saml|kurumsal/.test(lowerText)) {
      return kb.responses.enterprise;
    }
    
    // Agents
    if (/agent|remote|internal|ssh|ajan/.test(lowerText)) {
      return kb.responses.agents;
    }
    
    // Security / Legal
    if (/secure|security|legal|safe|güvenli|yasal/.test(lowerText)) {
      return "🔒 **Security & Legal:**\n\n• AES-256 encryption for all data\n• GDPR compliant\n• Secure EU/US data centers\n• Legal for authorized testing only\n• SOC 2 Type II certified\n\nAlways get permission before testing!";
    }
    
    // FAQ matching
    for (const faq of kb.faq) {
      const keywords = faq.q.toLowerCase().split(' ').filter(w => w.length > 3);
      const matches = keywords.filter(k => lowerText.includes(k));
      if (matches.length >= 2) {
        return faq.a;
      }
    }
    
    // Refund
    if (/refund|money back|cancel|iptal|iade/.test(lowerText)) {
      return "💸 **Refund Policy:**\n\n• 30-day money-back guarantee\n• Cancel anytime\n• No questions asked\n• Refund processed within 5-7 days\n\nContact support@cybersecpro.com for refunds.";
    }
    
    // API
    if (/api|integration|automate|entegrasyon/.test(lowerText)) {
      return "🔌 **API Access:**\n\n• RESTful API for automation\n• Available on Professional+ plans\n• Rate limits based on plan\n• Webhook support\n• SDK coming soon\n\nCheck our [API docs](/docs.html) for more info.";
    }
    
    // Default
    return kb.responses.notFound;
  }

  // Format message with markdown-like syntax
  function formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/• /g, '&bull; ');
  }

  // Add message to chat
  function addMessage(text, isBot = false) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${isBot ? 'bot' : 'user'}`;
    msgDiv.innerHTML = isBot ? formatMessage(text) : text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    messages.push({ text, isBot, time: new Date() });
  }

  // Show typing indicator
  function showTyping() {
    const messagesDiv = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Hide typing indicator
  function hideTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
  }

  // Public API
  window.CyberSecChat = {
    init: function() {
      createChatWidget();
      // Auto-greet after 3 seconds if chat is opened
    },
    
    toggle: function() {
      const chatWindow = document.getElementById('chat-window');
      isOpen = !isOpen;
      chatWindow.classList.toggle('open', isOpen);
      
      if (isOpen && messages.length === 0) {
        // Initial greeting
        setTimeout(() => {
          addMessage(KNOWLEDGE_BASE.responses.greeting[0], true);
        }, 500);
      }
    },
    
    send: function(text) {
      if (!text.trim()) return;
      
      addMessage(text);
      showTyping();
      
      // Simulate AI processing time
      setTimeout(() => {
        hideTyping();
        const response = processMessage(text);
        addMessage(response, true);
      }, 500 + Math.random() * 1000);
    },
    
    sendInput: function() {
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (text) {
        this.send(text);
        input.value = '';
      }
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CyberSecChat.init());
  } else {
    CyberSecChat.init();
  }
})();
