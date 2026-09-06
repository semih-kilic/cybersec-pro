import type { Metadata } from "next";
import { locales } from "@/i18n/config";

const BASE_URL = "https://cyber-sec-pro.com";

type PageSEO = {
  title: string;
  description: string;
};

const pageMeta: Record<string, Record<string, PageSEO>> = {
  home: {
    en: {
      title: "CyberSec Pro — Cloud Cybersecurity | 88 Kali Tools",
      description:
        "Run 88 Kali Linux security tools from your browser. Automated vulnerability scanning, penetration testing, and security assessments. No setup required. Start free.",
    },
    tr: {
      title: "CyberSec Pro — Bulut Siber Güvenlik Platformu | 88 Kali Linux Aracı",
      description:
        "88 Kali Linux güvenlik aracını tarayıcınızdan çalıştırın. Otomatik zafiyet tarama, penetrasyon testi ve güvenlik değerlendirmeleri. Kurulum gerektirmez.",
    },
  },
  about: {
    en: {
      title: "About CyberSec Pro — Cloud Penetration Testing Platform",
      description:
        "Built by security engineers for security engineers. Learn about CyberSec Pro's mission to democratize offensive security with 88 cloud-based Kali Linux tools.",
    },
    tr: {
      title: "Hakkımızda — CyberSec Pro Siber Güvenlik Platformu",
      description:
        "Güvenlik mühendisleri tarafından, güvenlik mühendisleri için yapıldı. 88 bulut tabanlı Kali Linux aracıyla saldırı güvenliğini demokratikleştirme misyonumuzu öğrenin.",
    },
  },
  "trust-center": {
    en: {
      title: "Trust Center — CyberSec Pro | Security, Compliance & Transparency",
      description: "CyberSec Pro Trust Center: SOC 2, ISO 27001, GDPR compliance details, responsible disclosure policy, bug bounty program, sub-processors, and DPA.",
    },
    tr: {
      title: "Güven Merkezi — CyberSec Pro | Güvenlik, Uyumluluk & Şeffaflık",
      description: "CyberSec Pro güvenlik merkezi: SOC 2, ISO 27001, GDPR uyumluluk bilgileri, responsible disclosure politikası, bug bounty programı, alt işlemciler ve DPA.",
    },
  },
  tools: {
    en: {
      title: "88 Security Tools — Kali Linux Arsenal Online",
      description:
        "Access 88 Kali Linux security tools across 14 categories. Nmap, Nuclei, SQLMap, Nikto, ffuf, WPScan, Hydra and more — all in your browser.",
    },
    tr: {
      title: "88 Güvenlik Aracı — Online Kali Linux Cephaneliği",
      description:
        "14 kategoride 88 Kali Linux güvenlik aracına erişin. Nmap, Nuclei, SQLMap, Nikto, ffuf, WPScan, Hydra ve daha fazlası — hepsi tarayıcınızda.",
    },
  },
  blog: {
    en: {
      title: "Cybersecurity Blog — Penetration Testing Tutorials & Guides | CyberSec Pro",
      description:
        "Learn offensive security techniques, tool tutorials, and industry best practices. Wireshark, Hashcat, Metasploit guides and more.",
    },
    tr: {
      title: "Siber Güvenlik Blog — Penetrasyon Testi Eğitimleri & Rehberler | CyberSec Pro",
      description:
        "Saldırı güvenliği teknikleri, araç eğitimleri ve sektör en iyi uygulamalarını öğrenin. Wireshark, Hashcat, Metasploit rehberleri ve daha fazlası.",
    },
  },
  docs: {
    en: {
      title: "Documentation — Getting Started with CyberSec Pro",
      description:
        "Complete guide to setting up scans, using 88 security tools, generating reports, and integrating CyberSec Pro into your workflow.",
    },
    tr: {
      title: "Dokümantasyon — CyberSec Pro ile Başlangıç Rehberi",
      description:
        "Tarama kurulumu, 88 güvenlik aracı kullanımı, rapor oluşturma ve CyberSec Pro entegrasyonu için kapsamlı rehber.",
    },
  },
  "api-reference": {
    en: {
      title: "API Reference — CyberSec Pro REST API | 130+ Endpoints",
      description:
        "Integrate CyberSec Pro into your CI/CD pipeline. REST API with 130+ endpoints for scans, reports, and team management.",
    },
    tr: {
      title: "API Referansı — CyberSec Pro REST API | 130+ Uç Nokta",
      description:
        "CyberSec Pro'yu CI/CD hattınıza entegre edin. Tarama, rapor ve ekip yönetimi için 130+ uç noktalı REST API.",
    },
  },
  contact: {
    en: {
      title: "Contact Us — CyberSec Pro Sales, Support & Partnerships",
      description:
        "Get in touch with CyberSec Pro. Schedule a demo, get technical support, or explore partnership opportunities for your security team.",
    },
    tr: {
      title: "İletişim — CyberSec Pro Satış, Destek & Ortaklıklar",
      description:
        "CyberSec Pro ekibiyle iletişime geçin. Demo planlayın, teknik destek alın veya ortaklık fırsatlarını keşfedin.",
    },
  },
  careers: {
    en: {
      title: "Careers — Join CyberSec Pro Security Engineering Team",
      description:
        "Build the future of offensive security. 100% remote positions for passionate security engineers and developers.",
    },
    tr: {
      title: "Kariyer — CyberSec Pro Güvenlik Mühendisliği Ekibine Katılın",
      description:
        "Saldırı güvenliğinin geleceğini inşa edin. Tutkulu güvenlik mühendisleri ve geliştiriciler için %100 uzaktan pozisyonlar.",
    },
  },
  security: {
    en: {
      title: "Security — How CyberSec Pro Protects Your Data",
      description:
        "AES-256 encryption, TLS 1.3, isolated scan containers. Learn how CyberSec Pro protects your data and scan results.",
    },
    tr: {
      title: "Güvenlik — CyberSec Pro Veri Koruma Politikası",
      description:
        "AES-256 şifreleme, TLS 1.3, izole tarama konteynerleri. CyberSec Pro verilerinizi ve tarama sonuçlarınızı nasıl korur öğrenin.",
    },
  },
  tests: {
    en: {
      title: "Security Assessments — Automated Vulnerability Scanning | CyberSec Pro",
      description:
        "Run professional security assessments with automated vulnerability scanning. Quick, full, and custom scan types with CVSS scoring.",
    },
    tr: {
      title: "Güvenlik Değerlendirmeleri — Otomatik Zafiyet Tarama | CyberSec Pro",
      description:
        "Otomatik zafiyet tarama ile profesyonel güvenlik değerlendirmeleri çalıştırın. CVSS puanlamalı hızlı, tam ve özel tarama türleri.",
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy — CyberSec Pro",
      description: "CyberSec Pro privacy policy. How we collect, use, and protect your personal data and scan results.",
    },
    tr: {
      title: "Gizlilik Politikası — CyberSec Pro",
      description: "CyberSec Pro gizlilik politikası. Kişisel verilerinizi nasıl topladığımız, kullandığımız ve koruduğumuz.",
    },
  },
  terms: {
    en: {
      title: "Terms of Service — CyberSec Pro",
      description: "CyberSec Pro terms of service. Usage policies, authorized testing requirements, and legal information.",
    },
    tr: {
      title: "Hizmet Şartları — CyberSec Pro",
      description: "CyberSec Pro hizmet şartları. Kullanım politikaları, yetkili test gereksinimleri ve yasal bilgiler.",
    },
  },
  success: {
    en: {
      title: "Payment Successful — Welcome to CyberSec Pro",
      description: "Your CyberSec Pro account has been activated. Start your security assessments now.",
    },
    tr: {
      title: "Ödeme Başarılı — CyberSec Pro'ya Hoş Geldiniz",
      description: "CyberSec Pro hesabınız aktifleştirildi. Güvenlik değerlendirmelerinize şimdi başlayın.",
    },
  },
  admin: {
    en: {
      title: "Admin — CyberSec Pro",
      description: "CyberSec Pro administration panel.",
    },
    tr: {
      title: "Yönetim — CyberSec Pro",
      description: "CyberSec Pro yönetim paneli.",
    },
  },
};

export const blogPostMeta: Record<
  string,
  { title: string; description: string; date: string; author: string; category: string; tags: string[] }
> = {
  "mastering-wireshark": {
    title: "Mastering Wireshark: Advanced Network Analysis Guide",
    description:
      "Learn advanced Wireshark techniques for network analysis, packet capture, and protocol inspection. Complete guide for security professionals.",
    date: "2026-01-15",
    author: "Semih Kılıç",
    category: "Tools",
    tags: ["wireshark", "network-analysis", "packet-capture", "security-tools"],
  },
  "hashcat-vs-john": {
    title: "Hashcat vs John the Ripper: Password Cracking Tools Compared",
    description:
      "Comprehensive comparison of Hashcat and John the Ripper. Performance benchmarks, use cases, and best practices for password security testing.",
    date: "2026-01-12",
    author: "Semih Kılıç",
    category: "Tools",
    tags: ["hashcat", "john-the-ripper", "password-cracking", "security-tools"],
  },
  "owasp-top-10-2026": {
    title: "OWASP Top 10 2026: Web Application Security Vulnerabilities",
    description:
      "Complete guide to OWASP Top 10 2026 vulnerabilities. Understand, detect, and remediate the most critical web application security risks.",
    date: "2026-01-08",
    author: "Semih Kılıç",
    category: "Security",
    tags: ["owasp", "web-security", "vulnerabilities", "application-security"],
  },
  "metasploit-zero-to-exploit": {
    title: "Metasploit Framework: From Zero to Exploit — Complete Tutorial",
    description:
      "Step-by-step Metasploit tutorial for beginners. Learn penetration testing, exploit development, and post-exploitation techniques.",
    date: "2026-01-05",
    author: "Semih Kılıç",
    category: "Tutorials",
    tags: ["metasploit", "penetration-testing", "exploit-development", "ethical-hacking"],
  },
  "ci-cd-pentest-automation": {
    title: "CI/CD Penetration Testing Automation — DevSecOps Guide",
    description:
      "Integrate automated penetration testing into your CI/CD pipeline. DevSecOps best practices with practical examples.",
    date: "2026-01-03",
    author: "Semih Kılıç",
    category: "DevSecOps",
    tags: ["ci-cd", "devsecops", "automation", "penetration-testing"],
  },
  "wireless-security-assessment": {
    title: "Wireless Security Assessment: Complete WiFi Penetration Testing Guide",
    description:
      "Learn WiFi penetration testing techniques. WPA2/WPA3 security assessment, wireless network auditing, and best practices.",
    date: "2025-12-15",
    author: "Semih Kılıç",
    category: "Wireless",
    tags: ["wifi-security", "wireless-testing", "wpa2", "network-security"],
  },
};

function getAlternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${BASE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${BASE_URL}/en${path}`;
  return languages;
}

export function getPageMetadata(page: string, locale: string): Metadata {
  const pagePath = page === "home" ? "/" : `/${page}/`;
  const meta = pageMeta[page]?.[locale] || pageMeta[page]?.en;
  if (!meta) return {};

  const noIndex = page === "success" || page === "admin";

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}/${locale}${pagePath}`,
      languages: getAlternateLanguages(pagePath),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}/${locale}${pagePath}`,
      siteName: "CyberSec Pro",
      type: "website",
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: "CyberSec Pro — Cloud Cybersecurity Platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${BASE_URL}/og-image.png`],
    },
    ...(noIndex && {
      robots: { index: false, follow: false },
    }),
  };
}

export function getBlogPostMetadata(slug: string, locale: string): Metadata {
  const post = blogPostMeta[slug];
  if (!post) return getPageMetadata("blog", locale);

  const path = `/blog/${slug}/`;
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `${BASE_URL}/${locale}${path}`,
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/${locale}${path}`,
      siteName: "CyberSec Pro",
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${BASE_URL}/og-image.png`],
    },
  };
}

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CyberSec Pro",
    url: BASE_URL,
    logo: `${BASE_URL}/icon.svg`,
    description: "Cloud-based offensive security platform with 88 Kali Linux tools.",
    founder: {
      "@type": "Person",
      name: "CyberSec Pro Team",
      url: BASE_URL,
    },
    sameAs: [BASE_URL],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@cyber-sec-pro.com",
      contactType: "customer support",
    },
  };
}

export function getWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CyberSec Pro",
    url: BASE_URL,
    description: "Cloud-based offensive security platform with 88 Kali Linux tools.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/en/tools/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function getSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "CyberSec Pro",
    operatingSystem: "Web Browser",
    applicationCategory: "SecurityApplication",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        name: "Free Trial",
        description: "14-day free trial with all security tools",
      },
      {
        "@type": "Offer",
        price: "29",
        priceCurrency: "EUR",
        name: "Starter",
        description: "All 88 tools, 30 scans/month, basic reports",
      },
      {
        "@type": "Offer",
        price: "99",
        priceCurrency: "EUR",
        name: "Professional",
        description: "All 88 tools, 250 scans/month, AI suggestions, compliance reports",
      },
      {
        "@type": "Offer",
        price: "349",
        priceCurrency: "EUR",
        name: "Enterprise",
        description: "All 88 tools, 5000 scans/month, SSO/OIDC, priority support, dedicated manager",
      },
    ],
  };
}

export function getBlogPostJsonLd(slug: string) {
  const post = blogPostMeta[slug];
  if (!post) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "CyberSec Pro",
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/en/blog/${slug}/`,
    },
    keywords: post.tags.join(", "),
  };
}
