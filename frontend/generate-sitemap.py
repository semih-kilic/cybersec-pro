#!/usr/bin/env python3
import os
import sys
from datetime import datetime

LOCALES = [
    ("en", "en"),
    ("tr", "tr"),
    ("de", "de"),
    ("fr", "fr"),
    ("es", "es"),
    ("ar", "ar"),
    ("ja", "ja"),
    ("zh", "zh"),
    ("ru", "ru"),
    ("ko", "ko"),
]

def add_url(loc, lastmod, changefreq, priority, hreflangs=None):
    url = "  <url>\n    <loc>" + loc + "</loc>\n"
    url += "    <lastmod>" + lastmod + "</lastmod>\n"
    url += "    <changefreq>" + changefreq + "</changefreq>\n"
    url += "    <priority>" + str(priority) + "</priority>"
    if hreflangs:
        for hrf, href in hreflangs:
            url += "\n    <xhtml:link rel=\"alternate\" hreflang=\"" + hrf + "\" href=\"" + href + "\" />"
    url += "\n  </url>"
    return url

def main():
    LOCALES = [
        ("en", "en"),
        ("tr", "tr"),
        ("de", "de"),
        ("fr", "fr"),
        ("es", "es"),
        ("ar", "ar"),
        ("ja", "ja"),
        ("zh", "zh"),
        ("ru", "ru"),
        ("ko", "ko"),
    ]

    def hreflang_links(path):
        links = []
        for lc, hrf in LOCALES:
            prefix = "/" + lc if lc != "en" else ""
            links.append((hrf, "https://cyber-sec-pro.com" + prefix + path))
        links.append(("x-default", "https://cyber-sec-pro.com" + ("/" if path == "" else "/") + path.lstrip("/")))
        return links

    def add_url(loc, lastmod, changefreq, priority, hreflangs=None):
        url = "  <url>\n    <loc>" + loc + "</loc>\n"
        url += "    <lastmod>" + lastmod + "</lastmod>\n"
        url += "    <changefreq>" + changefreq + "</changefreq>\n"
        url += "    <priority>" + str(priority) + "</priority>"
        if hreflangs:
            for hrf, href in hreflangs:
                url += "\n    <xhtml:link rel=\"alternate\" hreflang=\"" + hrf + "\" href=\"" + href + "\" />"
        url += "\n  </url>"
        return url

    urls = []

    # Home pages for all locales
    for lc, hrf in LOCALES:
        prefix = "/" + lc if lc != "en" else ""
        hreflangs = []
        for lc2, hrf2 in LOCALES:
            prefix2 = "/" + lc2 if lc2 != "en" else ""
            hreflangs.append((hrf2, "https://cyber-sec-pro.com" + prefix2 + "/"))
        hreflangs.append(("x-default", "https://cyber-sec-pro.com/"))

        urls.append(add_url(
            "https://cyber-sec-pro.com" + prefix + "/",
            "2026-04-14", "weekly", 1.0 if lc == "en" else 0.9,
            [("en", "https://cyber-sec-pro.com/"), ("tr", "https://cyber-sec-pro.com/tr/"),
             ("de", "https://cyber-sec-pro.com/de/"), ("fr", "https://cyber-sec-pro.com/fr/"),
             ("es", "https://cyber-sec-pro.com/es/"), ("ar", "https://cyber-sec-pro.com/ar/"),
             ("ja", "https://cyber-sec-pro.com/ja/"), ("zh", "https://cyber-sec-pro.com/zh/"),
             ("ru", "https://cyber-sec-pro.com/ru/"), ("ko", "https://cyber-sec-pro.com/ko/"),
             ("x-default", "https://cyber-sec-pro.com/")]
        ))

    # Tools page
    for lc, hrf in LOCALES:
        prefix = "/" + lc if lc != "en" else ""
        hreflangs = []
        for lc2, hrf2 in LOCALES:
            prefix2 = "/" + lc2 if lc2 != "en" else ""
            hreflangs.append((hrf2, "https://cyber-sec-pro.com" + prefix2 + "/tools/"))
        hreflangs.append(("x-default", "https://cyber-sec-pro.com/en/tools/"))

        urls.append(add_url(
            "https://cyber-sec-pro.com" + prefix + "/tools/",
            "2026-04-14", "weekly", 0.9,
            [("en", "https://cyber-sec-pro.com/tools/"), ("tr", "https://cyber-sec-pro.com/tr/tools/"),
             ("de", "https://cyber-sec-pro.com/de/tools/"), ("fr", "https://cyber-sec-pro.com/fr/tools/"),
             ("es", "https://cyber-sec-pro.com/es/tools/"), ("ar", "https://cyber-sec-pro.com/ar/tools/"),
             ("ja", "https://cyber-sec-pro.com/ja/tools/"), ("zh", "https://cyber-sec-pro.com/zh/tools/"),
             ("ru", "https://cyber-sec-pro.com/ru/tools/"), ("ko", "https://cyber-sec-pro.com/ko/tools/"),
             ("x-default", "https://cyber-sec-pro.com/en/tools/")]
        ))

    # Blog posts
    BLOG_POSTS = [
        ("blog/mastering-wireshark", "2026-01-15", "monthly", 0.8),
        ("blog/hashcat-vs-john", "2026-01-12", "monthly", 0.8),
        ("blog/owasp-top-10-2026", "2026-01-08", "monthly", 0.8),
        ("blog/metasploit-zero-to-exploit", "2026-01-05", "monthly", 0.8),
        ("blog/ci-cd-pentest-automation", "2026-01-03", "monthly", 0.8),
        ("blog/wireless-security-assessment", "2025-12-15", "monthly", 0.8),
        ("blog/nmap-network-scanning", "2025-12-10", "monthly", 0.8),
        ("blog/metasploit-exploitation", "2025-12-08", "monthly", 0.8),
        ("blog/hashcat-password-cracking", "2025-11-28", "monthly", 0.8),
    ]

    urls = []

    for slug, lastmod, cf, prio in BLOG_POSTS:
        urls.append("  <url>\n    <loc>https://cyber-sec-pro.com/en/" + slug + "/</loc>\n    <lastmod>" + lastmod + "</lastmod>\n    <changefreq>" + cf + "</changefreq>\n    <priority>" + str(prio) + "</priority>\n    <xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"https://cyber-sec-pro.com/en/" + slug + "/\" />\n    <xhtml:link rel=\"alternate\" hreflang=\"tr\" href=\"https://cyber-sec-pro.com/tr/" + slug + "/\" />\n    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"https://cyber-sec-pro.com/en/" + slug + "/\" />\n  </url>")

        # Turkish version
        urls.append("  <url>\n    <loc>https://cyber-sec-pro.com/tr/" + slug + "/</loc>\n    <lastmod>" + lastmod + "</lastmod>\n    <changefreq>" + cf + "</changefreq>\n    <priority>" + str(prio * 0.875) + "</priority>\n  </url>")

    # Other pages
    OTHER_PAGES = [
        ("about", "monthly", 0.8),
        ("docs", "weekly", 0.8),
        ("api-reference", "monthly", 0.7),
        ("contact", "monthly", 0.6),
        ("careers", "monthly", 0.6),
        ("security", "monthly", 0.7),
        ("tests", "monthly", 0.7),
        ("privacy", "yearly", 0.3),
        ("terms", "yearly", 0.3),
    ]

    for page, cf, prio in OTHER_PAGES:
        for lc, hrf in LOCALES:
            prefix = "/" + lc if lc != "en" else ""
            hreflangs = []
            for lc2, hrf2 in LOCALES:
                prefix2 = "/" + lc2 if lc2 != "en" else ""
                hreflangs.append((hrf2, "https://cyber-sec-pro.com" + prefix2 + "/" + page + "/"))
            hreflangs.append(("x-default", "https://cyber-sec-pro.com/en/" + page + "/"))
            urls.append(add_url(
                "https://cyber-sec-pro.com" + prefix + "/" + page + "/",
                "2026-04-14", cf, prio, hreflangs
            ))

    # Build XML
    xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n" + "\n".join(urls) + "\n</urlset>"

    out_dir = "/home/cybersec/cybersec-pro/frontend/out"
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "sitemap.xml"), "w") as f:
        f.write(xml)
    print("Sitemap generated at", out_dir + "/sitemap.xml")
    print("Total URLs:", len(urls))

if __name__ == "__main__":
    main()