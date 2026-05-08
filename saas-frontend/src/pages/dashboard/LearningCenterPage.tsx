import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Flag,
  FlaskConical,
  Award,
  Play,
  ExternalLink,
  Clock,
  Layers,
  ShieldCheck,
} from 'lucide-react';

import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';
import {
  PageHeader,
  Section,
  StatusPill,
  KeyValueGrid,
} from '../../components/vos/Soc';

// ─────────────────────────────────────────────────────────────────────────────
// Catalog data — every item links out to a reputable, real platform so
// learners can immediately enrol / play. New tabs only.
// ─────────────────────────────────────────────────────────────────────────────

type Course = {
  id: number;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  modules: number;
  category: string;
  description: string;
  provider: string;
  url: string;
};

const COURSES: Course[] = [
  {
    id: 1,
    title: 'Ethical Hacking Fundamentals',
    level: 'Beginner', duration: '12 hours', modules: 24, category: 'Offensive Security',
    description: 'Master the fundamentals of ethical hacking — reconnaissance, scanning, exploitation, and reporting.',
    provider: 'TryHackMe',
    url: 'https://tryhackme.com/path/outline/beginner',
  },
  {
    id: 2,
    title: 'Web Application Penetration Testing',
    level: 'Intermediate', duration: '18 hours', modules: 32, category: 'Web Security',
    description: 'Deep dive into OWASP Top 10, SQLi, XSS, CSRF, auth bypasses and advanced web exploitation.',
    provider: 'PortSwigger Academy',
    url: 'https://portswigger.net/web-security',
  },
  {
    id: 3,
    title: 'Network Security & Packet Analysis',
    level: 'Intermediate', duration: '15 hours', modules: 28, category: 'Network Security',
    description: 'Network protocols, Wireshark analysis, firewall bypasses, MITM attacks and network forensics.',
    provider: 'Wireshark Docs',
    url: 'https://www.wireshark.org/docs/',
  },
  {
    id: 4,
    title: 'Kali Linux Mastery',
    level: 'Beginner', duration: '20 hours', modules: 40, category: 'Tools & Platform',
    description: 'Complete guide to Kali Linux — from installation to advanced tool usage for professional pentesting.',
    provider: 'Kali Docs',
    url: 'https://www.kali.org/docs/',
  },
  {
    id: 5,
    title: 'Cloud Security (AWS / Azure / GCP)',
    level: 'Advanced', duration: '16 hours', modules: 30, category: 'Cloud Security',
    description: 'Secure cloud environments. IAM, network security, container security, and cloud-native attacks.',
    provider: 'SANS',
    url: 'https://www.sans.org/cyber-security-courses/cloud-security-fundamentals/',
  },
  {
    id: 6,
    title: 'Malware Analysis & Reverse Engineering',
    level: 'Advanced', duration: '22 hours', modules: 36, category: 'Malware Analysis',
    description: 'Static and dynamic analysis, assembly, debuggers, sandbox analysis and threat intelligence.',
    provider: 'TCM Security',
    url: 'https://academy.tcm-sec.com/p/practical-malware-analysis-triage',
  },
  {
    id: 7,
    title: 'Incident Response & Digital Forensics',
    level: 'Intermediate', duration: '14 hours', modules: 26, category: 'DFIR',
    description: 'IR procedures, memory forensics, disk analysis, timeline reconstruction and evidence handling.',
    provider: 'SANS',
    url: 'https://www.sans.org/cyber-security-courses/hacker-techniques-incident-handling/',
  },
  {
    id: 8,
    title: 'Bug Bounty Hunting Masterclass',
    level: 'Intermediate', duration: '10 hours', modules: 20, category: 'Bug Bounty',
    description: 'Practical methodology from asset discovery to report writing. HackerOne / Bugcrowd patterns.',
    provider: 'Bugcrowd University',
    url: 'https://www.bugcrowd.com/hackers/bugcrowd-university/',
  },
];

type CtfChallenge = {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  description: string;
  platform: string;
  url: string;
};

const CTF_CHALLENGES: CtfChallenge[] = [
  { id: 1, title: 'SQL Injection Lab', difficulty: 'Easy', category: 'Web',
    description: 'Exploit SQL injection in a mock banking app.', platform: 'PortSwigger',
    url: 'https://portswigger.net/web-security/sql-injection' },
  { id: 2, title: 'Buffer Overflow Basics', difficulty: 'Medium', category: 'Binary',
    description: 'Exploit a classic stack-based BOF for shell.', platform: 'TryHackMe',
    url: 'https://tryhackme.com/room/bof1' },
  { id: 3, title: 'XSS Hunter', difficulty: 'Easy', category: 'Web',
    description: 'Find and exploit XSS across multiple contexts.', platform: 'PortSwigger',
    url: 'https://portswigger.net/web-security/cross-site-scripting' },
  { id: 4, title: 'Cryptographic Weakness', difficulty: 'Hard', category: 'Crypto',
    description: 'Break a custom encryption scheme via known-plaintext.', platform: 'CryptoHack',
    url: 'https://cryptohack.org/' },
  { id: 5, title: 'Privilege Escalation: Linux', difficulty: 'Medium', category: 'PrivEsc',
    description: 'Escalate from low-priv user to root.', platform: 'TryHackMe',
    url: 'https://tryhackme.com/room/linuxprivesc' },
  { id: 6, title: 'Active Directory Attack Path', difficulty: 'Hard', category: 'AD',
    description: 'Achieve Domain Admin via realistic attack chains.', platform: 'HackTheBox',
    url: 'https://www.hackthebox.com/' },
  { id: 7, title: 'Network Forensics Challenge', difficulty: 'Medium', category: 'Forensics',
    description: 'Reconstruct an exfiltration incident from PCAPs.', platform: 'CyberDefenders',
    url: 'https://cyberdefenders.org/' },
  { id: 8, title: 'Container Escape', difficulty: 'Hard', category: 'Cloud',
    description: 'Break out of a Docker container using known techniques.', platform: 'HackTheBox',
    url: 'https://www.hackthebox.com/' },
  { id: 9, title: 'Reverse Engineering Malware', difficulty: 'Hard', category: 'Reversing',
    description: 'Analyse a real malware sample to extract IOCs.', platform: 'MalwareBazaar',
    url: 'https://bazaar.abuse.ch/' },
  { id: 10, title: 'OSINT Investigation', difficulty: 'Easy', category: 'OSINT',
    description: 'Trace a fictional threat actor with OSINT.', platform: 'TryHackMe',
    url: 'https://tryhackme.com/room/ohsint' },
];

type Lab = {
  name: string; description: string; tools: string[]; machines: number;
  status: 'available' | 'coming_soon'; provider: string; url: string;
};

const LABS: Lab[] = [
  { name: 'Web Exploitation Lab', description: 'Hands-on lab with DVWA, WebGoat, Juice Shop and friends.',
    tools: ['Burp Suite', 'SQLMap', 'Nikto'], machines: 5, status: 'available',
    provider: 'OWASP Juice Shop', url: 'https://owasp.org/www-project-juice-shop/' },
  { name: 'Network Pen Testing Lab', description: 'Multi-subnet network with services and vulns to exploit.',
    tools: ['Nmap', 'Metasploit', 'Wireshark'], machines: 8, status: 'available',
    provider: 'HackTheBox', url: 'https://www.hackthebox.com/' },
  { name: 'Active Directory Lab', description: 'Full AD environment with realistic misconfigurations.',
    tools: ['BloodHound', 'Mimikatz', 'Rubeus'], machines: 6, status: 'available',
    provider: 'TryHackMe', url: 'https://tryhackme.com/path/outline/jrpentester' },
  { name: 'Cloud Security Lab', description: 'AWS / Azure with IAM misconfigs, exposed services, S3 issues.',
    tools: ['Prowler', 'ScoutSuite', 'Pacu'], machines: 4, status: 'coming_soon',
    provider: 'flAWS Challenge', url: 'http://flaws.cloud/' },
  { name: 'Malware Analysis Lab', description: 'Sandboxed env for safe dynamic and static malware analysis.',
    tools: ['Ghidra', 'x64dbg', 'YARA'], machines: 3, status: 'available',
    provider: 'Any.Run', url: 'https://any.run/' },
  { name: 'IoT Security Lab', description: 'IoT devices and firmware for wireless, hardware, and firmware testing.',
    tools: ['Binwalk', 'Firmwalker', 'Attify'], machines: 4, status: 'coming_soon',
    provider: 'Attify Store', url: 'https://www.attify-store.com/' },
];

type Cert = {
  name: string; org: string; difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  price: string; description: string; url: string;
};

const CERTIFICATIONS: Cert[] = [
  { name: 'OSCP — Offensive Security Certified Professional', org: 'OffSec', difficulty: 'Advanced',
    price: '$1,749',
    description: 'The gold standard for pentesting. Hands-on, 24-hour practical exam.',
    url: 'https://www.offsec.com/courses/pen-200/' },
  { name: 'CEH — Certified Ethical Hacker', org: 'EC-Council', difficulty: 'Intermediate',
    price: '$1,199',
    description: 'Comprehensive ethical hacking certification covering tools, techniques, and methodologies.',
    url: 'https://www.eccouncil.org/programs/certified-ethical-hacker-ceh/' },
  { name: 'CompTIA Security+', org: 'CompTIA', difficulty: 'Beginner',
    price: '$404',
    description: 'Entry-level security certification covering network security, compliance and threats.',
    url: 'https://www.comptia.org/certifications/security' },
  { name: 'CISSP', org: '(ISC)²', difficulty: 'Advanced',
    price: '$749',
    description: 'Management-focused certification covering 8 domains of information security.',
    url: 'https://www.isc2.org/Certifications/CISSP' },
  { name: 'eJPT — Junior Penetration Tester', org: 'INE', difficulty: 'Beginner',
    price: '$249',
    description: 'Practical entry-level certification with hands-on lab-based exam.',
    url: 'https://security.ine.com/certifications/ejpt-certification/' },
  { name: 'GPEN — GIAC Penetration Tester', org: 'SANS / GIAC', difficulty: 'Advanced',
    price: '$2,499',
    description: 'Advanced penetration testing certification from SANS Institute.',
    url: 'https://www.giac.org/certifications/penetration-tester-gpen/' },
];

type Tutorial = {
  title: string; category: string; duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced'; url: string;
};

const TUTORIALS: Tutorial[] = [
  { title: 'Getting Started with Nmap', category: 'Reconnaissance', duration: '15 min', level: 'Beginner',
    url: 'https://nmap.org/book/man.html' },
  { title: 'Burp Suite Pro Configuration', category: 'Web Testing', duration: '20 min', level: 'Beginner',
    url: 'https://portswigger.net/burp/documentation/desktop/getting-started' },
  { title: 'Writing Custom Nmap Scripts (NSE)', category: 'Scripting', duration: '30 min', level: 'Intermediate',
    url: 'https://nmap.org/book/nse-tutorial.html' },
  { title: 'Metasploit Framework Deep Dive', category: 'Exploitation', duration: '45 min', level: 'Intermediate',
    url: 'https://docs.metasploit.com/' },
  { title: 'BloodHound for AD Enumeration', category: 'Active Directory', duration: '25 min', level: 'Advanced',
    url: 'https://bloodhound.readthedocs.io/' },
  { title: 'Python for Penetration Testers', category: 'Scripting', duration: '60 min', level: 'Intermediate',
    url: 'https://www.tcm-sec.com/courses/python-101-for-hackers/' },
  { title: 'Wireless Network Hacking with Aircrack-ng', category: 'Wireless', duration: '35 min', level: 'Intermediate',
    url: 'https://www.aircrack-ng.org/documentation.html' },
  { title: 'Docker Security Best Practices', category: 'Container Security', duration: '20 min', level: 'Intermediate',
    url: 'https://docs.docker.com/engine/security/' },
];

const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Beginner: 'success', Easy: 'success',
  Intermediate: 'warning', Medium: 'warning',
  Advanced: 'danger', Hard: 'danger',
};

const TABS = [
  { key: 'Courses', icon: BookOpen },
  { key: 'CTF', icon: Flag },
  { key: 'Labs', icon: FlaskConical },
  { key: 'Certifications', icon: Award },
  { key: 'Tutorials', icon: GraduationCap },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function LearningCenterPage() {
  const { t } = useTranslation();
  useDocumentTitle(`${t('learning.title', 'Learning Center')} — CyberSec Pro`);
  const [activeTab, setActiveTab] = useState<TabKey>('Courses');

  const stats = useMemo(
    () => [
      { label: 'Courses', value: COURSES.length },
      { label: 'CTF Challenges', value: CTF_CHALLENGES.length },
      { label: 'Practice Labs', value: LABS.length },
      { label: 'Cert Paths', value: CERTIFICATIONS.length },
    ],
    []
  );

  return (
    <PageTransition>
      <div className="p-vos-6 max-w-vos-page mx-auto space-y-vos-6">
        <PageHeader
          icon={<GraduationCap size={22} />}
          title={t('learning.title', 'Learning Center')}
          description={t(
            'learning.subtitle',
            'Master cybersecurity through curated courses, CTFs, hands-on labs and certification prep — every link opens at the original platform.'
          )}
          badge={
            <StatusPill tone="accent" label={`${COURSES.length + CTF_CHALLENGES.length + LABS.length + TUTORIALS.length} resources`} />
          }
        />

        <KeyValueGrid
          cols={4}
          items={stats.map((s) => ({ label: s.label, value: s.value }))}
        />

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 p-1 rounded-vos-lg bg-vos-bg-elev-1 border border-vos-border-1 w-fit">
          {TABS.map(({ key, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-vos-md text-vos-xs font-medium transition-colors ${
                  active
                    ? 'bg-vos-accent/10 text-vos-accent ring-1 ring-vos-accent/30'
                    : 'text-vos-text-2 hover:text-vos-text hover:bg-vos-bg-elev-2'
                }`}
              >
                <Icon size={14} />
                {key}
              </button>
            );
          })}
        </div>

        {activeTab === 'Courses' && <CoursesGrid />}
        {activeTab === 'CTF' && <CtfList />}
        {activeTab === 'Labs' && <LabsGrid />}
        {activeTab === 'Certifications' && <CertList />}
        {activeTab === 'Tutorials' && <TutorialsGrid />}
      </div>
    </PageTransition>
  );
}

function ExternalCardLink({ url, children, label }: { url: string; children: React.ReactNode; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-vos-md bg-vos-accent/10 text-vos-accent border border-vos-accent/30 text-vos-xs font-medium hover:bg-vos-accent/20 transition-colors"
    >
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

function CoursesGrid() {
  const { t } = useTranslation();
  return (
    <Section title={t('learningCenter.coursesTitle', 'Courses')} description={t('learningCenter.coursesDesc', 'Curated learning paths from industry-leading providers.')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-vos-3">
        {COURSES.map((course, i) => (
          <motion.article
            key={course.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4 hover:border-vos-border-2 transition-colors"
          >
            <div className="flex items-start justify-between mb-vos-2">
              <StatusPill tone={LEVEL_TONE[course.level]} label={course.level} />
            </div>
            <h3 className="text-vos-text font-semibold text-vos-base mb-1">{course.title}</h3>
            <p className="text-vos-text-3 text-vos-sm mb-vos-3 line-clamp-2">{course.description}</p>
            <div className="flex flex-wrap gap-3 text-vos-xs text-vos-text-3 mb-vos-3">
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {course.duration}</span>
              <span className="inline-flex items-center gap-1"><Layers size={11} /> {course.modules} modules</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 min-w-0">
                <span className="inline-flex items-center px-2 h-6 rounded-vos-sm bg-vos-bg-elev-2 text-vos-text-2 text-[11px] border border-vos-border-1">
                  {course.category}
                </span>
                <span className="inline-flex items-center px-2 h-6 rounded-vos-sm bg-vos-bg-elev-2 text-vos-text-2 text-[11px] border border-vos-border-1">
                  {course.provider}
                </span>
              </div>
              <ExternalCardLink url={course.url} label={`Open ${course.title}`}>
                <Play size={12} /> Start
              </ExternalCardLink>
            </div>
          </motion.article>
        ))}
      </div>
    </Section>
  );
}

function CtfList() {
  const { t } = useTranslation();
  return (
    <Section title={t('learningCenter.ctfTitle', 'CTF Challenges')} description={t('learningCenter.ctfDesc', 'Capture-the-flag challenges across web, binary, crypto, AD and more.')}>
      <div className="space-y-1.5">
        {CTF_CHALLENGES.map((ctf) => (
          <div
            key={ctf.id}
            className="flex items-center gap-vos-3 p-vos-3 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 hover:border-vos-border-2 transition-colors"
          >
            <div className="w-12 h-12 rounded-vos-md bg-vos-bg-elev-2 border border-vos-border-1 flex items-center justify-center text-vos-base font-vos-mono font-bold text-vos-accent shrink-0">
              <Flag size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-vos-text font-medium text-vos-sm truncate">{ctf.title}</h4>
                <StatusPill tone={LEVEL_TONE[ctf.difficulty]} label={ctf.difficulty} />
              </div>
              <p className="text-vos-text-3 text-vos-xs truncate">{ctf.description}</p>
              <div className="flex gap-3 mt-1 text-[11px] text-vos-text-3">
                <span>{ctf.category}</span>
                <span>·</span>
                <span>{ctf.platform}</span>
              </div>
            </div>
            <ExternalCardLink url={ctf.url} label={`Play ${ctf.title}`}>
              <Flag size={12} /> Play
            </ExternalCardLink>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LabsGrid() {
  const { t } = useTranslation();
  return (
    <Section title={t('learningCenter.labsTitle', 'Practice Labs')} description={t('learningCenter.labsDesc', 'Hands-on environments to build real-world muscle memory.')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-vos-3">
        {LABS.map((lab, i) => (
          <motion.div
            key={lab.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4 flex flex-col gap-vos-3 hover:border-vos-border-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-vos-text font-semibold text-vos-sm">{lab.name}</h4>
              {lab.status === 'coming_soon' ? (
                <StatusPill tone="warning" label="SOON" />
              ) : (
                <StatusPill tone="success" label="LIVE" />
              )}
            </div>
            <p className="text-vos-text-3 text-vos-sm flex-1">{lab.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {lab.tools.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center px-2 h-6 rounded-vos-sm bg-vos-bg-elev-2 text-vos-text-2 text-[11px] border border-vos-border-1"
                >
                  {tool}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-vos-text-3">{lab.machines} machines · {lab.provider}</span>
              <ExternalCardLink url={lab.url} label={`Launch ${lab.name}`}>
                <Play size={12} /> Launch
              </ExternalCardLink>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function CertList() {
  const { t } = useTranslation();
  return (
    <Section title={t('learningCenter.certsTitle', 'Certifications')} description={t('learningCenter.certsDesc', 'Industry-recognised certifications.')}>
      <div className="space-y-vos-3">
        {CERTIFICATIONS.map((cert) => (
          <div
            key={cert.name}
            className="rounded-vos-lg border border-vos-border-1 bg-vos-bg-elev-1 p-vos-4"
          >
            <div className="flex items-start gap-vos-3">
              <div className="w-12 h-12 rounded-vos-md bg-vos-warning/10 border border-vos-warning/30 flex items-center justify-center shrink-0">
                <Award size={20} className="text-vos-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="text-vos-text font-semibold text-vos-sm">{cert.name}</h4>
                  <StatusPill tone={LEVEL_TONE[cert.difficulty]} label={cert.difficulty} />
                </div>
                <p className="text-vos-text-3 text-vos-sm mb-vos-2">{cert.description}</p>
                <div className="flex flex-wrap gap-3 text-vos-xs text-vos-text-3 mb-vos-2">
                  <span>Provider: <span className="text-vos-text-2">{cert.org}</span></span>
                  <span>Exam fee: <span className="text-vos-text-2">{cert.price}</span></span>
                </div>
                <div className="flex items-center gap-vos-3">
                  <ExternalCardLink url={cert.url} label={`Learn about ${cert.name}`}>
                    <ShieldCheck size={12} /> Details
                  </ExternalCardLink>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TutorialsGrid() {
  const { t } = useTranslation();
  return (
    <Section title={t('learningCenter.tutorialsTitle', 'Tutorials')} description={t('learningCenter.tutorialsDesc', 'Bite-sized walkthroughs and reference docs.')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-vos-3">
        {TUTORIALS.map((tut) => (
          <a
            key={tut.title}
            href={tut.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-vos-3 p-vos-3 rounded-vos-md bg-vos-bg-elev-1 border border-vos-border-1 hover:border-vos-accent/40 hover:bg-vos-bg-elev-2 transition-colors"
          >
            <div className="w-10 h-10 rounded-vos-md bg-vos-bg-elev-2 border border-vos-border-1 flex items-center justify-center text-vos-text-3">
              <Play size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-vos-text font-medium text-vos-sm truncate">{tut.title}</h4>
              <div className="flex gap-2 mt-0.5 text-[11px] text-vos-text-3">
                <span>{tut.category}</span>
                <span>·</span>
                <span>{tut.duration}</span>
              </div>
            </div>
            <StatusPill tone={LEVEL_TONE[tut.level]} label={tut.level} />
            <ExternalLink size={14} className="text-vos-text-3" />
          </a>
        ))}
      </div>
    </Section>
  );
}
