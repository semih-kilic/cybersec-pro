# CyberSec Pro - Team & Enterprise Plan Özellikleri

## 📊 Rakip Analizi (Tenable, Qualys, Rapid7, Invicti, Pentest-Tools)

### Endüstri Standartları:
- **Multi-tool scanning**: Aynı anda birden fazla tool çalıştırma
- **Project-based management**: Proje bazlı hedef ve tarama yönetimi
- **Remote agents**: Yerel/özel ağlarda tarama için agent desteği
- **Team collaboration**: Ekip içi işbirliği ve rol tabanlı erişim
- **Workflow automation**: Otomatik tarama ve raporlama akışları
- **Compliance reporting**: Uyumluluk raporları (OWASP, PCI-DSS, HIPAA)

---

## 🎯 ÖNERİLEN PLAN ÖZELLİKLERİ

### 📦 STARTER (€0/14 gün - Trial)
| Özellik | Değer |
|---------|-------|
| Tool Sayısı | 33 |
| Günlük Tarama | 10 |
| Paralel Tarama | 1 |
| Hedef Sayısı | 3 |
| Kullanıcı | 1 |
| Proje | 1 |
| Rapor | Basic (JSON) |
| Veri Saklama | 7 gün |

---

### 💼 PROFESSIONAL (€29/ay)
| Özellik | Değer |
|---------|-------|
| Tool Sayısı | 120 |
| Günlük Tarama | 50 |
| Paralel Tarama | 3 |
| Hedef Sayısı | 20 |
| Kullanıcı | 1 |
| Proje | 5 |
| Rapor | PDF/HTML |
| Veri Saklama | 30 gün |
| **YENİ: Multi-Tool Scan** | ✅ (3 tool aynı anda) |
| API Access | ✅ |
| Scheduled Scans | ✅ |

---

### 👥 TEAM (€79/ay) - **Yeni Özellikler**
| Özellik | Değer |
|---------|-------|
| Tool Sayısı | 200 |
| Günlük Tarama | 100 |
| Paralel Tarama | 5 |
| Hedef Sayısı | 50 |
| Kullanıcı | 5 |
| Proje | 20 |
| Rapor | PDF/HTML/DOCX |
| Veri Saklama | 90 gün |

#### ⭐ Team Özel Özellikleri:
1. **🔄 Multi-Tool Scanning (5 tool aynı anda)**
   - Tek hedefte birden fazla tool çalıştırma
   - Paralel tarama queue yönetimi
   - Kombine sonuç raporu

2. **🖥️ Remote Agent Desteği**
   - Yerel sunuculara agent kurulumu
   - Internal network scanning
   - VPN/SSH tunnel desteği

3. **📁 Proje Yönetimi**
   - Proje bazlı hedef gruplandırma
   - Proje timeline ve milestones
   - Proje bazlı raporlama

4. **👥 Ekip İşbirliği**
   - Shared workspaces
   - Tarama atama ve görev dağılımı
   - Team chat/comments
   - Activity feed

5. **🔔 Gelişmiş Bildirimler**
   - Slack/Discord/Teams entegrasyonu
   - Email digest (günlük/haftalık)
   - Kritik zafiyet alert'leri

6. **📊 Custom Dashboards**
   - Takım performans metrikleri
   - Zafiyet trend analizi
   - Tool kullanım istatistikleri

---

### 🏢 ENTERPRISE (€149/ay) - **Tüm Özellikler**
| Özellik | Değer |
|---------|-------|
| Tool Sayısı | 350+ (Tümü) |
| Günlük Tarama | Unlimited |
| Paralel Tarama | 10+ |
| Hedef Sayısı | Unlimited |
| Kullanıcı | Unlimited |
| Proje | Unlimited |
| Rapor | Tüm formatlar + Custom |
| Veri Saklama | 1 yıl |

#### ⭐ Enterprise Özel Özellikleri:

1. **🔄 Unlimited Multi-Tool Scanning**
   - 10+ tool paralel çalıştırma
   - Scan chains (zincirli taramalar)
   - Conditional scanning (koşullu taramalar)

2. **🖥️ Multi-Agent Deployment**
   - Sınırsız remote agent
   - Agent auto-discovery
   - Centralized agent management
   - Cloud integration (AWS, Azure, GCP)

3. **🔐 Advanced Security**
   - SSO / SAML / LDAP
   - 2FA zorunlu
   - IP whitelist
   - Audit logs
   - Data encryption at rest

4. **📋 Compliance & Reporting**
   - OWASP Top 10 raporu
   - PCI-DSS compliance check
   - HIPAA/SOC2 raporları
   - Custom report templates
   - Executive summary dashboard

5. **🔧 Advanced Automation**
   - Webhook triggers
   - Custom scan workflows
   - CI/CD pipeline entegrasyonu
   - Auto-remediation suggestions

6. **🎯 Advanced Project Management**
   - Multiple workspaces
   - Cross-project analytics
   - Resource allocation
   - Budget tracking

7. **📞 Premium Support**
   - 24/7 support
   - Dedicated account manager
   - Priority ticket handling
   - Onboarding assistance
   - Training sessions

---

## 🚀 ÇOKLU TOOL TARAMA - Teknik Tasarım

### Kullanıcı Akışı:
```
1. Proje Oluştur → "E-Ticaret Güvenlik Testi"
2. Hedef Ekle → "api.example.com", "web.example.com"
3. Tool Seç → [nmap, nikto, sqlmap, dirb, wpscan]
4. Remote Agent Seç (opsiyonel) → "Office-Agent-01"
5. Tarama Başlat → Paralel çalıştırma
6. Sonuçları Görüntüle → Kombine rapor
```

### Veritabanı Şeması:
```sql
-- Projects tablosu
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP
);

-- Project Targets
CREATE TABLE project_targets (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    target VARCHAR(255),
    target_type VARCHAR(50), -- domain, ip, url
    notes TEXT
);

-- Multi-Tool Scans
CREATE TABLE multi_scans (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255),
    status VARCHAR(50),
    agent_id UUID REFERENCES agents(id), -- null = cloud
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Multi-Scan Tools
CREATE TABLE multi_scan_tools (
    id UUID PRIMARY KEY,
    multi_scan_id UUID REFERENCES multi_scans(id),
    tool_id UUID REFERENCES tools(id),
    status VARCHAR(50),
    result JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Remote Agents
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255),
    hostname VARCHAR(255),
    ip_address VARCHAR(45),
    status VARCHAR(50), -- online, offline, busy
    last_heartbeat TIMESTAMP,
    capabilities JSONB, -- hangi toollar yüklü
    created_at TIMESTAMP
);
```

---

## 🖥️ REMOTE AGENT SİSTEMİ

### Agent Kurulum Adımları:
```bash
# 1. Agent'ı indir
curl -sSL https://semihkilic.com/agent/install.sh | bash

# 2. Agent'ı başlat (token ile)
cybersec-agent start --token=<ORG_TOKEN>

# 3. Agent dashboard'da görünür
```

### Agent Özellikleri:
- Websocket bağlantısı ile gerçek zamanlı iletişim
- Tool execution container isolation
- Otomatik tool installation
- Heartbeat ile bağlantı kontrolü
- Secure tunnel (SSH/HTTPS)

---

## 📊 PLAN KARŞILAŞTIRMA TABLOSU (Landing Page için)

| Özellik | Starter | Professional | Team | Enterprise |
|---------|---------|--------------|------|------------|
| **Tool Sayısı** | 33 | 120 | 200 | 350+ |
| **Günlük Tarama** | 10 | 50 | 100 | Unlimited |
| **Paralel Tarama** | 1 | 3 | 5 | 10+ |
| **Multi-Tool Scan** | ❌ | ✅ (3) | ✅ (5) | ✅ (∞) |
| **Projeler** | 1 | 5 | 20 | Unlimited |
| **Kullanıcılar** | 1 | 1 | 5 | Unlimited |
| **Remote Agent** | ❌ | ❌ | 1 | Unlimited |
| **API Access** | ❌ | ✅ | ✅ | ✅ |
| **Scheduled Scans** | ❌ | ✅ | ✅ | ✅ |
| **Webhook/Integration** | ❌ | ❌ | ✅ | ✅ |
| **Custom Reports** | ❌ | ❌ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ❌ | ✅ |
| **Audit Logs** | ❌ | ❌ | ❌ | ✅ |
| **24/7 Support** | ❌ | ❌ | ❌ | ✅ |
| **Data Retention** | 7 gün | 30 gün | 90 gün | 1 yıl |

---

## 🎨 ÖNERİLEN UI DEĞİŞİKLİKLERİ

### 1. Yeni "Projects" Sayfası
- Proje listesi (kartlar/tablo)
- Proje oluşturma wizard
- Proje detay sayfası
- Hedef yönetimi
- Multi-tool scan başlatma

### 2. Yeni "Agents" Sayfası (Team+)
- Agent listesi ve durumları
- Agent kurulum rehberi
- Agent log'ları
- Capability matrix

### 3. Güncellenmiş "New Scan" Sayfası
- Proje seçimi
- Çoklu tool seçimi (checkbox)
- Agent seçimi (opsiyonel)
- Scan scheduling
- Advanced options

### 4. Yeni "Workflows" Sayfası (Enterprise)
- Scan chain builder
- Conditional logic
- Webhook configuration
- CI/CD templates

---

## 💡 EK ÖNERİLER

### Gelecek Özellikler (Roadmap):
1. **AI-Powered Scanning** - Akıllı tool önerisi
2. **Vulnerability Intelligence** - CVE database entegrasyonu
3. **Attack Surface Management** - Otomatik subdomain keşfi
4. **Penetration Test Reports** - Profesyonel pentest raporları
5. **Bug Bounty Integration** - HackerOne/Bugcrowd entegrasyonu
6. **Mobile App Scanning** - iOS/Android güvenlik testleri
7. **Cloud Security** - AWS/Azure/GCP misconfig scanner

### Fiyatlandırma Stratejisi:
- Yıllık ödeme: %20 indirim
- Startup programı: %50 indirim (ilk yıl)
- Education: %75 indirim
- Non-profit: Özel fiyatlandırma

---

## 📝 SONUÇ

Bu özellikler CyberSec Pro'yu Tenable, Qualys, Rapid7 gibi enterprise çözümlerle rekabet edebilir seviyeye getirir. Team ve Enterprise planları, özellikle:

1. **Multi-tool scanning** - Aynı anda birden fazla tool çalıştırma
2. **Remote agents** - Yerel ağlarda tarama yapabilme
3. **Project management** - Organize güvenlik testleri
4. **Team collaboration** - Ekip çalışması

özelliklerini sunar ve büyük organizasyonların ihtiyaçlarını karşılar.
