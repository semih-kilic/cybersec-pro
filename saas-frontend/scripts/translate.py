#!/usr/bin/env python3
"""
CyberSec Pro - DeepL Auto-Translation Script
=============================================
Translates EN locale JSON → DE, FR, ES, IT using DeepL API.
Preserves technical glossary terms (682 tool names, security jargon).

Usage:
  # Set API key (free or pro)
  export DEEPL_API_KEY="your-api-key-here"
  
  # Translate all languages
  python3 scripts/translate.py
  
  # Translate specific language
  python3 scripts/translate.py --lang de
  
  # Dry run (show what would be translated)
  python3 scripts/translate.py --dry-run
  
  # Force re-translate all (ignore existing)
  python3 scripts/translate.py --force
  
  # Use free API endpoint
  python3 scripts/translate.py --free-api
"""

import json
import os
import sys
import re
import time
import argparse
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

try:
    import deepl
except ImportError:
    print("❌ DeepL library not installed. Run: pip3 install --break-system-packages deepl")
    sys.exit(1)

# ============================================================================
# Configuration
# ============================================================================

LOCALES_DIR = Path(__file__).parent.parent / "src" / "i18n" / "locales"
SOURCE_LANG = "EN"
TARGET_LANGUAGES = {
    "de": "DE",
    "fr": "FR",
    "es": "ES",
    "it": "IT",
}

# DeepL language codes mapping
DEEPL_LANG_MAP = {
    "de": "DE",
    "fr": "FR",
    "es": "ES",
    "it": "IT",
}

# ============================================================================
# Technical Glossary - Terms that should NOT be translated
# ============================================================================

# Security/technical terms that must stay in English
TECHNICAL_TERMS: Set[str] = {
    # Product names
    "CyberSec Pro", "Kali Linux", "Kali", "Metasploit", "Metasploit Framework",
    "Burp Suite", "Nmap", "Wireshark", "Nessus", "OpenVAS", "OWASP",
    
    # Protocols & standards
    "HTTP", "HTTPS", "SSL", "TLS", "SSH", "FTP", "SMTP", "DNS", "TCP", "UDP",
    "ICMP", "ARP", "DHCP", "SNMP", "LDAP", "SMB", "RDP", "VPN", "WPA", "WPA2",
    "WPA3", "WEP", "SAML", "SSO", "OAuth", "JWT", "REST", "API", "CORS",
    "WebSocket",
    
    # Security concepts (keep English in context)
    "CVE", "CVSS", "CWE", "OWASP", "GDPR", "DSGVO", "RGPD",
    "XSS", "CSRF", "SQL Injection", "SQLi", "RCE", "LFI", "RFI",
    "SSRF", "XXE", "IDOR", "MITM", "DDoS", "DoS", "APT",
    "Zero-day", "Payload", "Exploit", "Shell", "Reverse Shell",
    "Backdoor", "Rootkit", "Malware", "Ransomware", "Phishing",
    "Brute Force", "Dictionary Attack", "Hash", "Rainbow Table",
    "Pentest", "Pentesting", "Penetration Testing", "Red Team", "Blue Team",
    "Bug Bounty", "CTF", "OSINT",
    
    # Technical computing terms
    "Docker", "Kubernetes", "Linux", "Windows", "macOS", "Ubuntu", "Debian",
    "Python", "JavaScript", "TypeScript", "Node.js", "React", "Nginx",
    "JSON", "YAML", "XML", "CSV", "PDF", "HTML", "CSS",
    "Git", "GitHub", "GitLab", "CI/CD", "DevOps", "DevSecOps",
    "CPU", "RAM", "SSD", "IP", "IPv4", "IPv6", "MAC", "BIOS", "UEFI",
    "VM", "Container", "Proxy", "Firewall", "IDS", "IPS", "WAF", "SIEM",
    "EDR", "XDR", "SOC", "NOC",
    
    # UI/UX terms that are standard
    "Dashboard", "Live", "Pro", "Enterprise", "Team", "Starter",
    "Professional",
    
    # File/data formats
    "Nmap XML", "SARIF", "JUnit", "STIX", "TAXII",
    
    # Semih Kılıç (name)
    "Semih Kılıç",
}

# i18next interpolation pattern: {{variable}}
I18N_INTERPOLATION_RE = re.compile(r'\{\{[^}]+\}\}')

# ============================================================================
# Glossary Builder - Extract 682 tool names from database
# ============================================================================

def build_tool_glossary() -> Set[str]:
    """Extract all tool names from the CyberSec Pro database."""
    db_path = Path(__file__).parent.parent.parent / "saas-backend" / "instance" / "cybersec_saas.db"
    
    tool_names: Set[str] = set()
    
    if db_path.exists():
        try:
            db = sqlite3.connect(str(db_path))
            cursor = db.execute("SELECT name FROM tools ORDER BY name")
            for row in cursor.fetchall():
                tool_names.add(row[0])
            db.close()
            print(f"📦 Loaded {len(tool_names)} tool names from database")
        except Exception as e:
            print(f"⚠️  Could not read tools database: {e}")
    else:
        print(f"⚠️  Database not found at {db_path}")
    
    return tool_names


def get_full_glossary() -> Set[str]:
    """Combine technical terms + tool names into full glossary."""
    glossary = TECHNICAL_TERMS.copy()
    tool_names = build_tool_glossary()
    glossary.update(tool_names)
    return glossary


# ============================================================================
# Translation Engine
# ============================================================================

class DeepLTranslator:
    """Handles DeepL API translation with glossary protection."""
    
    def __init__(self, api_key: str, free_api: bool = False):
        """Initialize DeepL translator.
        
        Args:
            api_key: DeepL API key
            free_api: Use free API endpoint (api-free.deepl.com)
        """
        server_url = "https://api-free.deepl.com" if free_api else None
        self.translator = deepl.Translator(api_key, server_url=server_url)
        self.glossary = get_full_glossary()
        self.request_count = 0
        self.char_count = 0
        
        # Verify API key
        try:
            usage = self.translator.get_usage()
            if usage.character:
                print(f"🔑 DeepL API connected: {usage.character.count:,}/{usage.character.limit:,} chars used")
            else:
                print(f"🔑 DeepL API connected")
        except Exception as e:
            print(f"❌ DeepL API connection failed: {e}")
            sys.exit(1)
    
    def _protect_glossary_terms(self, text: str) -> tuple[str, dict]:
        """Replace glossary terms with placeholders before translation.
        
        Returns:
            Tuple of (protected_text, placeholder_map)
        """
        placeholder_map = {}
        protected = text
        counter = 0
        
        # First protect i18next interpolation variables {{var}}
        for match in I18N_INTERPOLATION_RE.finditer(text):
            placeholder = f"⟦VAR{counter}⟧"
            placeholder_map[placeholder] = match.group()
            protected = protected.replace(match.group(), placeholder, 1)
            counter += 1
        
        # Sort glossary terms by length (longest first) to avoid partial matches
        sorted_terms = sorted(self.glossary, key=len, reverse=True)
        
        for term in sorted_terms:
            if term in protected:
                # Use word boundary check for short terms
                if len(term) <= 3:
                    pattern = re.compile(r'\b' + re.escape(term) + r'\b')
                    if pattern.search(protected):
                        placeholder = f"⟦T{counter}⟧"
                        placeholder_map[placeholder] = term
                        protected = pattern.sub(placeholder, protected)
                        counter += 1
                else:
                    placeholder = f"⟦T{counter}⟧"
                    placeholder_map[placeholder] = term
                    protected = protected.replace(term, placeholder)
                    counter += 1
        
        return protected, placeholder_map
    
    def _restore_glossary_terms(self, text: str, placeholder_map: dict) -> str:
        """Restore original terms from placeholders after translation."""
        restored = text
        for placeholder, original in placeholder_map.items():
            restored = restored.replace(placeholder, original)
        return restored
    
    def translate_text(self, text: str, target_lang: str) -> str:
        """Translate a single text string with glossary protection.
        
        Args:
            text: English text to translate
            target_lang: Target language code (DE, FR, ES, IT)
            
        Returns:
            Translated text with glossary terms preserved
        """
        if not text or not text.strip():
            return text
        
        # Don't translate if text is only technical terms/symbols
        stripped = text.strip()
        if stripped in self.glossary:
            return text
        
        # Protect glossary terms
        protected_text, placeholder_map = self._protect_glossary_terms(text)
        
        # If everything was replaced by placeholders, no need to translate
        remaining = re.sub(r'⟦[^⟧]+⟧', '', protected_text).strip()
        if not remaining or all(c in ' •→←↑↓★⭐✓✗🔍🌐🔐🛡️💀📊🍪🚀' for c in remaining):
            return self._restore_glossary_terms(protected_text, placeholder_map)
        
        try:
            result = self.translator.translate_text(
                protected_text,
                source_lang="EN",
                target_lang=target_lang,
                preserve_formatting=True,
                tag_handling=None,
            )
            self.request_count += 1
            self.char_count += len(text)
            
            translated = result.text
            
            # Restore glossary terms
            translated = self._restore_glossary_terms(translated, placeholder_map)
            
            return translated
            
        except deepl.QuotaExceededException:
            print(f"\n❌ DeepL API quota exceeded!")
            sys.exit(1)
        except Exception as e:
            print(f"\n⚠️  Translation error for '{text[:50]}...': {e}")
            return text  # Return original on error
    
    def translate_json_value(self, value: Any, target_lang: str, key_path: str = "") -> Any:
        """Recursively translate JSON values.
        
        Args:
            value: JSON value (string, dict, list, or primitive)
            target_lang: Target language code
            key_path: Dot-separated key path for context
            
        Returns:
            Translated value
        """
        if isinstance(value, str):
            return self.translate_text(value, target_lang)
        elif isinstance(value, dict):
            return {
                k: self.translate_json_value(v, target_lang, f"{key_path}.{k}" if key_path else k)
                for k, v in value.items()
            }
        elif isinstance(value, list):
            return [self.translate_json_value(item, target_lang, key_path) for item in value]
        else:
            return value  # numbers, booleans, null
    
    def translate_locale(
        self,
        source_data: Dict[str, Any],
        target_lang: str,
        existing_data: Optional[Dict[str, Any]] = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        """Translate entire locale JSON from EN to target language.
        
        Args:
            source_data: English source JSON
            target_lang: Target language code (DE, FR, ES, IT)
            existing_data: Existing translations to preserve (unless force=True)
            force: Force re-translate all keys
            
        Returns:
            Translated JSON data
        """
        result = {}
        
        for section_key, section_data in source_data.items():
            if isinstance(section_data, dict):
                existing_section = (existing_data or {}).get(section_key, {})
                translated_section = {}
                
                for key, value in section_data.items():
                    full_key = f"{section_key}.{key}"
                    
                    if isinstance(value, dict):
                        # Nested dict (e.g., landing.footer)
                        existing_nested = existing_section.get(key, {}) if isinstance(existing_section, dict) else {}
                        translated_nested = {}
                        
                        for nk, nv in value.items():
                            nested_key = f"{full_key}.{nk}"
                            if not force and isinstance(existing_nested, dict) and nk in existing_nested:
                                translated_nested[nk] = existing_nested[nk]
                            else:
                                print(f"  🔄 {nested_key}")
                                translated_nested[nk] = self.translate_json_value(nv, target_lang, nested_key)
                        
                        translated_section[key] = translated_nested
                    else:
                        if not force and isinstance(existing_section, dict) and key in existing_section:
                            translated_section[key] = existing_section[key]
                        else:
                            print(f"  🔄 {full_key}")
                            translated_section[key] = self.translate_json_value(value, target_lang, full_key)
                
                result[section_key] = translated_section
            else:
                result[section_key] = section_data
        
        return result


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="CyberSec Pro - DeepL Auto-Translation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/translate.py                    # Translate all languages
  python3 scripts/translate.py --lang de          # German only
  python3 scripts/translate.py --force             # Re-translate everything
  python3 scripts/translate.py --dry-run          # Preview only
  python3 scripts/translate.py --free-api         # Use DeepL Free API
  python3 scripts/translate.py --export-glossary  # Export glossary to JSON
        """,
    )
    parser.add_argument("--lang", choices=["de", "fr", "es", "it"], help="Translate specific language only")
    parser.add_argument("--force", action="store_true", help="Force re-translate all (ignore existing)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be translated")
    parser.add_argument("--free-api", action="store_true", help="Use DeepL Free API endpoint")
    parser.add_argument("--export-glossary", action="store_true", help="Export glossary to JSON file")
    parser.add_argument("--api-key", help="DeepL API key (or set DEEPL_API_KEY env var)")
    
    args = parser.parse_args()
    
    # Export glossary mode
    if args.export_glossary:
        glossary = get_full_glossary()
        glossary_file = LOCALES_DIR.parent / "glossary.json"
        with open(glossary_file, "w", encoding="utf-8") as f:
            json.dump({
                "description": "Technical terms that should NOT be translated",
                "total": len(glossary),
                "terms": sorted(glossary),
            }, f, indent=2, ensure_ascii=False)
        print(f"📝 Exported {len(glossary)} glossary terms to {glossary_file}")
        return
    
    # Get API key (not needed for dry-run or export-glossary)
    api_key = args.api_key or os.environ.get("DEEPL_API_KEY")
    if not api_key and not args.dry_run:
        print("❌ No DeepL API key found!")
        print("")
        print("Set your API key:")
        print("  export DEEPL_API_KEY='your-key-here'")
        print("")
        print("Get a free API key at: https://www.deepl.com/pro-api")
        print("  Free plan: 500,000 chars/month")
        print("  Pro plan:  Unlimited")
        sys.exit(1)
    
    # Load source locale (EN)
    source_file = LOCALES_DIR / "en.json"
    if not source_file.exists():
        print(f"❌ Source file not found: {source_file}")
        sys.exit(1)
    
    with open(source_file, "r", encoding="utf-8") as f:
        source_data = json.load(f)
    
    print(f"📄 Source: en.json ({sum(1 for _ in _flatten_keys(source_data))} keys)")
    
    # Determine target languages
    targets = {args.lang: DEEPL_LANG_MAP[args.lang]} if args.lang else TARGET_LANGUAGES.copy()
    
    if args.dry_run:
        print(f"\n🔍 DRY RUN - Would translate to: {', '.join(targets.keys())}")
        for lang_code in targets:
            target_file = LOCALES_DIR / f"{lang_code}.json"
            existing = {}
            if target_file.exists() and not args.force:
                with open(target_file, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            
            all_keys = list(_flatten_keys(source_data))
            new_keys = []
            for key_path in all_keys:
                if args.force or not _key_exists(existing, key_path):
                    new_keys.append(key_path)
            
            print(f"\n  {lang_code.upper()}: {len(new_keys)}/{len(all_keys)} keys to translate")
            for key in new_keys[:10]:
                print(f"    + {key}")
            if len(new_keys) > 10:
                print(f"    ... and {len(new_keys) - 10} more")
        return
    
    # Initialize translator
    translator = DeepLTranslator(api_key, free_api=args.free_api)
    
    print(f"\n🌐 Translating to: {', '.join(t.upper() for t in targets.keys())}")
    print(f"📚 Glossary: {len(translator.glossary)} protected terms")
    print(f"{'=' * 60}")
    
    total_start = time.time()
    
    for lang_code, deepl_code in targets.items():
        target_file = LOCALES_DIR / f"{lang_code}.json"
        
        # Load existing translations
        existing = {}
        if target_file.exists() and not args.force:
            with open(target_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        
        print(f"\n🇪🇺 Translating → {lang_code.upper()}")
        lang_start = time.time()
        
        translated = translator.translate_locale(
            source_data,
            deepl_code,
            existing_data=existing,
            force=args.force,
        )
        
        # Save translated file
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(translated, f, indent=2, ensure_ascii=False)
            f.write("\n")  # trailing newline
        
        lang_time = time.time() - lang_start
        print(f"  ✅ {lang_code}.json saved ({lang_time:.1f}s)")
    
    total_time = time.time() - total_start
    print(f"\n{'=' * 60}")
    print(f"✅ Translation complete!")
    print(f"   Languages: {len(targets)}")
    print(f"   API requests: {translator.request_count}")
    print(f"   Characters: {translator.char_count:,}")
    print(f"   Time: {total_time:.1f}s")
    
    # Validate output
    print(f"\n🔍 Validating JSON files...")
    all_valid = True
    for lang_code in targets:
        target_file = LOCALES_DIR / f"{lang_code}.json"
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            source_keys = set(_flatten_keys(source_data))
            target_keys = set(_flatten_keys(data))
            missing = source_keys - target_keys
            if missing:
                print(f"  ⚠️  {lang_code}.json: {len(missing)} missing keys")
                all_valid = False
            else:
                print(f"  ✅ {lang_code}.json: {len(target_keys)} keys OK")
        except json.JSONDecodeError as e:
            print(f"  ❌ {lang_code}.json: Invalid JSON - {e}")
            all_valid = False
    
    if all_valid:
        print(f"\n🎉 All files valid! Run 'npm run build' to rebuild.")
    else:
        print(f"\n⚠️  Some issues found. Check the files above.")


def _flatten_keys(data: Dict, prefix: str = "") -> list:
    """Flatten nested dict keys into dot-notation."""
    keys = []
    for k, v in data.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.extend(_flatten_keys(v, full_key))
        else:
            keys.append(full_key)
    return keys


def _key_exists(data: Dict, key_path: str) -> bool:
    """Check if a dot-notation key exists in nested dict."""
    parts = key_path.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return False
    return True


if __name__ == "__main__":
    main()
