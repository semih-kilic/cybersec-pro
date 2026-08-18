/* Shared blog post metadata. Source of truth: BlogPostPage.tsx BLOG_POSTS. */

export interface BlogPostMeta {
  slug: string;
  title: string;
  category: string;
  readTime: number;
  date: string;
  author: string;
  excerpt: string;
  tags: string[];
}

export const blogPostsList: BlogPostMeta[] = [
  { slug: "sqlmap-injection-guide", title: "SQLMap: Automated SQL Injection Testing Guide", category: "Tools", readTime: 15, date: "2026-03-10", author: "Semih Kilic", excerpt: "Complete guide to using SQLMap for automated SQL injection detection and exploitation.", tags: ['sqlmap', 'sql-injection', 'web-security', 'penetration-testing'] },
  { slug: "nmap-network-scanning", title: "Nmap: Complete Network Scanning & Discovery Guide", category: "Tools", readTime: 14, date: "2026-02-28", author: "Semih Kilic", excerpt: "Master Nmap for network discovery, port scanning, service detection, and OS fingerprinting.", tags: ['nmap', 'network-scanning', 'port-scanning', 'reconnaissance'] },
  { slug: "metasploit-exploitation", title: "Metasploit Framework: From Zero to Exploit", category: "Tools", readTime: 18, date: "2026-02-15", author: "Semih Kilic", excerpt: "Complete walkthrough of Metasploit Framework — module types, exploit development, and post-exploitation.", tags: ['metasploit', 'exploitation', 'penetration-testing', 'msfconsole'] },
  { slug: "hashcat-password-cracking", title: "Hashcat: GPU-Accelerated Password Cracking Mastery", category: "Tools", readTime: 16, date: "2026-01-28", author: "Semih Kilic", excerpt: "Advanced Hashcat techniques for password auditing — hash modes, rule-based attacks, and optimization.", tags: ['hashcat', 'password-cracking', 'hash-cracking', 'security-audit'] },
  { slug: "mastering-wireshark", title: "Mastering Wireshark: Network Traffic Analysis Deep Dive", category: "Tools", readTime: 12, date: "2026-01-15", author: "Semih Kilic", excerpt: "Advanced packet capture and analysis techniques — from protocol dissection to identifying malicious traffic patterns in real-time.", tags: ['wireshark', 'network-analysis', 'packet-capture', 'traffic-analysis'] },
  { slug: "hashcat-vs-john", title: "Hashcat vs John the Ripper: Password Cracking Compared", category: "Tools", readTime: 10, date: "2026-01-12", author: "Semih Kilic", excerpt: "GPU-accelerated password recovery showdown. Benchmarks, rule-based attacks, and choosing the right tool for the job.", tags: ['hashcat', 'john-the-ripper', 'password-cracking', 'GPU'] },
  { slug: "owasp-top-10-2026", title: "OWASP Top 10 in 2026: What's Changed", category: "Security", readTime: 12, date: "2026-01-08", author: "Semih Kilic", excerpt: "An updated look at the most critical web application security risks and how to mitigate them with modern tools.", tags: ['OWASP', 'web-security', 'top-10', 'application-security'] },
  { slug: "metasploit-zero-to-exploit", title: "Metasploit Framework: From Zero to Exploit", category: "Tutorials", readTime: 15, date: "2026-01-05", author: "Semih Kilic", excerpt: "Hands-on walkthrough of the Metasploit Framework — modules, payloads, encoders, and post-exploitation techniques.", tags: ['metasploit', 'exploitation', 'penetration-testing', 'post-exploitation'] },
  { slug: "ci-cd-pentest-automation", title: "Automating Penetration Tests with CI/CD", category: "DevSecOps", readTime: 10, date: "2026-01-03", author: "Semih Kilic", excerpt: "Integrate security testing into your development pipeline with CyberSec Pro's API and GitHub Actions.", tags: ['CI/CD', 'automation', 'DevSecOps', 'GitHub-Actions'] },
  { slug: "wireless-security-assessment", title: "Wireless Security Assessment Best Practices", category: "Wireless", readTime: 9, date: "2025-12-15", author: "Semih Kilic", excerpt: "Comprehensive guide to testing Wi-Fi network security using aircrack-ng, wifite, and bettercap.", tags: ['wireless', 'WiFi', 'aircrack-ng', 'wifite', 'bettercap'] },
];
