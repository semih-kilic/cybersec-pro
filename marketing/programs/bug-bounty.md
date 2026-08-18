# CyberSec Pro Security Disclosure Program

> Help us keep our platform and users safe. We reward responsible security research.

## Program Overview

CyberSec Pro invites security researchers to find and report vulnerabilities in our platform. We believe in transparency and collaboration — if you find a bug, we want to hear about it.

**Program Start**: August 18, 2026
**Response Time**: Within 48 hours of report
**Disclosure Timeline**: 90 days from report (coordinated disclosure)

## Scope

### In Scope

| Asset | URL |
|-------|-----|
| Web Application | `https://app.cyber-sec-pro.com` |
| API | `https://api.cyber-sec-pro.com` |
| Landing Page | `https://cyber-sec-pro.com` |
| CLI Tool | `cybersec-cli` (open source) |
| Docker Images | `ghcr.io/semih-kilic/*` |

### Out of Scope

- Social engineering (phishing, pretexting)
- Physical attacks against employees or infrastructure
- Denial of Service (DoS/DDoS) attacks
- Vulnerabilities in third-party services (Stripe, Cloudflare, Mailjet)
- Attacks on other users' accounts (only test with your own)
- Issues already reported in our Hall of Fame

## Severity Levels & Rewards

### Critical (CVSS 9.0-10.0)

**Examples**: Remote code execution, SQL injection, authentication bypass, privilege escalation to admin, complete data exfiltration.

**Reward**:
- $500 USD credit toward CyberSec Pro subscription
- 1 year free Professional plan
- Hall of Fame recognition
- Swag pack (t-shirt, stickers)

### High (CVSS 7.0-8.9)

**Examples**: Stored XSS, CSRF on sensitive actions, IDOR exposing other users' data, SSRF, broken access control.

**Reward**:
- $200 USD credit toward CyberSec Pro subscription
- 6 months free Professional plan
- Hall of Fame recognition

### Medium (CVSS 4.0-6.9)

**Examples**: Reflected XSS, information disclosure (stack traces, version info), missing security headers, CORS misconfiguration.

**Reward**:
- $50 USD credit toward CyberSec Pro subscription
- 3 months free Professional plan
- Hall of Fame recognition

### Low (CVSS 0.1-3.9)

**Examples**: Best practice violations, minor information disclosure, verbose error messages, clickjacking on non-sensitive pages.

**Reward**:
- 1 month free Starter plan
- Hall of Fame recognition

## Rules of Engagement

1. **Test with your own accounts only.** Never access another user's data.
2. **Minimize disruption.** Don't run automated scans that impact service availability.
3. **Report promptly.** Don't publicly disclose until we've had 90 days to fix.
4. **No data exfiltration.** If you access data, describe the vulnerability but don't extract it.
5. **Good faith.** We won't pursue legal action against researchers who follow these rules.

## How to Report

**Email**: security@cyber-sec-pro.com

**Include**:
- Description of the vulnerability
- Steps to reproduce (PoC code/screenshots)
- Affected URL/endpoint
- Impact assessment
- Your preferred contact method

**PGP Key**: Available at `https://cyber-sec-pro.com/.well-known/security.txt`

## Safe Harbor

We consider security research conducted under this policy to be:

- Authorized under applicable anti-hacking laws
- Exempt from DMCA restrictions on circumventing technical measures
- Conducted in good faith

We will not initiate legal action against researchers who follow this policy.

## Hall of Fame

| Researcher | Date | Severity | Vulnerability |
|-----------|------|----------|---------------|
| *No reports yet — be the first!* | | | |

## Changelog

| Date | Change |
|------|--------|
| 2026-08-18 | Program launched |
