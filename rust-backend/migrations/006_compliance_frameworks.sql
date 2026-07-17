-- Compliance Framework Mapping Tables

-- 1. Compliance frameworks (NIST CSF, SOC 2, PCI DSS, etc.)
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL UNIQUE,
    version TEXT,
    description TEXT,
    category TEXT DEFAULT 'security',
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Framework controls (individual requirements)
CREATE TABLE IF NOT EXISTS compliance_controls (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    severity TEXT DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(framework_id, control_id)
);

-- 3. Tool-to-control mappings (which tools test which controls)
CREATE TABLE IF NOT EXISTS compliance_mappings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    coverage_type TEXT DEFAULT 'full',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(control_id, tool_id)
);

-- 4. Per-scan compliance results
CREATE TABLE IF NOT EXISTS scan_compliance_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'untested',
    finding TEXT,
    severity TEXT,
    remediation TEXT,
    tested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scan_id, control_id)
);

-- 5. Organization compliance posture (aggregated view)
CREATE TABLE IF NOT EXISTS compliance_posture (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    total_controls INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    partial INTEGER DEFAULT 0,
    untested INTEGER DEFAULT 0,
    score_pct NUMERIC(5,2) DEFAULT 0,
    last_assessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, framework_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_control ON compliance_mappings(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_tool ON compliance_mappings(tool_id);
CREATE INDEX IF NOT EXISTS idx_scan_compliance_scan ON scan_compliance_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_compliance_control ON scan_compliance_results(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_posture_org ON compliance_posture(organization_id);

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA: 10 Compliance Frameworks
-- ═══════════════════════════════════════════════════════════════

INSERT INTO compliance_frameworks (name, short_name, version, description, category) VALUES
('NIST Cybersecurity Framework', 'NIST CSF', '2.0', 'NIST Framework for Improving Critical Infrastructure Cybersecurity', 'security'),
('NIST SP 800-53', 'NIST 800-53', 'Rev 5', 'Security and Privacy Controls for Information Systems', 'security'),
('SOC 2 Type II', 'SOC 2', '2017', 'AICPA Service Organization Control Trust Service Criteria', 'compliance'),
('PCI DSS', 'PCI DSS', '4.0', 'Payment Card Industry Data Security Standard', 'compliance'),
('HIPAA Security Rule', 'HIPAA', '2013', 'Health Insurance Portability and Accountability Act', 'compliance'),
('Canadian Centre for Cyber Security', 'CCCS', '2024', 'Canadian government IT security guidelines', 'security'),
('ISO/IEC 27001', 'ISO 27001', '2022', 'Information Security Management Systems', 'compliance'),
('CIS Critical Security Controls', 'CIS', 'v8.1', 'Center for Internet Security Critical Controls', 'security'),
('OWASP Top 10', 'OWASP', '2021', 'Open Web Application Security Project Top 10 Risks', 'security'),
('GDPR', 'GDPR', '2016/679', 'General Data Protection Regulation', 'compliance')
ON CONFLICT (short_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA: Key Controls per Framework (mapped to tools)
-- ═══════════════════════════════════════════════════════════════

-- NIST CSF 2.0 Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'ID.AM-1', 'Asset Inventory', 'Physical devices and systems are inventoried', 'Identify', 'Asset Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'ID.AM-2', 'Software Asset Inventory', 'Software platforms and applications are inventoried', 'Identify', 'Asset Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'PR.AC-1', 'Access Control', 'Identities and credentials are issued, managed, verified, revoked', 'Protect', 'Access Control'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'DE.CM-1', 'Network Monitoring', 'The network is monitored to detect potential cybersecurity events', 'Detect', 'Continuous Monitoring'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'DE.CM-4', 'Malicious Code Detection', 'Malicious code is detected', 'Detect', 'Continuous Monitoring'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'RS.RP-1', 'Response Plan', 'Response plan is executed during or after an incident', 'Respond', 'Response Planning'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST CSF'), 'RC.RP-1', 'Recovery Plan', 'Recovery plan is executed during or after an incident', 'Recover', 'Recovery Planning')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- SOC 2 Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'SOC 2'), 'CC6.1', 'Logical Access', 'Logical access security controls are implemented', 'Common Criteria', 'Access Control'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'SOC 2'), 'CC6.6', 'External Threats', 'System boundaries are protected against external threats', 'Common Criteria', 'System Operations'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'SOC 2'), 'CC7.1', 'Vulnerability Management', 'The entity uses detection and monitoring to identify vulnerabilities', 'Common Criteria', 'Risk Mitigation'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'SOC 2'), 'CC7.2', 'Security Monitoring', 'The entity monitors system components for anomalies', 'Common Criteria', 'System Operations'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'SOC 2'), 'CC8.1', 'Change Management', 'The entity manages changes to infrastructure and software', 'Common Criteria', 'Change Management')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- PCI DSS Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'PCI DSS'), 'Req-1', 'Network Security Controls', 'Install and maintain network security controls', 'Requirements', 'Network'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'PCI DSS'), 'Req-2', 'Secure Configurations', 'Apply secure configurations to all system components', 'Requirements', 'Configuration'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'PCI DSS'), 'Req-3', 'Protect Stored Account Data', 'Protect stored account data', 'Requirements', 'Data Protection'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'PCI DSS'), 'Req-6', 'Secure Systems and Software', 'Develop and maintain secure systems and software', 'Requirements', 'Development'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'PCI DSS'), 'Req-11', 'Security Testing', 'Test security of systems and networks regularly', 'Requirements', 'Testing')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- HIPAA Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'HIPAA'), '164.312(a)(1)', 'Access Control', 'Implement technical policies for electronic information systems', 'Technical Safeguards', 'Access'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'HIPAA'), '164.312(e)(1)', 'Transmission Security', 'Implement technical security measures for ePHI in transmission', 'Technical Safeguards', 'Transmission'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'HIPAA'), '164.308(a)(1)', 'Security Management', 'Implement policies and procedures to prevent, detect, and contain security incidents', 'Administrative Safeguards', 'Security Management')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- ISO 27001 Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'ISO 27001'), 'A.5.1', 'Policies for Information Security', 'Information security policy and topic-specific policies', 'Organizational', 'Policies'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'ISO 27001'), 'A.8.1', 'User Endpoint Devices', 'Information security for user endpoint devices', 'Technological', 'Asset Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'ISO 27001'), 'A.8.8', 'Technical Vulnerability Management', 'Information about technical vulnerabilities', 'Technological', 'Vulnerability Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'ISO 27001'), 'A.8.20', 'Network Security', 'Networks and network devices are secured', 'Technological', 'Network Security')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- CIS Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'CIS'), 'CIS-1', 'Inventory of Enterprise Assets', 'Actively manage all enterprise assets', 'Basic Hygiene', 'Asset Inventory'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CIS'), 'CIS-2', 'Inventory of Software Assets', 'Actively manage all software on the network', 'Basic Hygiene', 'Software Inventory'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CIS'), 'CIS-3', 'Data Protection', 'Develop processes and technical controls to identify and protect data', 'Basic Hygiene', 'Data Protection'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CIS'), 'CIS-7', 'Continuous Vulnerability Management', 'Continuously acquire, assess, detect, and audit vulnerabilities', 'Basic Hygiene', 'Vulnerability Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CIS'), 'CIS-13', 'Network Monitoring and Defense', 'Operate processes and tooling to prevent and detect attacks', 'Basic Hygiene', 'Network Defense')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- OWASP Top 10 Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'OWASP'), 'A01:2021', 'Broken Access Control', 'Restrictions on what authenticated users are allowed to do', 'Application Security', 'Access Control'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'OWASP'), 'A03:2021', 'Injection', 'User-supplied data is not validated, filtered, or sanitized', 'Application Security', 'Input Validation'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'OWASP'), 'A05:2021', 'Security Misconfiguration', 'Missing appropriate security hardening', 'Application Security', 'Configuration'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'OWASP'), 'A06:2021', 'Vulnerable Components', 'Using components with known vulnerabilities', 'Application Security', 'Dependencies'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'OWASP'), 'A09:2021', 'Security Logging Failures', 'Insufficient logging, detection, monitoring, and active response', 'Application Security', 'Logging')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- NIST SP 800-53 Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST 800-53'), 'AC-2', 'Account Management', 'Manage information system accounts', 'Access Control', 'Account Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST 800-53'), 'RA-5', 'Vulnerability Monitoring', 'Monitor, scan, and analyze information system vulnerabilities', 'Risk Assessment', 'Vulnerability Scanning'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST 800-53'), 'SI-2', 'Flaw Remediation', 'Identify, report, and correct information system flaws', 'System Integrity', 'Flaw Remediation'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'NIST 800-53'), 'SC-7', 'Boundary Protection', 'Monitor and control communications at external boundaries', 'System and Communications Protection', 'Boundary Protection')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- CCCS Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'CCCS'), 'ITSG-33', 'Security Controls', 'Implementation of security controls for IT systems', 'Baseline', 'Controls'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CCCS'), 'ITSM-10', 'Vulnerability Management', 'Identifying, assessing, and mitigating vulnerabilities', 'Operations', 'Vulnerability Management'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'CCCS'), 'ITSP-40', 'Network Security', 'Network architecture and protective measures', 'Protection', 'Network Security')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- GDPR Controls
INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name = 'GDPR'), 'Art.25', 'Data Protection by Design', 'Implement appropriate technical and organisational measures', 'Principles', 'Privacy by Design'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'GDPR'), 'Art.32', 'Security of Processing', 'Implement appropriate technical and organisational security measures', 'Security', 'Processing Security'),
((SELECT id FROM compliance_frameworks WHERE short_name = 'GDPR'), 'Art.33', 'Breach Notification', 'Notify supervisory authority of personal data breach', 'Obligations', 'Breach Notification')
ON CONFLICT (framework_id, control_id) DO NOTHING;

-- Map tools to NIST CSF controls
DO $$
DECLARE
    nist_id TEXT;
    nmap_id TEXT;
    sqlmap_id TEXT;
    nikto_id TEXT;
    nuclei_id TEXT;
    gobuster_id TEXT;
    masscan_id TEXT;
    hydra_id TEXT;
    whatweb_id TEXT;
    wpscan_id TEXT;
BEGIN
    SELECT id INTO nist_id FROM compliance_frameworks WHERE short_name = 'NIST CSF';
    SELECT id INTO nmap_id FROM tools WHERE name = 'nmap' LIMIT 1;
    SELECT id INTO sqlmap_id FROM tools WHERE name = 'sqlmap' LIMIT 1;
    SELECT id INTO nikto_id FROM tools WHERE name = 'nikto' LIMIT 1;
    SELECT id INTO nuclei_id FROM tools WHERE name = 'nuclei' LIMIT 1;
    SELECT id INTO gobuster_id FROM tools WHERE name = 'gobuster' LIMIT 1;
    SELECT id INTO masscan_id FROM tools WHERE name = 'masscan' LIMIT 1;
    SELECT id INTO hydra_id FROM tools WHERE name = 'hydra' LIMIT 1;
    SELECT id INTO whatweb_id FROM tools WHERE name = 'whatweb' LIMIT 1;
    SELECT id INTO wpscan_id FROM tools WHERE name = 'wpscan' LIMIT 1;

    IF nmap_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, nmap_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id IN ('ID.AM-1','DE.CM-1')
        ON CONFLICT DO NOTHING;
    END IF;
    IF masscan_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, masscan_id, 'partial' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id = 'ID.AM-1'
        ON CONFLICT DO NOTHING;
    END IF;
    IF sqlmap_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, sqlmap_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id = 'DE.CM-4'
        ON CONFLICT DO NOTHING;
    END IF;
    IF nikto_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, nikto_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id IN ('DE.CM-4','PR.AC-1')
        ON CONFLICT DO NOTHING;
    END IF;
    IF nuclei_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, nuclei_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id IN ('DE.CM-4','ID.AM-2')
        ON CONFLICT DO NOTHING;
    END IF;
    IF gobuster_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, gobuster_id, 'partial' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id = 'ID.AM-2'
        ON CONFLICT DO NOTHING;
    END IF;
    IF hydra_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, hydra_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id = 'PR.AC-1'
        ON CONFLICT DO NOTHING;
    END IF;
    IF whatweb_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, whatweb_id, 'partial' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id = 'ID.AM-2'
        ON CONFLICT DO NOTHING;
    END IF;
    IF wpscan_id IS NOT NULL THEN
        INSERT INTO compliance_mappings (control_id, tool_id, coverage_type)
        SELECT c.id, wpscan_id, 'full' FROM compliance_controls c WHERE c.framework_id = nist_id AND c.control_id IN ('DE.CM-4','ID.AM-2')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
