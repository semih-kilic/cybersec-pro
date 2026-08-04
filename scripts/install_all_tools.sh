#!/usr/bin/env bash
# install_all_tools.sh - Best-effort installer for every tool currently
# marked is_active=FALSE due to "binary_not_found" in the smoke-test report.
#
# Strategy:
#   1) apt (kali repos)
#   2) pipx (isolated python apps)
#   3) pip3 --break-system-packages (libraries / cli combos)
#   4) go install (project-discovery + go cli's)
#   5) curl-binary (single-binary releases)
#   6) git clone /opt/cybersec-tools/<name>  (ht_* scripts and big repos)
#   7) report tools that need manual / paid install
#
# Idempotent: re-running skips already-installed tools.
# Designed to keep going on individual failures; logs everything to
# ${LOG_DIR:-$HOME/install-logs}/<phase>.log
#
# After completion, run:  python3 "$(dirname "$0")/tool_smoke_test.py" --apply

set -u
LOG_DIR="${LOG_DIR:-$HOME/install-logs}"
mkdir -p "$LOG_DIR"
SUMMARY="$LOG_DIR/summary.txt"
: > "$SUMMARY"

OPT="${OPT:-/opt/cybersec-tools}"
sudo -n mkdir -p "$OPT"
sudo -n chown -R "$USER:$USER" "$OPT" 2>/dev/null || true

GOBIN=${GOBIN:-$HOME/go/bin}
mkdir -p "$GOBIN"
export PATH="$GOBIN:$HOME/.local/bin:$PATH"

mark()  { echo "[$(date +%H:%M:%S)] $*" | tee -a "$SUMMARY"; }
phase() { echo; echo "================ $* ================" | tee -a "$SUMMARY"; }

have() { command -v "$1" >/dev/null 2>&1; }

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 1 — apt packages"
APT=(androguard axiom certgraph chainsaw cosign foundry golang-go govulncheck
     lapsdumper ligolo-ng peirates quark-engine sigma slowloris syft
     # also try common names that may exist in kali repos:
     impacket-scripts python3-impacket testssl.sh tilix w3af whatweb
     dirsearch ffuf gobuster wfuzz wpscan
     osquery dive hadolint trivy
     pipx)
mark "apt installing: ${APT[*]}"
sudo -n apt-get update -qq                      >>"$LOG_DIR/apt.log" 2>&1 || true
sudo -n apt-get install -y --no-install-recommends "${APT[@]}" \
                                                >>"$LOG_DIR/apt.log" 2>&1 || true

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 2 — pipx (isolated python tools)"
PIPX=(
  bbot                  # OSINT
  certipy-ad            # AD certificates (provides 'certipy')
  checkov               # IaC scanner
  detect-secrets        # secrets scanner
  ggshield              # gitguardian cli
  holehe                # email enumeration
  maigret               # username search
  socialscan            # username/email checker
  cloudsplaining        # AWS IAM scan
  prowler               # multi-cloud
  scoutsuite            # multi-cloud
  semgrep               # SAST
  safety                # python deps
  sqlmap                # already exists usually
  impacket              # if not via apt
  noseyparker           # secrets in git history
  cartography           # graph cloud
  garak                 # LLM red-team
  llm-guard             # LLM input/output guard
  giskard               # ML test
  promptfoo             # LLM prompt eval (may be npm)
  modelscan             # ML model scanner
  vigil-llm             # LLM scanner
  plexiglass            # LLM red-team
  octoscan              # office macros
  manticore             # symbolic execution
  mythril               # solidity analyzer
  slither-analyzer      # solidity (provides 'slither')
  crytic-compile
  androwarn
  apkx
  quark-engine          # may also be apt
  pwncat-cs
  pe-tree
  capa                  # binary capability
  floss                 # FLOSS strings
  haiti-hash            # hash identifier (provides 'haiti')
  hash-buster
  whispers              # secrets
  xnlinkfinder
  xspear                # actually ruby - may fail, that's ok
  webrtc-leak           # placeholder
  inql                  # GraphQL
  graphql-path-enum
  reconftw              # may not be on pip; expected to fall through to git
  retire                # actually npm
  truffleHog3           # extra
  yara
  jupyter
  drozer-agent
  cuckoo                # very large, may fail; that's ok
  starboard-cli
  takeover
  pyresttest            # api
)
for p in "${PIPX[@]}"; do
  mark "pipx install $p"
  pipx install --quiet "$p" >>"$LOG_DIR/pipx.log" 2>&1 || \
    pipx install --quiet --pip-args="--break-system-packages" "$p" \
                                                >>"$LOG_DIR/pipx.log" 2>&1 || true
done

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 3 — pip3 (library-style tools)"
PIP3=(
  androguard androwarn apkx
  intezer-sdk intezer-analyze-cli
  pwncat-cs
  cloudgrappler
  cspbypass
  endgame
  explo
  hostilizer
  intelmq
  graphqlmap
  hash-buster
  password_list_smwyg
  newman                 # actually npm; will fall
  starkware-crypto-utils
  octoscan
)
for p in "${PIP3[@]}"; do
  mark "pip3 install $p"
  pip3 install --break-system-packages --quiet "$p" \
                                                >>"$LOG_DIR/pip3.log" 2>&1 || true
done

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 4 — go install (Project Discovery, Go CLIs)"
GOPKGS=(
  github.com/projectdiscovery/asnmap/cmd/asnmap@latest
  github.com/projectdiscovery/cvemap/cmd/cvemap@latest
  github.com/projectdiscovery/mapcidr/cmd/mapcidr@latest
  github.com/projectdiscovery/katana/cmd/katana@latest
  github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
  github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest
  github.com/projectdiscovery/uncover/cmd/uncover@latest
  github.com/projectdiscovery/chaos-client/cmd/chaos@latest
  github.com/hahwul/dalfox/v2@latest
  github.com/lc/gau/v2/cmd/gau@latest
  github.com/tomnomnom/assetfinder@latest
  github.com/tomnomnom/anew@latest
  github.com/tomnomnom/qsreplace@latest
  github.com/tomnomnom/waybackurls@latest
  github.com/d3mondev/puredns/v2@latest
  github.com/glebarez/cero@latest
  github.com/Edu4rdSHL/findomain@latest                       # may fail (rust)
  github.com/lukasikic/subzy@latest
  github.com/owasp-amass/amass/v4/...@master
  github.com/aquasecurity/tfsec/cmd/tfsec@latest
  github.com/tenable/terrascan@latest
  github.com/wagoodman/dive@latest
  github.com/anchore/syft/cmd/syft@latest
  github.com/anchore/grype/cmd/grype@latest
  github.com/sigstore/cosign/v2/cmd/cosign@latest
  github.com/sigstore/rekor/cmd/rekor-cli@latest
  github.com/slsa-framework/slsa-verifier/v2/cli/slsa-verifier@latest
  github.com/google/go-containerregistry/cmd/crane@latest
  github.com/aquasecurity/kube-bench@latest
  github.com/aquasecurity/kube-hunter@latest                  # python actually
  github.com/Shopify/kubeaudit@latest
  github.com/stackrox/kube-linter/cmd/kube-linter@latest
  github.com/controlplaneio/kubesec/v2/cmd/kubesec@latest
  github.com/kubescape/kubescape/v3@latest
  github.com/FairwindsOps/polaris/cmd/polaris@latest
  github.com/quarkslab/kdigger/cmd/kdigger@latest
  github.com/kubernetes-sigs/krew/cmd/krew@latest
  github.com/wader/fq@latest
  github.com/BishopFox/cloudfox@latest
  github.com/CycloneDX/cdxgen@latest
  github.com/legitify-dev/legitify@latest
  github.com/google/cve-bin-tool@latest
  github.com/owasp-amass/oam-tools/cmd/oam_subs@latest
  github.com/zricethezav/gitleaks/v8@latest
  github.com/r4yan2/byp4xx@latest                             # may not be go
  github.com/ropnop/kerbrute@latest
  github.com/google/osv-scanner/cmd/osv-scanner/v2@latest
  github.com/grafana/regula@latest                            # may not exist
  github.com/snyk/cli@latest                                  # snyk - may fail
  github.com/dorkerdevil/sqlscan@latest                       # may not exist
  github.com/yodaos-project/yarr@latest                       # placeholder
)
for p in "${GOPKGS[@]}"; do
  mark "go install $p"
  GOBIN="$GOBIN" go install "$p" >>"$LOG_DIR/go.log" 2>&1 || true
done
# Symlink GOBIN tools to /usr/local/bin so PATH-less services find them
for f in "$GOBIN"/*; do
  [ -f "$f" ] && [ -x "$f" ] && sudo -n ln -sf "$f" "/usr/local/bin/$(basename "$f")" 2>/dev/null || true
done

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 5 — curl/binary releases"
install_release() {
  local name=$1 url=$2 extract=${3:-}
  if have "$name"; then mark "$name already installed"; return; fi
  mark "downloading $name from $url"
  local tmp; tmp=$(mktemp -d)
  if curl -fsSL "$url" -o "$tmp/pkg" >>"$LOG_DIR/release.log" 2>&1; then
    case "$extract" in
      tar.gz) tar -xzf "$tmp/pkg" -C "$tmp" ;;
      zip)    unzip -q "$tmp/pkg" -d "$tmp" ;;
      bin)    chmod +x "$tmp/pkg"; sudo -n install -m 0755 "$tmp/pkg" "/usr/local/bin/$name" ;;
    esac
    if [ "$extract" != "bin" ]; then
      local b; b=$(find "$tmp" -type f -name "$name" -executable | head -1)
      [ -n "$b" ] && sudo -n install -m 0755 "$b" "/usr/local/bin/$name" || true
    fi
  fi
  rm -rf "$tmp"
}

ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH64=amd64 || ARCH64=arm64
install_release hadolint \
  "https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64" bin
install_release dive \
  "https://github.com/wagoodman/dive/releases/download/v0.12.0/dive_0.12.0_linux_${ARCH64}.tar.gz" tar.gz
install_release dockle \
  "https://github.com/goodwithtech/dockle/releases/download/v0.4.14/dockle_0.4.14_Linux-64bit.tar.gz" tar.gz
install_release tfsec \
  "https://github.com/aquasecurity/tfsec/releases/latest/download/tfsec-linux-${ARCH64}" bin
install_release terrascan \
  "https://github.com/tenable/terrascan/releases/download/v1.19.9/terrascan_1.19.9_Linux_x86_64.tar.gz" tar.gz
install_release cosign \
  "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-${ARCH64}" bin
install_release rekor-cli \
  "https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-${ARCH64}" bin
install_release slsa-verifier \
  "https://github.com/slsa-framework/slsa-verifier/releases/latest/download/slsa-verifier-linux-${ARCH64}" bin
install_release codeql \
  "https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip" zip
install_release container-diff \
  "https://github.com/GoogleContainerTools/container-diff/releases/latest/download/container-diff-linux-${ARCH64}" bin
install_release kubescape \
  "https://github.com/kubescape/kubescape/releases/latest/download/kubescape-ubuntu-latest" bin
install_release kube-bench \
  "https://github.com/aquasecurity/kube-bench/releases/download/v0.7.3/kube-bench_0.7.3_linux_${ARCH64}.tar.gz" tar.gz
install_release apko \
  "https://github.com/chainguard-dev/apko/releases/latest/download/apko_$(uname -s | tr A-Z a-z)_${ARCH64}" bin
install_release k-rail \
  "https://github.com/cruise-automation/k-rail/releases/latest/download/k-rail-linux-${ARCH64}" bin
install_release botkube \
  "https://github.com/kubeshop/botkube/releases/latest/download/botkube_Linux_x86_64.tar.gz" tar.gz
install_release legitify \
  "https://github.com/Legit-Labs/legitify/releases/latest/download/legitify_Linux_x86_64.tar.gz" tar.gz
install_release zizmor \
  "https://github.com/woodruffw/zizmor/releases/latest/download/zizmor-x86_64-unknown-linux-gnu" bin

# noseyparker prebuilt
install_release noseyparker \
  "https://github.com/praetorian-inc/noseyparker/releases/latest/download/noseyparker-x86_64-unknown-linux-gnu.tar.gz" tar.gz

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 6 — git clone (ht_* scripts + big repos)"
declare -A REPOS=(
  [AdvPhishing]=https://github.com/Ignitetch/AdvPhishing
  [AndroBugs_Framework]=https://github.com/AndroBugs/AndroBugs_Framework
  [apk2gold]=https://github.com/lxdvs/apk2gold
  [astra]=https://github.com/flipkart-incubator/Astra
  [autophisher]=https://github.com/Toxic-Noob/AutoPhisher
  [aws_pwn]=https://github.com/dagrz/aws_pwn
  [blackeye]=https://github.com/An0nUD4Y/blackeye
  [BlackPhish]=https://github.com/iinc0gnit0/BlackPhish
  [Blisqy]=https://github.com/JohnTroony/Blisqy
  [Breacher]=https://github.com/s0md3v/Breacher
  [Brutal]=https://github.com/Screetsec/Brutal
  [Brute_Force]=https://github.com/Matrix07ksa/Brute_Force
  [checkURL]=https://github.com/UndeadSec/checkURL
  [HeraKeylogger]=https://github.com/UnkL4b/HeraKeylogger
  [CMSeeK]=https://github.com/Tuhinshubhra/CMSeeK
  [crivo]=https://github.com/sc4r3cr0w/crivo
  [ddos]=https://github.com/Yann1922/ddos
  [Debinject]=https://github.com/UndeadSec/Debinject
  [DSSS]=https://github.com/stamparm/DSSS
  [Enigma]=https://github.com/UndeadSec/Enigma
  [EvilApp]=https://github.com/crypt0b1t/EvilApp
  [EvilURL]=https://github.com/UndeadSec/EvilURL
  [extended-xss-search]=https://github.com/Damian89/extended-xss-search
  [fastssh]=https://github.com/Z4nzu/fastssh
  [finduser]=https://github.com/whoami-anoynimous/finduser
  [GCPBucketBrute]=https://github.com/RhinoSecurityLabs/GCPBucketBrute
  [GoblinWordGenerator]=https://github.com/UndeadSec/GoblinWordGenerator
  [I-See-You]=https://github.com/Viralmaniar/I-See-You
  [keydroid]=https://github.com/F4dl0/keydroid
  [lazyrecon]=https://github.com/nahamsec/lazyrecon
  [lockphish]=https://github.com/JasonJerry/lockphish
  [maskphish]=https://github.com/jaykali/maskphish
  [Mob-Droid]=https://github.com/kinghacker0/Mob-Droid
  [mysms]=https://github.com/mistersai/mysms
  [ohmyqr]=https://github.com/aju100/ohmyqr
  [PEASS-ng]=https://github.com/carlospolop/PEASS-ng
  [pixload]=https://github.com/chinarulezzz/pixload
  [QRLJacking]=https://github.com/OWASP/QRLJacking
  [RVuln]=https://github.com/Hakaivelocity/RVuln
  [saycheese]=https://github.com/hangetzzu/saycheese
  [SecretFinder]=https://github.com/m4ll0k/SecretFinder
  [shellphish]=https://github.com/An0nUD4Y/shellphish
  [Shodanfy.py]=https://github.com/m4ll0k/Shodanfy.py
  [spycam]=https://github.com/CenterForThreatInformedDefense/spycam
  [StegoCracker]=https://github.com/W1LDN16H7/StegoCracker
  [Thanos]=https://github.com/yashk2000/Thanos
  [underhanded]=https://github.com/Charliedean/underhanded
  [Vegile]=https://github.com/Screetsec/Vegile
  [vulnx]=https://github.com/anouarbensaad/vulnx
  [web2attack]=https://github.com/Pradeep-Goswami/web2attack
  [websploit]=https://github.com/The404Hacking/websploit
  [weirdAAL]=https://github.com/carnal0wnage/weirdAAL
  [WishFish]=https://github.com/UndeadSec/WishFish
  [wlcreator]=https://github.com/UndeadSec/wlcreator
  [XanXSS]=https://github.com/Ekultek/XanXSS
  [XSSCon]=https://github.com/menkrep1337/XSSCon
  [XSS-Freak]=https://github.com/UndeadSec/XSS-Freak
  [XSS-LOADER]=https://github.com/capture0x/XSS-LOADER
  # absolute path tools
  [arachni]=https://github.com/Arachni/arachni
  [dependency-check]=https://github.com/jeremylong/DependencyCheck
  [hayabusa]=https://github.com/Yamato-Security/hayabusa
  # extras for big tools missing from apt
  [w3af]=https://github.com/andresriancho/w3af
  [Sn1per]=https://github.com/1N3/Sn1per
  [osmedeus]=https://github.com/j3ssie/osmedeus
  [reconftw]=https://github.com/six2dez/reconftw
  [drozer]=https://github.com/WithSecureLabs/drozer
  [impacket]=https://github.com/fortra/impacket
  [Cartography]=https://github.com/lyft/cartography
  [parliament]=https://github.com/duo-labs/parliament
  [principalmapper]=https://github.com/nccgroup/PMapper
  [ScoutSuite]=https://github.com/nccgroup/ScoutSuite
  [Prowler]=https://github.com/prowler-cloud/prowler
)
cd "$OPT" || exit 0
for repo_dir in "${!REPOS[@]}"; do
  url=${REPOS[$repo_dir]}
  if [ -d "$OPT/$repo_dir/.git" ]; then
    mark "git pull $repo_dir"
    git -C "$OPT/$repo_dir" pull --quiet --ff-only >>"$LOG_DIR/git.log" 2>&1 || true
  else
    mark "git clone $url -> $OPT/$repo_dir"
    git clone --depth=1 --quiet "$url" "$OPT/$repo_dir" \
                                                >>"$LOG_DIR/git.log" 2>&1 || true
  fi
done

# ─────────────────────────────────────────────────────────────────────
phase "PHASE 7 — npm CLIs"
NPM=( newman retire @cyclonedx/cdxgen )
for p in "${NPM[@]}"; do
  mark "npm install -g $p"
  sudo -n npm install -g --silent "$p" >>"$LOG_DIR/npm.log" 2>&1 || true
done

# ─────────────────────────────────────────────────────────────────────
phase "DONE — see $LOG_DIR/*.log for per-phase output"
mark "Run smoke test now:"
mark "  python3 $(dirname "$0")/tool_smoke_test.py --apply"
