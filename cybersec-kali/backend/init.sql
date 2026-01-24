-- CyberSec Platform - Database Initialization
-- Creates initial schema and seeds data

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Tools table
CREATE TABLE IF NOT EXISTS tools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    command VARCHAR(200),
    installed BOOLEAN DEFAULT FALSE,
    version VARCHAR(50),
    requires_sudo BOOLEAN DEFAULT FALSE,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tool_id INTEGER REFERENCES tools(id),
    user_id INTEGER REFERENCES users(id),
    target VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    output TEXT,
    error TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role) 
VALUES ('admin', 'admin@cybersec.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFp.PAVpyP1HdLO', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert sample security tools
INSERT INTO tools (name, category, description, command, installed) VALUES
('Nmap', 'Network Scanner', 'Network exploration and security auditing', 'nmap', true),
('Metasploit', 'Exploitation', 'Penetration testing framework', 'msfconsole', true),
('Nikto', 'Web Scanner', 'Web server scanner', 'nikto', true),
('SQLMap', 'Web Scanner', 'Automatic SQL injection tool', 'sqlmap', true),
('Burp Suite', 'Web Scanner', 'Web application security testing', 'burpsuite', false),
('Wireshark', 'Network Analyzer', 'Network protocol analyzer', 'wireshark', true),
('John the Ripper', 'Password Cracker', 'Password cracking tool', 'john', true),
('Hydra', 'Password Cracker', 'Network logon cracker', 'hydra', true),
('Aircrack-ng', 'Wireless', 'WiFi security auditing', 'aircrack-ng', true),
('OWASP ZAP', 'Web Scanner', 'Web application security scanner', 'zaproxy', false),
('Hashcat', 'Password Cracker', 'Advanced password recovery', 'hashcat', true),
('Gobuster', 'Web Scanner', 'Directory/file bruteforcer', 'gobuster', true),
('Nuclei', 'Vulnerability Scanner', 'Fast vulnerability scanner', 'nuclei', true),
('Subfinder', 'Reconnaissance', 'Subdomain discovery tool', 'subfinder', true),
('Amass', 'Reconnaissance', 'Network mapping and OSINT', 'amass', true)
ON CONFLICT DO NOTHING;
