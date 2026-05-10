#!/bin/bash
# AUTO-GENERATED install script for cybersec-pro missing tools
# Generated: 2026-05-10T15:21:39-04:00
# 562 unique missing binaries grouped by installer
set +e   # devam et hata olsa bile
export DEBIAN_FRONTEND=noninteractive

#--- 1) APT toplu kurulum ---
echo "[+] APT update..."
sudo apt-get update -y || true
echo "[+] APT install (toplu, hatalar yoksayilir)..."
APT_LIST=(
  afl++
  afl++
  alterx
  aquatone
  arachni
  sysinternals
  avml
  bkhive
  brutespray
  cdncheck
  chaos-client
  chntpw
  creepy
  curl
  curl
  dependency-check
  detect-it-easy
  dirb
  dnscat2
  dnsprobe
  empire
  powershell-empire
  et
  ettercap-graphical
  fimap
  forensic-artifacts
  freerdp2-x11
  gnuradio
  gobuster
  gospider
  hackrf
  hcxtools
  hcxtools
  chromium
  honggfuzz
  honggfuzz
  hyperion
  i2p
  python3-impacket
  interactsh-client
  interactsh-client
  jaeles
  john
  jq
  keepnote
  python3-impacket
  king-phisher
  kiterunner
  kubeaudit
  kube-hunter
  kwprocessor
  libfindrtp
  clang
  ligolo-ng
  logparser
  magictree
  metasploit-framework
  mfcuk
  mfoc
  libfreefare-bin
  miller
  nftables
  notify
  nuclei
  nuclei-templates
  openstego
  osquery
  outguess
  zaproxy
  peepdf
  phoneinfoga
  hcxdumptool
  poshc2
  powersploit
  powersploit
  puredns
  pwndbg
  pyrit
  python3
  radamsa
  radamsa
  ratproxy
  rdesktop
  recstudio
  recstudio
  remmina
  ruler
  samdump2
  python3-impacket
  python3-impacket
  secure-socket-funneling-windows-binaries
  simplehttpserver
  sliver
  onesixtyone
  stegsnow
  ssdeep
  steghide
  subzy
  kali-menu
  tigervnc-viewer
  tightvncserver
  tilix
  tlsx
  iputils-tracepath
  uhd-images
  urldedupe
  python3-capstone
  python3-dfdatetime
  python3-dfvfs
  python3-dfwinreg
  python3-distorm3
  gr-iqbal
  faraday
  vega
  tigervnc-viewer
  volatility3
  w3af
  webanalyze
  webshells
  windapsearch
  wireguard
  wordlistctl
  x11vnc
  xprobe
  yq
  kali-menu
)
sudo apt-get install -y --no-install-recommends "${APT_LIST[@]}" 2>&1 | tail -50 || true

#--- 2) GO install ---
echo "[+] go install..."
export PATH=$PATH:$(go env GOPATH 2>/dev/null)/bin
go install github.com/projectdiscovery/aix/cmd/aix@latest 2>/dev/null || echo "FAIL: go github.com/projectdiscovery/aix/cmd/aix@latest"
go install github.com/lobuhi/byp4xx@latest 2>/dev/null || echo "FAIL: go github.com/lobuhi/byp4xx@latest"
go install github.com/projectdiscovery/cdncheck/cmd/cdncheck@latest 2>/dev/null || echo "FAIL: go github.com/projectdiscovery/cdncheck/cmd/cdncheck@latest"
go install github.com/lanrat/certgraph@latest 2>/dev/null || echo "FAIL: go github.com/lanrat/certgraph@latest"
go install github.com/cgboal/sonern/cmd/crobat 2>/dev/null || echo "FAIL: go github.com/cgboal/sonern/cmd/crobat"
go install github.com/michenriksen/gitrob 2>/dev/null || echo "FAIL: go github.com/michenriksen/gitrob"
go install github.com/optiv/Go365 2>/dev/null || echo "FAIL: go github.com/optiv/Go365"
go install github.com/securego/gosec/v2/cmd/gosec 2>/dev/null || echo "FAIL: go github.com/securego/gosec/v2/cmd/gosec"
go install golang.org/x/vuln/cmd/govulncheck@latest 2>/dev/null || echo "FAIL: go golang.org/x/vuln/cmd/govulncheck@latest"
go install github.com/hakluke/haktrails 2>/dev/null || echo "FAIL: go github.com/hakluke/haktrails"
go install github.com/htcat/htcat 2>/dev/null || echo "FAIL: go github.com/htcat/htcat"
go install github.com/iann0036/iamlive 2>/dev/null || echo "FAIL: go github.com/iann0036/iamlive"
go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest 2>/dev/null || echo "FAIL: go github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest"
go install github.com/quarkslab/kdigger/cmd/kdigger@latest 2>/dev/null || echo "FAIL: go github.com/quarkslab/kdigger/cmd/kdigger@latest"
go install golang.stackrox.io/kube-linter/cmd/kube-linter@latest 2>/dev/null || echo "FAIL: go golang.stackrox.io/kube-linter/cmd/kube-linter@latest"
go install github.com/Legit-Labs/legitify@latest 2>/dev/null || echo "FAIL: go github.com/Legit-Labs/legitify@latest"
go install github.com/nicocha30/ligolo-ng/cmd/proxy@latest 2>/dev/null || echo "FAIL: go github.com/nicocha30/ligolo-ng/cmd/proxy@latest"
go install github.com/tomnomnom/meg 2>/dev/null || echo "FAIL: go github.com/tomnomnom/meg"
go install github.com/Ne0nd0g/merlin 2>/dev/null || echo "FAIL: go github.com/Ne0nd0g/merlin"
go install github.com/drk1wi/Modlishka 2>/dev/null || echo "FAIL: go github.com/drk1wi/Modlishka"
go install github.com/projectdiscovery/notify/cmd/notify@latest 2>/dev/null || echo "FAIL: go github.com/projectdiscovery/notify/cmd/notify@latest"
go install github.com/synacktiv/octoscan@latest 2>/dev/null || echo "FAIL: go github.com/synacktiv/octoscan@latest"
go install github.com/google/osv-scanner/cmd/osv-scanner@latest 2>/dev/null || echo "FAIL: go github.com/google/osv-scanner/cmd/osv-scanner@latest"
go install github.com/lc/otxurls 2>/dev/null || echo "FAIL: go github.com/lc/otxurls"
go install github.com/RedTeamPentesting/pretender 2>/dev/null || echo "FAIL: go github.com/RedTeamPentesting/pretender"
go install github.com/optiv/ScareCrow 2>/dev/null || echo "FAIL: go github.com/optiv/ScareCrow"
go install github.com/eth0izzle/shhgit@latest 2>/dev/null || echo "FAIL: go github.com/eth0izzle/shhgit@latest"
go install github.com/incogbyte/shosubgo 2>/dev/null || echo "FAIL: go github.com/incogbyte/shosubgo"
go install github.com/incogbyte/shosubgo@latest 2>/dev/null || echo "FAIL: go github.com/incogbyte/shosubgo@latest"
go install github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest 2>/dev/null || echo "FAIL: go github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest"
go install github.com/denandz/sourcemapper 2>/dev/null || echo "FAIL: go github.com/denandz/sourcemapper"
go install github.com/edoardottt/takeover@latest 2>/dev/null || echo "FAIL: go github.com/edoardottt/takeover@latest"
go install github.com/projectdiscovery/tlsx/cmd/tlsx@latest 2>/dev/null || echo "FAIL: go github.com/projectdiscovery/tlsx/cmd/tlsx@latest"
go install github.com/tomnomnom/unfurl 2>/dev/null || echo "FAIL: go github.com/tomnomnom/unfurl"

#--- 3) PIPX install ---
echo "[+] pipx install..."
command -v pipx >/dev/null || sudo apt-get install -y pipx
pipx install --force 'adversarial-robustness-toolbox' 2>/dev/null || echo "FAIL: pipx adversarial-robustness-toolbox"
pipx install --force 'apicheck' 2>/dev/null || echo "FAIL: pipx apicheck"
pipx install --force 'apkx' 2>/dev/null || echo "FAIL: pipx apkx"
pipx install --force 'jfrog-cli-py' 2>/dev/null || echo "FAIL: pipx jfrog-cli-py"
pipx install --force 'boofuzz' 2>/dev/null || echo "FAIL: pipx boofuzz"
pipx install --force 'flare-capa' 2>/dev/null || echo "FAIL: pipx flare-capa"
pipx install --force 'clairvoyance' 2>/dev/null || echo "FAIL: pipx clairvoyance"
pipx install --force 'cloudgrappler' 2>/dev/null || echo "FAIL: pipx cloudgrappler"
pipx install --force 'crlfsuite' 2>/dev/null || echo "FAIL: pipx crlfsuite"
pipx install --force 'crytic-compile' 2>/dev/null || echo "FAIL: pipx crytic-compile"
pipx install --force 'csp-bypass' 2>/dev/null || echo "FAIL: pipx csp-bypass"
pipx install --force 'cuckoo' 2>/dev/null || echo "FAIL: pipx cuckoo"
pipx install --force 'detect-secrets' 2>/dev/null || echo "FAIL: pipx detect-secrets"
pipx install --force 'giskard' 2>/dev/null || echo "FAIL: pipx giskard"
pipx install --force 'hostilizer' 2>/dev/null || echo "FAIL: pipx hostilizer"
pipx install --force 'howmanypeoplearearound' 2>/dev/null || echo "FAIL: pipx howmanypeoplearearound"
pipx install --force 'idb' 2>/dev/null || echo "FAIL: pipx idb"
pipx install --force 'impacket' 2>/dev/null || echo "FAIL: pipx impacket"
pipx install --force 'intelmq' 2>/dev/null || echo "FAIL: pipx intelmq"
pipx install --force 'interlace' 2>/dev/null || echo "FAIL: pipx interlace"
pipx install --force 'intezer-analyze-cli' 2>/dev/null || echo "FAIL: pipx intezer-analyze-cli"
pipx install --force 'kube-hunter' 2>/dev/null || echo "FAIL: pipx kube-hunter"
pipx install --force 'lapsdumper' 2>/dev/null || echo "FAIL: pipx lapsdumper"
pipx install --force 'llm-guard' 2>/dev/null || echo "FAIL: pipx llm-guard"
pipx install --force 'maigret' 2>/dev/null || echo "FAIL: pipx maigret"
pipx install --force 'manticore' 2>/dev/null || echo "FAIL: pipx manticore"
pipx install --force 'modelscan' 2>/dev/null || echo "FAIL: pipx modelscan"
pipx install --force 'mythril' 2>/dev/null || echo "FAIL: pipx mythril"
pipx install --force 'objection' 2>/dev/null || echo "FAIL: pipx objection"
pipx install --force 'parliament' 2>/dev/null || echo "FAIL: pipx parliament"
pipx install --force 'peframe' 2>/dev/null || echo "FAIL: pipx peframe"
pipx install --force 'pe-tree' 2>/dev/null || echo "FAIL: pipx pe-tree"
pipx install --force 'plexiglass' 2>/dev/null || echo "FAIL: pipx plexiglass"
pipx install --force 'principalmapper' 2>/dev/null || echo "FAIL: pipx principalmapper"
pipx install --force 'pwncat-cs' 2>/dev/null || echo "FAIL: pipx pwncat-cs"
pipx install --force 'quark-engine' 2>/dev/null || echo "FAIL: pipx quark-engine"
pipx install --force 'scoutsuite' 2>/dev/null || echo "FAIL: pipx scoutsuite"
pipx install --force 'semgrep' 2>/dev/null || echo "FAIL: pipx semgrep"
pipx install --force 'semgrep' 2>/dev/null || echo "FAIL: pipx semgrep"
pipx install --force 'sigma-cli' 2>/dev/null || echo "FAIL: pipx sigma-cli"
pipx install --force 'slowloris' 2>/dev/null || echo "FAIL: pipx slowloris"
pipx install --force 'viper-framework' 2>/dev/null || echo "FAIL: pipx viper-framework"
pipx install --force 'volatility3' 2>/dev/null || echo "FAIL: pipx volatility3"
pipx install --force 'xnLinkFinder' 2>/dev/null || echo "FAIL: pipx xnLinkFinder"
pipx install --force 'zizmor' 2>/dev/null || echo "FAIL: pipx zizmor"

#--- 4) PIP install (system override) ---
echo "[+] pip install..."
pip install --break-system-packages --user 'angr' 2>/dev/null || echo "FAIL: pip angr"
pip install --break-system-packages --user 'avatar2' 2>/dev/null || echo "FAIL: pip avatar2"
pip install --break-system-packages --user 'awscli' 2>/dev/null || echo "FAIL: pip awscli"
pip install --break-system-packages --user 'aws-consoler' 2>/dev/null || echo "FAIL: pip aws-consoler"
pip install --break-system-packages --user 'pacu' 2>/dev/null || echo "FAIL: pip pacu"
pip install --break-system-packages --user 'az-enum' 2>/dev/null || echo "FAIL: pip az-enum"
pip install --break-system-packages --user 'beroot' 2>/dev/null || echo "FAIL: pip beroot"
pip install --break-system-packages --user 'pybinaryedge' 2>/dev/null || echo "FAIL: pip pybinaryedge"
pip install --break-system-packages --user 'blackbird' 2>/dev/null || echo "FAIL: pip blackbird"
pip install --break-system-packages --user 'boofuzz' 2>/dev/null || echo "FAIL: pip boofuzz"
pip install --break-system-packages --user 'builtwith' 2>/dev/null || echo "FAIL: pip builtwith"
pip install --break-system-packages --user 'c2concealer' 2>/dev/null || echo "FAIL: pip c2concealer"
pip install --break-system-packages --user 'capstone' 2>/dev/null || echo "FAIL: pip capstone"
pip install --break-system-packages --user 'censys' 2>/dev/null || echo "FAIL: pip censys"
pip install --break-system-packages --user 'cerbrutus' 2>/dev/null || echo "FAIL: pip cerbrutus"
pip install --break-system-packages --user 'certora-cli' 2>/dev/null || echo "FAIL: pip certora-cli"
pip install --break-system-packages --user 'cloud_enum' 2>/dev/null || echo "FAIL: pip cloud_enum"
pip install --break-system-packages --user 'cloudmapper' 2>/dev/null || echo "FAIL: pip cloudmapper"
pip install --break-system-packages --user 'comcrawl' 2>/dev/null || echo "FAIL: pip comcrawl"
pip install --break-system-packages --user 'crackql' 2>/dev/null || echo "FAIL: pip crackql"
pip install --break-system-packages --user 'defaultcreds-cheat-sheet' 2>/dev/null || echo "FAIL: pip defaultcreds-cheat-sheet"
pip install --break-system-packages --user 'crosslinked' 2>/dev/null || echo "FAIL: pip crosslinked"
pip install --break-system-packages --user 'crtsh' 2>/dev/null || echo "FAIL: pip crtsh"
pip install --break-system-packages --user 'csvkit' 2>/dev/null || echo "FAIL: pip csvkit"
pip install --break-system-packages --user 'impacket' 2>/dev/null || echo "FAIL: pip impacket"
pip install --break-system-packages --user 'impacket' 2>/dev/null || echo "FAIL: pip impacket"
pip install --break-system-packages --user 'impacket' 2>/dev/null || echo "FAIL: pip impacket"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'cve-bin-tool' 2>/dev/null || echo "FAIL: pip cve-bin-tool"
pip install --break-system-packages --user 'dehashed' 2>/dev/null || echo "FAIL: pip dehashed"
pip install --break-system-packages --user 'dkimpy' 2>/dev/null || echo "FAIL: pip dkimpy"
pip install --break-system-packages --user 'dnsvalidator' 2>/dev/null || echo "FAIL: pip dnsvalidator"
pip install --break-system-packages --user 'dragonblood' 2>/dev/null || echo "FAIL: pip dragonblood"
pip install --break-system-packages --user 'drozer' 2>/dev/null || echo "FAIL: pip drozer"
pip install --break-system-packages --user 'drozer' 2>/dev/null || echo "FAIL: pip drozer"
pip install --break-system-packages --user 'enumerate-iam' 2>/dev/null || echo "FAIL: pip enumerate-iam"
pip install --break-system-packages --user 'pyexfil' 2>/dev/null || echo "FAIL: pip pyexfil"
pip install --break-system-packages --user 'fofa' 2>/dev/null || echo "FAIL: pip fofa"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'foolbox' 2>/dev/null || echo "FAIL: pip foolbox"
pip install --break-system-packages --user 'gcpbucketbrute' 2>/dev/null || echo "FAIL: pip gcpbucketbrute"
pip install --break-system-packages --user 'ghunt' 2>/dev/null || echo "FAIL: pip ghunt"
pip install --break-system-packages --user 'git-dumper' 2>/dev/null || echo "FAIL: pip git-dumper"
pip install --break-system-packages --user 'github-search' 2>/dev/null || echo "FAIL: pip github-search"
pip install --break-system-packages --user 'graphqlmap' 2>/dev/null || echo "FAIL: pip graphqlmap"
pip install --break-system-packages --user 'h2csmuggler' 2>/dev/null || echo "FAIL: pip h2csmuggler"
pip install --break-system-packages --user 'iamspy' 2>/dev/null || echo "FAIL: pip iamspy"
pip install --break-system-packages --user 'ignorant' 2>/dev/null || echo "FAIL: pip ignorant"
pip install --break-system-packages --user 'infoga' 2>/dev/null || echo "FAIL: pip infoga"
pip install --break-system-packages --user 'instaloader' 2>/dev/null || echo "FAIL: pip instaloader"
pip install --break-system-packages --user 'instalooter' 2>/dev/null || echo "FAIL: pip instalooter"
pip install --break-system-packages --user 'jsparser' 2>/dev/null || echo "FAIL: pip jsparser"
pip install --break-system-packages --user 'jwt-tool' 2>/dev/null || echo "FAIL: pip jwt-tool"
pip install --break-system-packages --user 'pynput' 2>/dev/null || echo "FAIL: pip pynput"
pip install --break-system-packages --user 'keystone-engine' 2>/dev/null || echo "FAIL: pip keystone-engine"
pip install --break-system-packages --user 'lazagne' 2>/dev/null || echo "FAIL: pip lazagne"
pip install --break-system-packages --user 'linkfinder' 2>/dev/null || echo "FAIL: pip linkfinder"
pip install --break-system-packages --user 'log4j-scan' 2>/dev/null || echo "FAIL: pip log4j-scan"
pip install --break-system-packages --user 'maigret' 2>/dev/null || echo "FAIL: pip maigret"
pip install --break-system-packages --user 'manticore' 2>/dev/null || echo "FAIL: pip manticore"
pip install --break-system-packages --user 'mentalist' 2>/dev/null || echo "FAIL: pip mentalist"
pip install --break-system-packages --user 'msticpy' 2>/dev/null || echo "FAIL: pip msticpy"
pip install --break-system-packages --user 'namechk' 2>/dev/null || echo "FAIL: pip namechk"
pip install --break-system-packages --user 'nodejsscan' 2>/dev/null || echo "FAIL: pip nodejsscan"
pip install --break-system-packages --user 'o365spray' 2>/dev/null || echo "FAIL: pip o365spray"
pip install --break-system-packages --user 'o365spray' 2>/dev/null || echo "FAIL: pip o365spray"
pip install --break-system-packages --user 'objection' 2>/dev/null || echo "FAIL: pip objection"
pip install --break-system-packages --user 'oletools' 2>/dev/null || echo "FAIL: pip oletools"
pip install --break-system-packages --user 'onyphe' 2>/dev/null || echo "FAIL: pip onyphe"
pip install --break-system-packages --user 'osintgram' 2>/dev/null || echo "FAIL: pip osintgram"
pip install --break-system-packages --user 'pandare' 2>/dev/null || echo "FAIL: pip pandare"
pip install --break-system-packages --user 'parliament' 2>/dev/null || echo "FAIL: pip parliament"
pip install --break-system-packages --user 'pdfparser' 2>/dev/null || echo "FAIL: pip pdfparser"
pip install --break-system-packages --user 'photon' 2>/dev/null || echo "FAIL: pip photon"
pip install --break-system-packages --user 'playwright' 2>/dev/null || echo "FAIL: pip playwright"
pip install --break-system-packages --user 'plecost' 2>/dev/null || echo "FAIL: pip plecost"
pip install --break-system-packages --user 'principalmapper' 2>/dev/null || echo "FAIL: pip principalmapper"
pip install --break-system-packages --user 'policy-sentry' 2>/dev/null || echo "FAIL: pip policy-sentry"
pip install --break-system-packages --user 'impacket' 2>/dev/null || echo "FAIL: pip impacket"
pip install --break-system-packages --user 'social-analyzer' 2>/dev/null || echo "FAIL: pip social-analyzer"
pip install --break-system-packages --user 'pwndb' 2>/dev/null || echo "FAIL: pip pwndb"
pip install --break-system-packages --user 'pwntools' 2>/dev/null || echo "FAIL: pip pwntools"
pip install --break-system-packages --user 'qiling' 2>/dev/null || echo "FAIL: pip qiling"
pip install --break-system-packages --user 'rebuff' 2>/dev/null || echo "FAIL: pip rebuff"
pip install --break-system-packages --user 'rekall' 2>/dev/null || echo "FAIL: pip rekall"
pip install --break-system-packages --user 'roadtools' 2>/dev/null || echo "FAIL: pip roadtools"
pip install --break-system-packages --user 'ropgadget' 2>/dev/null || echo "FAIL: pip ropgadget"
pip install --break-system-packages --user 'scoutsuite' 2>/dev/null || echo "FAIL: pip scoutsuite"
pip install --break-system-packages --user 'secretfinder' 2>/dev/null || echo "FAIL: pip secretfinder"
pip install --break-system-packages --user 'selenium' 2>/dev/null || echo "FAIL: pip selenium"
pip install --break-system-packages --user 'shodan' 2>/dev/null || echo "FAIL: pip shodan"
pip install --break-system-packages --user 'smartbrute' 2>/dev/null || echo "FAIL: pip smartbrute"
pip install --break-system-packages --user 'spraycharles' 2>/dev/null || echo "FAIL: pip spraycharles"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'ssrf-sheriff' 2>/dev/null || echo "FAIL: pip ssrf-sheriff"
pip install --break-system-packages --user 'stormspotter' 2>/dev/null || echo "FAIL: pip stormspotter"
pip install --break-system-packages --user 'requests' 2>/dev/null || echo "FAIL: pip requests"
pip install --break-system-packages --user 'tinfoleak' 2>/dev/null || echo "FAIL: pip tinfoleak"
pip install --break-system-packages --user 'tlsmate' 2>/dev/null || echo "FAIL: pip tlsmate"
pip install --break-system-packages --user 'tokenspray' 2>/dev/null || echo "FAIL: pip tokenspray"
pip install --break-system-packages --user 'toutatis' 2>/dev/null || echo "FAIL: pip toutatis"
pip install --break-system-packages --user 'trailblazer-aws' 2>/dev/null || echo "FAIL: pip trailblazer-aws"
pip install --break-system-packages --user 'trevorspray' 2>/dev/null || echo "FAIL: pip trevorspray"
pip install --break-system-packages --user 'triton' 2>/dev/null || echo "FAIL: pip triton"
pip install --break-system-packages --user 'twint' 2>/dev/null || echo "FAIL: pip twint"
pip install --break-system-packages --user 'typo3scan' 2>/dev/null || echo "FAIL: pip typo3scan"
pip install --break-system-packages --user 'unicorn' 2>/dev/null || echo "FAIL: pip unicorn"
pip install --break-system-packages --user 'uploadserver' 2>/dev/null || echo "FAIL: pip uploadserver"
pip install --break-system-packages --user 'uro' 2>/dev/null || echo "FAIL: pip uro"
pip install --break-system-packages --user 'usersearch' 2>/dev/null || echo "FAIL: pip usersearch"
pip install --break-system-packages --user 'vigil-llm' 2>/dev/null || echo "FAIL: pip vigil-llm"
pip install --break-system-packages --user 'volatility3' 2>/dev/null || echo "FAIL: pip volatility3"
pip install --break-system-packages --user 'vulners' 2>/dev/null || echo "FAIL: pip vulners"
pip install --break-system-packages --user 'waybackpy' 2>/dev/null || echo "FAIL: pip waybackpy"
pip install --break-system-packages --user 'weirdaal' 2>/dev/null || echo "FAIL: pip weirdaal"
pip install --break-system-packages --user 'whatsmyname' 2>/dev/null || echo "FAIL: pip whatsmyname"
pip install --break-system-packages --user 'wesng' 2>/dev/null || echo "FAIL: pip wesng"
pip install --break-system-packages --user 'yq' 2>/dev/null || echo "FAIL: pip yq"
pip install --break-system-packages --user 'z3-solver' 2>/dev/null || echo "FAIL: pip z3-solver"
pip install --break-system-packages --user 'impacket' 2>/dev/null || echo "FAIL: pip impacket"
pip install --break-system-packages --user 'zoomeye' 2>/dev/null || echo "FAIL: pip zoomeye"

#--- 5) NPM install ---
echo "[+] npm install -g..."
sudo npm install -g -g @42crunch/api-security-audit 2>/dev/null || echo "FAIL: npm -g @42crunch/api-security-audit"
sudo npm install -g -g cloudsploit 2>/dev/null || echo "FAIL: npm -g cloudsploit"
sudo npm install -g -g fx 2>/dev/null || echo "FAIL: npm -g fx"
sudo npm install -g -g igrapefruit 2>/dev/null || echo "FAIL: npm -g igrapefruit"
sudo npm install -g -g jwt-cracker 2>/dev/null || echo "FAIL: npm -g jwt-cracker"
sudo npm install -g -g npm 2>/dev/null || echo "FAIL: npm -g npm"
sudo npm install -g -g passionfruit 2>/dev/null || echo "FAIL: npm -g passionfruit"
sudo npm install -g puppeteer 2>/dev/null || echo "FAIL: npm puppeteer"
sudo npm install -g -g repo-supervisor 2>/dev/null || echo "FAIL: npm -g repo-supervisor"
sudo npm install -g -g retire 2>/dev/null || echo "FAIL: npm -g retire"
sudo npm install -g -g snyk 2>/dev/null || echo "FAIL: npm -g snyk"
sudo npm install -g -g snyk 2>/dev/null || echo "FAIL: npm -g snyk"
sudo npm install -g -g socket 2>/dev/null || echo "FAIL: npm -g socket"
sudo npm install -g -g wappalyzer 2>/dev/null || echo "FAIL: npm -g wappalyzer"

#--- 6) GEM install ---
echo "[+] gem install..."
sudo gem install brakeman 2>/dev/null || echo "FAIL: gem brakeman"
sudo gem install catphish 2>/dev/null || echo "FAIL: gem catphish"
sudo gem install evil-winrm 2>/dev/null || echo "FAIL: gem evil-winrm"
sudo gem install filebuster 2>/dev/null || echo "FAIL: gem filebuster"
sudo gem install haiti-hash 2>/dev/null || echo "FAIL: gem haiti-hash"
sudo gem install haiti-hash 2>/dev/null || echo "FAIL: gem haiti-hash"
sudo gem install one_gadget 2>/dev/null || echo "FAIL: gem one_gadget"
sudo gem install serpico 2>/dev/null || echo "FAIL: gem serpico"
sudo gem install twurl 2>/dev/null || echo "FAIL: gem twurl"
sudo gem install XSpear 2>/dev/null || echo "FAIL: gem XSpear"
sudo gem install zsteg 2>/dev/null || echo "FAIL: gem zsteg"

#--- 7) CARGO install ---
echo "[+] cargo install..."
cargo install cargo-audit 2>/dev/null || echo "FAIL: cargo cargo-audit"
cargo install graphql-path-enum 2>/dev/null || echo "FAIL: cargo graphql-path-enum"
cargo install htmlq 2>/dev/null || echo "FAIL: cargo htmlq"
cargo install vita 2>/dev/null || echo "FAIL: cargo vita"

#--- 8) DOCKER pull (büyük, opsiyonel - varsayılan KAPALI) ---
if [[ "${INSTALL_DOCKER:-0}" == "1" ]]; then
  docker pull aiverify/aiverify-portal 2>/dev/null || true
  docker pull aktosecurity/akto-api-security-community 2>/dev/null || true
  docker pull quay.io/coreos/clair 2>/dev/null || true
  docker pull quay.io/projectquay/clair:latest 2>/dev/null || true
  docker pull thehiveproject/cortex:latest 2>/dev/null || true
  docker pull trailofbits/echidna 2>/dev/null || true
  docker pull grrdocker/grr 2>/dev/null || true
  docker pull checkmarx/kics 2>/dev/null || true
  docker pull coolacid/misp-docker:core-latest 2>/dev/null || true
  docker pull opensecurity/mobile-security-framework-mobsf:latest 2>/dev/null || true
  docker pull specterops/nemesis 2>/dev/null || true
  docker pull opencti/platform:latest 2>/dev/null || true
  docker pull swaggerapi/swagger-ui 2>/dev/null || true
  docker pull thehiveproject/thehive4:latest 2>/dev/null || true
  docker pull yetiplatform/yeti:latest 2>/dev/null || true
fi

#--- 9) MANUEL GIT CLONE / CURL (KILLI - elle review et) ---
echo "[!] Git clone gerektirenler manuel review icin /tmp/install_manual.txt dosyasinda"

#--- BITIS ---
echo "[+] Tamamlandi. Kontrol icin:"
echo "    sudo systemctl restart cybersec-rust"
echo "    Sonra DB health-check tetikle veya install script tekrar PATH probe yap"
