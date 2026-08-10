#!/usr/bin/env python3
import json, subprocess

def f(name,label,type="text",required=False,default="",placeholder="",options=None,secret=False,desc=None):
    d={"name":name,"label":label,"type":type,"required":required,"default":default,"placeholder":placeholder}
    if options: d["options"]=options
    if secret: d["secret"]=True
    if desc: d["description"]=desc
    return d

# tool -> (template, [fields])
RICH = {
"nmap": ("nmap {target} {scan_type} {port_range} {top_ports} {os_detection} {service_version} {script_scan} {aggressive} {timing} {verbose} {no_dns}", [
    f("target","Target","text",True,"","scanme.nmap.org",desc="Target IP, hostname or CIDR"),
    f("scan_type","Scan Type","select",False,"-sS","",["-sS (SYN)","-sT (Connect)","-sU (UDP)","-sA (ACK)","-sN (NULL)"],"Type of scan"),
    f("port_range","Port Range","text",False,"","-p 22,80,443 or -p 1-1000",desc="Ports to scan"),
    f("top_ports","Top Ports","text",False,"","--top-ports 1000",desc="Scan most common ports"),
    f("os_detection","OS Detection","text",False,"","-O",desc="Enable OS detection (flag value)"),
    f("service_version","Service Version","text",False,"","-sV",desc="Probe for service versions (flag value)"),
    f("script_scan","Script Scan","text",False,"","-sC",desc="Run default NSE scripts (flag value)"),
    f("aggressive","Aggressive","text",False,"","-A",desc="OS+Version+Scripts+Traceroute (flag value)"),
    f("timing","Timing","select",False,"-T3","",["-T0 (Paranoid)","-T1 (Sneaky)","-T2 (Polite)","-T3 (Normal)","-T4 (Aggressive)","-T5 (Insane)"]),
    f("verbose","Verbose","text",False,"","-v",desc="Increase verbosity (flag value)"),
    f("no_dns","No DNS","text",False,"","-n",desc="Never do DNS resolution (flag value)"),
]),
"masscan": ("masscan {target} {ports} {rate} {banners} {output}", [
    f("target","Target","text",True,"","192.168.1.0/24",desc="Target IP range (CIDR)"),
    f("ports","Ports","text",True,"-p 80,443","-p 0-65535",desc="Ports to scan"),
    f("rate","Rate","text",False,"--rate 1000","--rate 10000",desc="Packets per second"),
    f("banners","Banners","text",False,"","--banners",desc="Capture banners (flag value)"),
    f("output","Output File","text",False,"","-oL results.txt",desc="Output to list file"),
]),
"nikto": ("nikto -h {target} {maxtime} {output} {options}", [
    f("target","Target URL","text",True,"","http://example.com",desc="Target host or URL"),
    f("maxtime","Max Time","text",False,"-maxtime 60","-maxtime 120",desc="Max seconds per host"),
    f("output","Output","text",False,"","-o /tmp/nikto.html -Format htm",desc="Output report"),
    f("options","Extra Options","text",False,"","-ssl -nointeractive -Tuning 1234567890",desc="Additional nikto options"),
]),
"whatweb": ("whatweb {target} {aggression} {options}", [
    f("target","Target URL","text",True,"","http://example.com",desc="Target URL"),
    f("aggression","Aggression","select",False,"-a 3","",["-a 1","-a 2","-a 3","-a 4"],"Aggression level"),
    f("options","Extra Options","text",False,"","--color=never",desc="Additional whatweb options"),
]),
"wpscan": ("wpscan --url {target} {enumeration} {api_token} {options}", [
    f("target","WordPress URL","text",True,"","http://example.com",desc="Target WordPress site URL"),
    f("enumeration","Enumeration","text",False,"--enumerate u,vp,vt,tt,cb,dbe","--enumerate vp",desc="Enumeration modules"),
    f("api_token","WPScan API Token","text",False,"","--api-token TOKEN",True,"Optional WPVulnDB token"),
    f("options","Extra Options","text",False,"","--random-user-agent --disable-tls-checks",desc="Additional wpscan options"),
]),
"hashcat": ("hashcat {mode} {attack_mode} {target} {wordlist} {options}", [
    f("target","Hash File","text",True,"","/path/to/hashes.txt",desc="File containing hashes"),
    f("mode","Hash Mode","text",False,"-m 0","-m 1000",desc="Hashcat mode (-m)"),
    f("attack_mode","Attack Mode","text",False,"-a 0","-a 3",desc="Attack mode (-a)"),
    f("wordlist","Wordlist / Mask","text",False,"","wordlist.txt or ?a?b?c?d",desc="Dictionary or mask"),
    f("options","Extra Options","text",False,"","--force -O -w 2",desc="Additional hashcat options"),
]),
"theHarvester": ("theHarvester -d {target} {source} {limit} {options}", [
    f("target","Domain","text",True,"","example.com",desc="Target domain"),
    f("source","Search Source","select",False,"-b bing","",["-b baidu","-b bing","-b crt","-b duckduckgo","-b google","-b yahoo"]),
    f("limit","Result Limit","text",False,"-l 20","-l 100",desc="Max results per source"),
    f("options","Extra Options","text",False,"","-n",desc="Additional theHarvester options"),
]),
"subfinder": ("subfinder -d {target} {options}", [
    f("target","Domain","text",True,"","example.com",desc="Target domain"),
    f("options","Options","text",False,"-all -silent","-recursive -all",desc="Subfinder options"),
]),
"amass": ("amass enum -d {target} {options}", [
    f("target","Domain","text",True,"","example.com",desc="Target domain"),
    f("options","Options","text",False,"-passive","-active -brute -w /path/wordlist.txt",desc="Amass options"),
]),
"aircrack-ng": ("aircrack-ng {target} {wordlist} {bssid} {options}", [
    f("target","Capture File","text",True,"","/path/to/capture.cap",desc="WPA/WEP capture file"),
    f("wordlist","Wordlist","text",False,"","-w /path/wordlist.txt",desc="Dictionary file (flag value)"),
    f("bssid","BSSID","text",False,"","-b AA:BB:CC:DD:EE:FF",desc="Target BSSID (flag value)"),
    f("options","Extra Options","text",False,"","-a 2 -n 64",desc="Additional aircrack-ng options"),
]),
"msfvenom": ("msfvenom -p {target} {lhost} {lport} {format} {output} {options}", [
    f("target","Payload","text",True,"","linux/x64/shell_reverse_tcp",desc="Payload name"),
    f("lhost","LHOST","text",False,"LHOST=127.0.0.1","LHOST=10.0.0.1",desc="Listener host"),
    f("lport","LPORT","text",False,"LPORT=4444","LPORT=4444",desc="Listener port"),
    f("format","Format","text",False,"-f elf","-f exe",desc="Output format"),
    f("output","Output File","text",False,"","-o /tmp/payload",desc="Output file (flag value)"),
    f("options","Extra Options","text",False,"","--arch x64 --platform linux",desc="Arch/platform options"),
]),
}

def psql(sql):
    out = subprocess.run(["bash","/home/cybersec/cybersec-pro/rust-backend/.dbq.sh", sql], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode==0 else ("ERR:"+out.stderr.strip()[:300])

with open("/home/cybersec/cybersec-pro/zero-code-test/rich_updates.sql","w") as out:
    for tool,(tpl,fields) in RICH.items():
        params=json.dumps({"form":fields,"danger_level":"low","target_types":[]}, ensure_ascii=False)
        tpl_esc=tpl.replace("'","''")
        params_esc=params.replace("'","''")
        out.write(f"UPDATE tools SET command_template='{tpl_esc}', parameters='{params_esc}'::jsonb WHERE name='{tool}' AND is_active=TRUE;\n")
print("rich tools:", len(RICH))
