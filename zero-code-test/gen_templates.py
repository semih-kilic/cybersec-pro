#!/usr/bin/env python3
# Full-option-string placeholder style: empty placeholder => option omitted (never breaks command).
TPL = {
"aircrack-ng":     "aircrack-ng {target} {wordlist} {bssid}",
"amass":           "amass enum -passive -d {domain}",
"assetfinder":     "assetfinder {domain} {subs_only}",
"bettercap":       "bettercap -iface {target} {eval_script}",
"binwalk":         "binwalk {target} {options}",
"bloodhound-python":"bloodhound-python -u {username} -p {password} -d {domain} -c {collection}",
"bulk_extractor":  "bulk_extractor {target} {output}",
"cewl":            "cewl {url} {depth} {min_length} {output}",
"chisel":          "chisel client {target} {options}",
"chntpw":          "chntpw {target} {options}",
"crackmapexec":    "netexec smb {target} {creds} {options}",
"dirsearch":       "dirsearch -u {url} {extensions} {threads}",
"dnsenum":         "dnsenum {domain} {options}",
"dnsrecon":        "dnsrecon -d {domain} {type}",
"dsniff":          "dsniff -i {target} {options}",
"enum4linux":      "enum4linux {target} {options}",
"enum4linux-ng":   "enum4linux-ng {target} {options}",
"ettercap":        "ettercap -T -i {target} {options}",
"evil-winrm":      "evil-winrm -i {target} -u {username} -p {password} {options}",
"fcrackzip":       "fcrackzip {target} {wordlist}",
"feroxbuster":     "feroxbuster -u {url} {wordlist} {depth} {threads}",
"ffuf":            "ffuf -u {url} {wordlist} {matches}",
"fierce":          "fierce --domain {domain} {options}",
"foremost":        "foremost -i {target} {output}",
"fping":           "fping {target} {options}",
"gospider":        "gospider -s {url} {depth} {options}",
"hashcat":         "hashcat -m {mode} -a {attack_mode} {target} {wordlist} {options}",
"hashid":          "hashid {target} {options}",
"hping3":          "hping3 {target} {options}",
"joomscan":        "joomscan --url {url} {options}",
"kismet":          "kismet -c {target} {options}",
"macchanger":      "macchanger {target} {options}",
"masscan":         "masscan {target} {ports} {rate}",
"mitmproxy":       "mitmproxy --listen-port {target} {options}",
"msfvenom":        "msfvenom -p {target} LHOST={lhost} LPORT={lport} -f {format} -o {output} {options}",
"ncat":            "ncat {target} {options}",
"ncrack":          "ncrack {target} {options}",
"netdiscover":     "netdiscover -r {target} {options}",
"netexec":         "netexec smb {target} {creds} {options}",
"nikto":           "nikto -h {target} {options}",
"nmap":            "nmap {target} {options}",
"nuclei":          "nuclei -u {url} {severity} {options}",
"photorec":        "photorec {output} {target}",
"pixiewps":        "pixiewps {target} {options}",
"radare2":         "radare2 {target} {options}",
"reaver":          "reaver -i {target} -b {bssid} {options}",
"regripper":       "regripper -r {target} -p {plugin} {options}",
"responder":       "responder -I {target} {options}",
"rizin":           "rizin {target} {options}",
"samdump2":        "samdump2 {target} {system_hive}",
"searchsploit":    "searchsploit {target} {options}",
"smbmap":          "smbmap -H {target} {creds} {options}",
"socat":           "socat {target} {options}",
"sshuttle":        "sshuttle -r {target} {subnet} {options}",
"ssdeep":          "ssdeep {target} {options}",
"subfinder":       "subfinder -d {domain} {options}",
"tcpdump":         "tcpdump -i {target} {options}",
"tcpreplay":       "tcpreplay -i {target} {pcap}",
"testdisk":        "testdisk {target} {options}",
"theHarvester":    "theHarvester -d {domain} -b {source} {options}",
"unicornscan":     "unicornscan {target} {options}",
"wafw00f":         "wafw00f {target} {options}",
"wapiti":          "wapiti --url {url} {module} {options}",
"whatweb":         "whatweb {url} {options}",
"wifite":          "wifite -i {target} {options}",
"wifiphisher":     "wifiphisher -aI {target} {options}",
"wpscan":          "wpscan --url {url} {options}",
}

import subprocess, re
def psql(sql):
    out = subprocess.run(["bash","/home/cybersec/cybersec-pro/rust-backend/.dbq.sh", sql], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode==0 else ("ERR:"+out.stderr.strip())

# which of these are active & currently missing a template
missing = psql("SELECT name FROM tools WHERE is_active=TRUE AND (command_template IS NULL OR command_template='')").splitlines()
missing = [m for m in missing if m]
print("active-without-template count:", len(missing))
not_found = [t for t in TPL if t not in missing]
print("templates defined but tool NOT missing (skip):", not_found)
have_no_tpl = [t for t in missing if t not in TPL]
print("missing tools WITHOUT a template defined:", have_no_tpl)

with open("/home/cybersec/cybersec-pro/zero-code-test/config_updates.sql","w") as f:
    for tool, tpl in TPL.items():
        if tool not in missing: continue
        escaped = tpl.replace("'","''")
        f.write(f"UPDATE tools SET command_template = '{escaped}', parameters = '{{\"danger_level\": \"low\", \"target_types\": []}}' WHERE name = '{tool}' AND is_active = TRUE;\n")
print("wrote config_updates.sql")
