import sys, re
lines = [l.rstrip('\n') for l in sys.stdin]
i = 0
installable = []
skipped = []
while i < len(lines):
    line = lines[i]
    m = re.match(r'^([A-Za-z0-9.+_-]+):$', line)
    if m:
        pkg = m.group(1)
        i += 1
        candidate = 'none'
        while i < len(lines):
            l2 = lines[i]
            if re.match(r'^[A-Za-z0-9.+_-]+:$', l2):
                break
            m2 = re.match(r'^\s+Candidate:\s+(\S+)', l2)
            if m2:
                candidate = m2.group(1).lower()
            i += 1
        if candidate != 'none' and candidate != '(none)':
            installable.append(pkg)
        else:
            skipped.append(pkg)
    else:
        i += 1
print('\n'.join(installable))
sys.stderr.write('SKIPPED-NOT-IN-APT: ' + ' '.join(skipped) + '\n')
