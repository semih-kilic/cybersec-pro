#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
declare -A ALIAS=(
  [bulk_extractor]=bulk-extractor
  [theHarvester]=theharvester
  [certipy]=certipy-ad
  [metasploit]=metasploit-framework
  [empire]=powershell-empire
  [photorec]=testdisk
  [impacket]=python3-impacket
  [secretsdump]=impacket-scripts
  [name-that-hash]=name-that-hash
  [theharvester]=theharvester
  [windows-exploit-suggester]=windows-exploit-suggester
  [enum4linux-ng]=enum4linux-ng
  [volatility3]=volatility3
  [bettercap]=bettercap
  [mtr]=mtr-tiny
)
echo ">>> apt update"
apt-get update -y >/tmp/apt_update.log 2>&1
ok=0; fail=0; failed=""
while read b; do
  [ -z "$b" ] && continue
  pkg="${ALIAS[$b]:-$b}"
  if apt-get install -y --no-install-recommends "$pkg" >/tmp/apt_one.log 2>&1; then
    ok=$((ok+1))
  else
    fail=$((fail+1)); failed="$failed $b"
  fi
done < /opt/missing.txt
echo ">>> apt ok=$ok fail=$fail"
echo ">>> failed:$failed"
