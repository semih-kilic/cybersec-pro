import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/useUtilities';

const LEARNING_TABS = ['Courses', 'CTF Challenges', 'Labs', 'Certifications', 'Tutorials'] as const;

const COURSES = [
  { id: 1, title: 'Ethical Hacking Fundamentals', level: 'Beginner', duration: '12 hours', modules: 24, category: 'Offensive Security', progress: 0, students: 14280, rating: 4.8, description: 'Master the fundamentals of ethical hacking including reconnaissance, scanning, exploitation, and reporting.' },
  { id: 2, title: 'Web Application Penetration Testing', level: 'Intermediate', duration: '18 hours', modules: 32, category: 'Web Security', progress: 0, students: 8920, rating: 4.9, description: 'Deep dive into OWASP Top 10, SQL injection, XSS, CSRF, authentication bypasses, and advanced web exploitation techniques.' },
  { id: 3, title: 'Network Security & Packet Analysis', level: 'Intermediate', duration: '15 hours', modules: 28, category: 'Network Security', progress: 0, students: 6750, rating: 4.7, description: 'Learn network protocols, Wireshark analysis, firewall bypasses, MITM attacks, and network forensics.' },
  { id: 4, title: 'Kali Linux Mastery', level: 'Beginner', duration: '20 hours', modules: 40, category: 'Tools & Platform', progress: 0, students: 22400, rating: 4.9, description: 'Complete guide to Kali Linux - from installation to advanced tool usage for professional penetration testing.' },
  { id: 5, title: 'Cloud Security (AWS/Azure/GCP)', level: 'Advanced', duration: '16 hours', modules: 30, category: 'Cloud Security', progress: 0, students: 5320, rating: 4.8, description: 'Secure cloud environments across AWS, Azure, and GCP. IAM, network security, container security, and cloud-native attacks.' },
  { id: 6, title: 'Malware Analysis & Reverse Engineering', level: 'Advanced', duration: '22 hours', modules: 36, category: 'Malware Analysis', progress: 0, students: 3840, rating: 4.9, description: 'Static and dynamic malware analysis, assembly language, debuggers, sandbox analysis, and threat intelligence.' },
  { id: 7, title: 'Incident Response & Digital Forensics', level: 'Intermediate', duration: '14 hours', modules: 26, category: 'DFIR', progress: 0, students: 4560, rating: 4.7, description: 'Build incident response procedures, memory forensics, disk analysis, timeline reconstruction, and evidence handling.' },
  { id: 8, title: 'Bug Bounty Hunting Masterclass', level: 'Intermediate', duration: '10 hours', modules: 20, category: 'Bug Bounty', progress: 0, students: 11200, rating: 4.8, description: 'Practical bug bounty methodology from asset discovery to report writing. Real-world examples from HackerOne and Bugcrowd.' },
];

const CTF_CHALLENGES = [
  { id: 1, title: 'SQL Injection Lab', difficulty: 'Easy', category: 'Web', points: 100, solves: 2847, description: 'Exploit SQL injection vulnerabilities in a mock banking application.' },
  { id: 2, title: 'Buffer Overflow Basics', difficulty: 'Medium', category: 'Binary', points: 200, solves: 1523, description: 'Exploit a classic stack-based buffer overflow to gain shell access.' },
  { id: 3, title: 'XSS Hunter', difficulty: 'Easy', category: 'Web', points: 150, solves: 3102, description: 'Find and exploit cross-site scripting vulnerabilities across multiple contexts.' },
  { id: 4, title: 'Cryptographic Weakness', difficulty: 'Hard', category: 'Crypto', points: 300, solves: 456, description: 'Break a custom encryption scheme using frequency analysis and known-plaintext attacks.' },
  { id: 5, title: 'Privilege Escalation: Linux', difficulty: 'Medium', category: 'PrivEsc', points: 250, solves: 1890, description: 'Escalate from a low-privilege user to root using misconfigurations and kernel exploits.' },
  { id: 6, title: 'Active Directory Attack Path', difficulty: 'Hard', category: 'AD', points: 400, solves: 312, description: 'Navigate an Active Directory environment to achieve Domain Admin through realistic attack chains.' },
  { id: 7, title: 'Network Forensics Challenge', difficulty: 'Medium', category: 'Forensics', points: 200, solves: 987, description: 'Analyze network traffic captures to reconstruct a data exfiltration incident.' },
  { id: 8, title: 'Container Escape', difficulty: 'Hard', category: 'Cloud', points: 350, solves: 234, description: 'Break out of a Docker container using known escape techniques and misconfigurations.' },
  { id: 9, title: 'Reverse Engineering Malware', difficulty: 'Hard', category: 'Reversing', points: 500, solves: 189, description: 'Analyze a real-world malware sample to extract IOCs and understand its behavior.' },
  { id: 10, title: 'OSINT Investigation', difficulty: 'Easy', category: 'OSINT', points: 100, solves: 4521, description: 'Use open-source intelligence techniques to trace a fictional threat actor.' },
];

const CERTIFICATIONS = [
  { name: 'OSCP (Offensive Security Certified Professional)', org: 'OffSec', difficulty: 'Advanced', price: '$1,749', coverage: 95, description: 'The gold standard for pentesting certification. Hands-on, 24-hour practical exam.' },
  { name: 'CEH (Certified Ethical Hacker)', org: 'EC-Council', difficulty: 'Intermediate', price: '$1,199', coverage: 85, description: 'Comprehensive ethical hacking certification covering tools, techniques, and methodologies.' },
  { name: 'CompTIA Security+', org: 'CompTIA', difficulty: 'Beginner', price: '$404', coverage: 100, description: 'Entry-level security certification covering network security, compliance, and threats.' },
  { name: 'CISSP', org: '(ISC)²', difficulty: 'Advanced', price: '$749', coverage: 70, description: 'Management-focused certification covering 8 domains of information security.' },
  { name: 'eJPT (Junior Penetration Tester)', org: 'INE', difficulty: 'Beginner', price: '$249', coverage: 90, description: 'Practical entry-level certification with hands-on lab-based exam.' },
  { name: 'GPEN (GIAC Penetration Tester)', org: 'SANS/GIAC', difficulty: 'Advanced', price: '$2,499', coverage: 75, description: 'Advanced penetration testing certification from SANS Institute.' },
];

function getLevelColor(level: string) {
  switch (level) {
    case 'Beginner': case 'Easy': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'Intermediate': case 'Medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    case 'Advanced': case 'Hard': return 'text-red-400 bg-red-500/10 border-red-500/30';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  }
}

export default function LearningCenterPage() {
  useDocumentTitle('Learning Center — CyberSec Pro');
  const { t: _t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('Courses');
  const [selectedCourse, setSelectedCourse] = useState<typeof COURSES[0] | null>(null);
  const [selectedCtf, setSelectedCtf] = useState<typeof CTF_CHALLENGES[0] | null>(null);

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Learning Center</h1>
              <p className="text-gray-400 text-sm">Master cybersecurity through courses, CTF challenges, hands-on labs & certification prep</p>
            </div>
          </div>
        </div>

        {/* Learning Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Courses', value: '8', icon: '📚' },
            { label: 'CTF Challenges', value: '50+', icon: '🏴' },
            { label: 'Practice Labs', value: '25+', icon: '🔬' },
            { label: 'Cert Paths', value: '6', icon: '🏆' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{stat.icon}</span>
                <span className="text-gray-500 text-xs">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl border border-gray-800 w-fit">
          {LEARNING_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gray-800 text-white shadow-lg'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Courses Tab */}
        {activeTab === 'Courses' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {COURSES.map(course => (
              <div key={course.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(course.level)}`}>
                    {course.level}
                  </span>
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    ★ {course.rating}
                  </div>
                </div>
                <h3 className="text-white font-semibold mb-1">{course.title}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{course.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                  <span>⏱ {course.duration}</span>
                  <span>📖 {course.modules} modules</span>
                  <span>👥 {course.students.toLocaleString()} students</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{course.category}</span>
                  <button
                    onClick={() => setSelectedCourse(course)}
                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-medium transition-colors"
                  >
                    Start Course →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTF Challenges Tab */}
        {activeTab === 'CTF Challenges' && (
          <div className="space-y-3">
            {CTF_CHALLENGES.map(ctf => (
              <div key={ctf.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-lg font-bold text-cyan-400 font-mono">
                    {ctf.points}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-medium">{ctf.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(ctf.difficulty)}`}>
                        {ctf.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm truncate">{ctf.description}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>Category: {ctf.category}</span>
                      <span>{ctf.solves.toLocaleString()} solves</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCtf(ctf)}
                    className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-sm text-cyan-400 font-medium transition-colors whitespace-nowrap"
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Labs Tab */}
        {activeTab === 'Labs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { name: 'Web Exploitation Lab', description: 'Hands-on lab with vulnerable web applications including DVWA, WebGoat, and Juice Shop.', tools: ['Burp Suite', 'SQLMap', 'Nikto'], machines: 5, status: 'available' },
              { name: 'Network Pen Testing Lab', description: 'Full network environment with multiple subnets, services, and vulnerabilities to exploit.', tools: ['Nmap', 'Metasploit', 'Wireshark'], machines: 8, status: 'available' },
              { name: 'Active Directory Lab', description: 'Complete AD environment with domain controllers, workstations, and realistic misconfigurations.', tools: ['BloodHound', 'Mimikatz', 'Rubeus'], machines: 6, status: 'available' },
              { name: 'Cloud Security Lab', description: 'AWS/Azure environments with IAM misconfigurations, exposed services, and S3 bucket issues.', tools: ['Prowler', 'ScoutSuite', 'Pacu'], machines: 4, status: 'coming_soon' },
              { name: 'Malware Analysis Lab', description: 'Sandboxed environment for safe dynamic and static analysis of malware samples.', tools: ['Ghidra', 'x64dbg', 'YARA'], machines: 3, status: 'available' },
              { name: 'IoT Security Lab', description: 'IoT devices and firmware for testing wireless protocols, hardware hacking, and firmware analysis.', tools: ['Binwalk', 'Firmwalker', 'Attify'], machines: 4, status: 'coming_soon' },
            ].map((lab, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">{lab.name}</h4>
                  {lab.status === 'coming_soon' && (
                    <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] font-bold text-yellow-400">SOON</span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-3">{lab.description}</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {lab.tools.map(tool => (
                      <span key={tool} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{tool}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{lab.machines} machines</span>
                    <button
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        lab.status === 'available'
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={lab.status !== 'available'}
                    >
                      {lab.status === 'available' ? 'Launch Lab →' : 'Coming Soon'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === 'Certifications' && (
          <div className="space-y-4">
            {CERTIFICATIONS.map((cert, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center text-xl flex-shrink-0">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-semibold">{cert.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(cert.difficulty)}`}>
                        {cert.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{cert.description}</p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Provider: {cert.org}</span>
                      <span>Exam Fee: {cert.price}</span>
                      <span>Platform Coverage: {cert.coverage}%</span>
                    </div>
                    {/* Coverage bar */}
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full" style={{ width: `${cert.coverage}%` }} />
                        </div>
                        <span className="text-xs text-cyan-400 font-medium">{cert.coverage}%</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">Our platform covers {cert.coverage}% of this certification's exam topics</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tutorials Tab */}
        {activeTab === 'Tutorials' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { title: 'Getting Started with Nmap', category: 'Reconnaissance', duration: '15 min', level: 'Beginner' },
              { title: 'Burp Suite Pro Configuration', category: 'Web Testing', duration: '20 min', level: 'Beginner' },
              { title: 'Writing Custom Nmap Scripts (NSE)', category: 'Scripting', duration: '30 min', level: 'Intermediate' },
              { title: 'Metasploit Framework Deep Dive', category: 'Exploitation', duration: '45 min', level: 'Intermediate' },
              { title: 'BloodHound for AD Enumeration', category: 'Active Directory', duration: '25 min', level: 'Advanced' },
              { title: 'Python for Penetration Testers', category: 'Scripting', duration: '60 min', level: 'Intermediate' },
              { title: 'Wireless Network Hacking with Aircrack-ng', category: 'Wireless', duration: '35 min', level: 'Intermediate' },
              { title: 'Docker Security Best Practices', category: 'Container Security', duration: '20 min', level: 'Intermediate' },
            ].map((tutorial, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm">{tutorial.title}</h4>
                  <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                    <span>{tutorial.category}</span>
                    <span>·</span>
                    <span>{tutorial.duration}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(tutorial.level)}`}>
                  {tutorial.level}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Course Detail Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCourse(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(selectedCourse.level)}`}>
                    {selectedCourse.level}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-2">{selectedCourse.title}</h2>
                  <p className="text-gray-400 text-sm mt-1">{selectedCourse.category}</p>
                </div>
                <button onClick={() => setSelectedCourse(null)} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
              </div>

              <p className="text-gray-300 mb-4">{selectedCourse.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{selectedCourse.modules}</p>
                  <p className="text-xs text-gray-500">Modules</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{selectedCourse.duration}</p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-cyan-400">{selectedCourse.students.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Students</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-yellow-400">★ {selectedCourse.rating}</p>
                  <p className="text-xs text-gray-500">Rating</p>
                </div>
              </div>

              {/* Syllabus */}
              <h3 className="text-white font-semibold mb-3">Course Syllabus</h3>
              <div className="space-y-2 mb-6">
                {Array.from({ length: Math.min(selectedCourse.modules, 8) }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/30 border border-gray-800 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-400 font-mono flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-gray-300 text-sm">
                      {['Introduction & Environment Setup', 'Core Concepts & Theory', 'Hands-on: Basic Techniques', 'Intermediate Exploitation Methods', 'Advanced Attack Vectors', 'Defense & Mitigation Strategies', 'Real-world Case Studies', 'Final Assessment & Certification'][i]}
                    </span>
                    <span className="ml-auto text-xs text-gray-600">{Math.ceil(parseFloat(selectedCourse.duration) / selectedCourse.modules * (i + 1) * 10) / 10} min</span>
                  </div>
                ))}
                {selectedCourse.modules > 8 && (
                  <p className="text-center text-gray-500 text-xs py-2">+ {selectedCourse.modules - 8} more modules</p>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-emerald-400">{selectedCourse.progress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all" style={{ width: `${selectedCourse.progress}%` }} />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all"
                >
                  Begin Learning
                </button>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTF Challenge Detail Modal */}
        {selectedCtf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCtf(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLevelColor(selectedCtf.difficulty)}`}>
                      {selectedCtf.difficulty}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">{selectedCtf.category}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedCtf.title}</h2>
                </div>
                <button onClick={() => setSelectedCtf(null)} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
              </div>

              <p className="text-gray-300 mb-5">{selectedCtf.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-cyan-400 font-mono">{selectedCtf.points}</p>
                  <p className="text-xs text-gray-500">Points</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-300">{selectedCtf.solves.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Solves</p>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-4 mb-6">
                <h4 className="text-white text-sm font-medium mb-2">Challenge Environment</h4>
                <div className="space-y-1.5 text-sm text-gray-400">
                  <p>• A dedicated container will be spawned for this challenge</p>
                  <p>• You have 60 minutes to capture the flag</p>
                  <p>• Submit the flag in format: <code className="text-cyan-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">CTF&#123;...&#125;</code></p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all"
                >
                  🏴 Launch Challenge
                </button>
                <button
                  onClick={() => setSelectedCtf(null)}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
