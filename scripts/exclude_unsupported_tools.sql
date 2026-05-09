-- exclude_unsupported_tools.sql
-- Marks tools that cannot reasonably run on a Linux SaaS scanner host as
-- inactive. They stay in the DB (id-stable for history/reports) but are
-- hidden from the dashboard.

BEGIN;

-- Add a "exclusion_reason" column if missing (text, nullable).
ALTER TABLE tools ADD COLUMN IF NOT EXISTS exclusion_reason text;

-- 1) PAID / LICENSE-GATED (no usable free tier, can't auto-install)
UPDATE tools SET is_active = FALSE, exclusion_reason = 'paid_license'
WHERE name IN (
  'codeql','snyk','snyk_code','mayhem_for_api','intezer_analyze_cli','intezer',
  'certora_prover','rapidfort','anchore_engine','42crunch_audit',
  'artifactory_audit','phylum','apicheck','vooki','peach'
);

-- 2) iOS-only (need a jailbroken iPhone or macOS host)
UPDATE tools SET is_active = FALSE, exclusion_reason = 'ios_only'
WHERE name IN ('iblessing','grapefruit','passionfruit','idb');

-- 3) Windows-only (analyse Windows binaries / event logs natively)
UPDATE tools SET is_active = FALSE, exclusion_reason = 'windows_only'
WHERE name IN ('pestudio','aix','hostilizer');
-- NOTE: hayabusa, chainsaw, sigma can process Windows logs from a Linux host,
--       so they stay active.

-- 4) Hardware / physical-lab requirements
UPDATE tools SET is_active = FALSE, exclusion_reason = 'hardware_required'
WHERE name IN (
  'bluepot',          -- Bluetooth honeypot (BT adapter)
  'cuckoo',           -- malware sandbox (KVM lab + Windows guests)
  'wifi_arsenal',     -- monitor-mode WiFi card
  'drozer',           -- Android device + USB debugging
  'howmanypeople',    -- WiFi monitor mode + RTL-SDR
  'multitor'          -- needs many Tor circuits + dedicated network
);

-- 5) Discontinued / abandoned upstream
UPDATE tools SET is_active = FALSE, exclusion_reason = 'discontinued'
WHERE name IN (
  'arachni',          -- project archived 2017
  'password_list_smwyg',  -- 1.4B leak download, no scanner
  'whitespace_snow10'     -- empty placeholder
);

-- Final visibility
\echo '─── Exclusion summary ───'
SELECT exclusion_reason, COUNT(*) FROM tools
WHERE exclusion_reason IS NOT NULL
GROUP BY exclusion_reason ORDER BY 2 DESC;

\echo '─── New active count ───'
SELECT COUNT(*) AS active_tools, COUNT(DISTINCT category) AS categories
FROM tools WHERE is_active = TRUE;

COMMIT;
