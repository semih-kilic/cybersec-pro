import{j as e}from"./index-ByCjmiDw.js";import{r as o}from"./router-CDeefzIX.js";import{H as k}from"./Header-Cl3g75f0.js";function T(){const p=o.useRef(null),u=o.useRef(null),[m,n]=o.useState([{type:"output",content:"╔════════════════════════════════════════════════════════════════╗"},{type:"output",content:"║     ██╗  ██╗ █████╗ ██╗     ██╗    ██████╗ ██████╗  ██████╗    ║"},{type:"output",content:"║     ██║ ██╔╝██╔══██╗██║     ██║    ██╔══██╗██╔══██╗██╔═══██╗   ║"},{type:"output",content:"║     █████╔╝ ███████║██║     ██║    ██████╔╝██████╔╝██║   ██║   ║"},{type:"output",content:"║     ██╔═██╗ ██╔══██║██║     ██║    ██╔═══╝ ██╔══██╗██║   ██║   ║"},{type:"output",content:"║     ██║  ██╗██║  ██║███████╗██║    ██║     ██║  ██║╚██████╔╝   ║"},{type:"output",content:"║     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ║"},{type:"output",content:"╠════════════════════════════════════════════════════════════════╣"},{type:"output",content:"║  🔒 CyberSec Pro - Web-based Kali Linux Terminal                ║"},{type:"output",content:'║  Type "help" for available commands                            ║'},{type:"output",content:"╚════════════════════════════════════════════════════════════════╝"},{type:"output",content:""}]),[h,i]=o.useState(""),[l,b]=o.useState([]),[c,d]=o.useState(-1),[y,f]=o.useState(!0);o.useEffect(()=>{p.current&&(p.current.scrollTop=p.current.scrollHeight)},[m]),o.useEffect(()=>{var s;(s=u.current)==null||s.focus()},[]);const g=async s=>{const r=s.trim();if(!r)return;n(t=>[...t,{type:"input",content:`┌──(kali㉿cybersec)-[~]
└─$ ${r}`}]),b(t=>[...t,r]),d(-1),i("");const[x,...a]=r.split(" ");switch(x.toLowerCase()){case"help":n(t=>[...t,{type:"output",content:`
Available Commands:
  help          Show this help message
  clear         Clear the terminal screen
  whoami        Display current user
  pwd           Print working directory
  ls            List directory contents
  cat <file>    Display file contents
  nmap          Network scanner
  sqlmap        SQL injection tool
  nikto         Web server scanner
  hydra         Password cracker
  gobuster      Directory/file brute-forcer
  dirb          Web content scanner
  wpscan        WordPress vulnerability scanner
  john          Password hash cracker
  
Type any tool name followed by -h for help.
Example: nmap -h
          `.trim()}]);break;case"clear":n([]);break;case"whoami":n(t=>[...t,{type:"output",content:"kali"}]);break;case"pwd":n(t=>[...t,{type:"output",content:"/home/kali"}]);break;case"ls":n(t=>[...t,{type:"output",content:"Desktop  Documents  Downloads  Music  Pictures  Public  Templates  Videos  wordlists  tools"}]);break;case"date":n(t=>[...t,{type:"output",content:new Date().toString()}]);break;case"hostname":n(t=>[...t,{type:"output",content:"cybersec-kali"}]);break;case"uname":a[0]==="-a"?n(t=>[...t,{type:"output",content:"Linux cybersec-kali 6.1.0-kali5-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.12-1kali2 x86_64 GNU/Linux"}]):n(t=>[...t,{type:"output",content:"Linux"}]);break;case"nmap":a.length===0||a[0]==="-h"||a[0]==="--help"?n(t=>[...t,{type:"output",content:`Nmap 7.94 ( https://nmap.org )
Usage: nmap [Scan Type(s)] [Options] {target specification}

TARGET SPECIFICATION:
  Can pass hostnames, IP addresses, networks, etc.
  Ex: scanme.nmap.org, microsoft.com/24, 192.168.0.1; 10.0.0-255.1-254

SCAN TECHNIQUES:
  -sS/sT/sA/sW/sM: TCP SYN/Connect()/ACK/Window/Maimon scans
  -sU: UDP Scan
  -sN/sF/sX: TCP Null, FIN, and Xmas scans

PORT SPECIFICATION AND SCAN ORDER:
  -p <port ranges>: Only scan specified ports
  --top-ports <number>: Scan <number> most common ports

SERVICE/VERSION DETECTION:
  -sV: Probe open ports to determine service/version info
  -sC: Run default scripts

OS DETECTION:
  -O: Enable OS detection
  -A: Enable OS detection, version detection, script scanning, and traceroute

Type 'nmap <target>' in dashboard to run a scan with GUI parameters.`}]):n(t=>[...t,{type:"output",content:`Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for ${a[a.length-1]}
Host is up (0.00042s latency).

PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3306/tcp open  mysql

Nmap done: 1 IP address (1 host up) scanned in 0.05 seconds`}]);break;case"sqlmap":a.length===0||a[0]==="-h"||a[0]==="--help"?n(t=>[...t,{type:"output",content:`sqlmap/1.7 - automatic SQL injection and database takeover tool

Usage: sqlmap [options]

Options:
  -h, --help            Show basic help message and exit
  -u URL, --url=URL     Target URL (e.g. "http://www.site.com/vuln.php?id=1")
  -r REQUESTFILE        Load HTTP request from a file

  Enumeration:
    --dbs               Enumerate databases
    --tables            Enumerate database tables
    --columns           Enumerate database table columns
    --dump              Dump database table entries

Type 'sqlmap <target>' in dashboard to run with GUI parameters.`}]):n(t=>[...t,{type:"output",content:`[*] starting @ ${new Date().toLocaleTimeString()}
[*] testing connection to the target URL
[*] testing if the target URL content is stable
[*] testing if GET parameter 'id' is dynamic
[*] heuristic (basic) test shows that GET parameter 'id' might be injectable
[*] testing for SQL injection on GET parameter 'id'
[+] GET parameter 'id' is vulnerable. Do you want to keep testing? [y/N]`}]);break;case"nikto":a.length===0||a[0]==="-h"||a[0]==="--help"?n(t=>[...t,{type:"output",content:`Nikto v2.5.0
---------------------------------------------------------------------------
   Options:
       -host+     Target host
       -port+     Port (default 80)
       -ssl       Force ssl mode on port
       -Tuning+   Scan tuning
       -output+   Write output to this file
       -Format+   Save file format

Type 'nikto -h <target>' in dashboard to run with GUI parameters.`}]):n(t=>[...t,{type:"output",content:`- Nikto v2.5.0
---------------------------------------------------------------------------
+ Target IP:          ${a[a.length-1]}
+ Target Port:        80
+ Start Time:         ${new Date().toLocaleString()}
---------------------------------------------------------------------------
+ Server: Apache/2.4.52 (Ubuntu)
+ /: The anti-clickjacking X-Frame-Options header is not present.
+ /: Uncommon header 'x-content-type-options' found.
+ No CGI Directories found.
+ /admin/: Admin directory found.
---------------------------------------------------------------------------
+ 1 host(s) tested`}]);break;case"hydra":(a.length===0||a[0]==="-h"||a[0]==="--help")&&n(t=>[...t,{type:"output",content:`Hydra v9.4 (c) 2022 by van Hauser/THC & David Maciejak

Syntax: hydra [[[-l LOGIN|-L FILE] [-p PASS|-P FILE]] | [-C FILE]] [-t TASKS]
              [server service [OPTIONS]]

Options:
  -l LOGIN or -L FILE  login with LOGIN name, or load from FILE
  -p PASS or -P FILE   try password PASS, or load from FILE
  -t TASKS             run TASKS number of connects in parallel per target
  -f / -F              exit when a login/pass pair is found

Supported services: ssh ftp http-get http-post mysql mssql postgres rdp vnc

Type 'hydra' in dashboard to run with GUI parameters.`}]);break;case"gobuster":(a.length===0||a[0]==="-h"||a[0]==="--help")&&n(t=>[...t,{type:"output",content:`Gobuster v3.5
===============================================================
Usage:
  gobuster [command]

Available Commands:
  dir         Uses directory/file enumeration mode
  dns         Uses DNS subdomain enumeration mode
  fuzz        Uses fuzzing mode
  s3          Uses AWS bucket enumeration mode
  vhost       Uses VHOST enumeration mode

Flags:
  -u, --url string     Target URL
  -w, --wordlist string Path to wordlist
  -t, --threads int    Number of concurrent threads (default 10)

Type 'gobuster' in dashboard to run with GUI parameters.`}]);break;case"exit":n(t=>[...t,{type:"output",content:"Logout."}]),f(!1);break;default:n(t=>[...t,{type:"error",content:`bash: ${x}: command not found or not available in web terminal.
Use the Dashboard to run security tools with full GUI interface.`}])}},w=s=>{if(s.key==="Enter")g(h);else if(s.key==="ArrowUp"){if(s.preventDefault(),l.length>0){const r=c<l.length-1?c+1:c;d(r),i(l[l.length-1-r]||"")}}else if(s.key==="ArrowDown")if(s.preventDefault(),c>0){const r=c-1;d(r),i(l[l.length-1-r]||"")}else c===0&&(d(-1),i(""));else s.key==="l"&&s.ctrlKey?(s.preventDefault(),n([])):s.key==="c"&&s.ctrlKey&&(i(""),n(r=>[...r,{type:"output",content:"^C"}]))};return e.jsxs("div",{className:"min-h-screen bg-gray-950",children:[e.jsx(k,{title:"Terminal",subtitle:"Kali Linux web terminal"}),e.jsxs("div",{className:"p-6",children:[e.jsxs("div",{className:"bg-[#0d0d0d] rounded-xl border border-gray-800 overflow-hidden shadow-2xl",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("div",{className:"flex gap-1.5",children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-red-500"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-yellow-500"}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-green-500"})]}),e.jsx("span",{className:"text-gray-400 text-sm ml-3",children:"kali@cybersec: ~"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[y?e.jsxs("span",{className:"flex items-center gap-1.5 text-green-400 text-xs",children:[e.jsx("span",{className:"w-2 h-2 bg-green-400 rounded-full animate-pulse"}),"Connected"]}):e.jsxs("span",{className:"flex items-center gap-1.5 text-red-400 text-xs",children:[e.jsx("span",{className:"w-2 h-2 bg-red-400 rounded-full"}),"Disconnected"]}),e.jsx("button",{onClick:()=>n([]),className:"text-gray-400 hover:text-white transition p-1",title:"Clear terminal",children:e.jsx("svg",{className:"w-4 h-4",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"})})})]})]}),e.jsxs("div",{ref:p,className:"h-[calc(100vh-280px)] overflow-auto p-4 font-mono text-sm cursor-text",onClick:()=>{var s;return(s=u.current)==null?void 0:s.focus()},children:[m.map((s,r)=>e.jsx("div",{className:`whitespace-pre-wrap ${s.type==="input"?"text-green-400":s.type==="error"?"text-red-400":"text-gray-300"}`,children:s.content},r)),y&&e.jsxs("div",{className:"flex items-start mt-1",children:[e.jsx("span",{className:"text-green-400 whitespace-pre",children:"┌──(kali㉿cybersec)-[~] └─$ "}),e.jsx("input",{ref:u,type:"text",value:h,onChange:s=>i(s.target.value),onKeyDown:w,className:"flex-1 bg-transparent border-none outline-none text-gray-100 font-mono",spellCheck:!1,autoComplete:"off"})]})]})]}),e.jsxs("div",{className:"mt-4 flex flex-wrap gap-2",children:[e.jsx("span",{className:"text-sm text-gray-400 mr-2",children:"Quick Commands:"}),["nmap -h","sqlmap -h","nikto -h","hydra -h","gobuster -h","help","clear"].map(s=>e.jsx("button",{onClick:()=>g(s),className:"px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-mono transition",children:s},s))]}),e.jsxs("div",{className:"mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4",children:[e.jsxs("h4",{className:"text-white font-medium mb-2 flex items-center gap-2",children:[e.jsx("svg",{className:"w-5 h-5 text-yellow-500",fill:"none",stroke:"currentColor",viewBox:"0 0 24 24",children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"})}),"Terminal Tips"]}),e.jsxs("ul",{className:"text-sm text-gray-400 space-y-1",children:[e.jsxs("li",{children:["• Use ",e.jsx("kbd",{className:"px-1.5 py-0.5 bg-gray-800 rounded text-xs",children:"↑"})," and ",e.jsx("kbd",{className:"px-1.5 py-0.5 bg-gray-800 rounded text-xs",children:"↓"})," to navigate command history"]}),e.jsxs("li",{children:["• Press ",e.jsx("kbd",{className:"px-1.5 py-0.5 bg-gray-800 rounded text-xs",children:"Ctrl+L"})," to clear the terminal"]}),e.jsxs("li",{children:["• Press ",e.jsx("kbd",{className:"px-1.5 py-0.5 bg-gray-800 rounded text-xs",children:"Ctrl+C"})," to cancel current input"]}),e.jsxs("li",{children:["• For full tool functionality with parameters, use the ",e.jsx("strong",{children:"Tools"})," section in the dashboard"]})]})]})]})]})}export{T as TerminalPage,T as default};
//# sourceMappingURL=TerminalPage-CPdrWeIy.js.map
