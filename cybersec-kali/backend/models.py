"""
Database models and initialization
"""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }


class Tool(db.Model):
    __tablename__ = 'tools'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False, index=True)
    description = db.Column(db.Text)
    command = db.Column(db.String(200))
    installed = db.Column(db.Boolean, default=False)
    version = db.Column(db.String(50))
    requires_sudo = db.Column(db.Boolean, default=False)
    difficulty = db.Column(db.String(20))  # beginner, intermediate, advanced, expert
    ai_prompt = db.Column(db.Text)  # Natural language command hints for AI
    tags = db.Column(db.JSON)
    usage_count = db.Column(db.Integer, default=0)
    last_used = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'command': self.command,
            'installed': self.installed,
            'version': self.version,
            'requires_sudo': self.requires_sudo,
            'difficulty': self.difficulty,
            'ai_prompt': self.ai_prompt,
            'tags': self.tags or [],
            'usage_count': self.usage_count,
            'last_used': self.last_used.isoformat() if self.last_used else None
        }


class Project(db.Model):
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='active')  # active, completed, archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref='projects')
    
    def to_dict(self):
        findings = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
        targets = []
        try:
            targets = [t.value for t in self.targets] if hasattr(self, 'targets') else []
            target_ids = [t.id for t in self.targets] if hasattr(self, 'targets') else []
            if target_ids:
                rows = (
                    db.session.query(Vulnerability.severity, func.count(Vulnerability.id))
                    .filter(Vulnerability.target_id.in_(target_ids))
                    .group_by(Vulnerability.severity)
                    .all()
                )
                for severity, count in rows:
                    if severity in findings:
                        findings[severity] = count
        except Exception:
            pass
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'client': '',
            'user_id': self.user_id,
            'status': self.status,
            'start_date': self.created_at.date().isoformat() if self.created_at else None,
            'end_date': None,
            'targets': targets,
            'scope': [],
            'findings': findings,
            'progress': 0,
            'team': [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'targets_count': len(self.targets) if hasattr(self, 'targets') else 0,
            'scans_count': len(self.scans) if hasattr(self, 'scans') else 0,
            'reports_count': len(self.reports) if hasattr(self, 'reports') else 0
        }


class Target(db.Model):
    __tablename__ = 'targets'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # ip, domain, network, url
    value = db.Column(db.String(500), nullable=False)
    name = db.Column(db.String(200))
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')  # active, scanned, vulnerable, secure
    info = db.Column(db.JSON)  # ports, os, services, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    project = db.relationship('Project', backref='targets')
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'type': self.type,
            'value': self.value,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'info': self.info or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'vulnerabilities_count': Vulnerability.query.filter_by(target_id=self.id).count()
        }


class Scan(db.Model):
    __tablename__ = 'scans'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    tool_id = db.Column(db.Integer, db.ForeignKey('tools.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    target_id = db.Column(db.Integer, db.ForeignKey('targets.id'), nullable=True)
    target = db.Column(db.String(500), nullable=False)
    command = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending', index=True)  # pending, running, completed, failed
    output = db.Column(db.Text)
    error = db.Column(db.Text)
    progress = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    project = db.relationship('Project', backref='scans')
    tool = db.relationship('Tool', backref='scans')
    user = db.relationship('User', backref='scans')
    target_rel = db.relationship('Target', backref='scans', foreign_keys=[target_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'project_id': self.project_id,
            'tool_id': self.tool_id,
            'tool_name': self.tool.name if self.tool else None,
            'user_id': self.user_id,
            'target_id': self.target_id,
            'target': self.target,
            'command': self.command,
            'status': self.status,
            'progress': self.progress,
            'output': self.output,
            'error': self.error,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Vulnerability(db.Model):
    __tablename__ = 'vulnerabilities'
    
    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey('targets.id'), nullable=False)
    scan_id = db.Column(db.Integer, db.ForeignKey('scans.id'), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    severity = db.Column(db.String(20), nullable=False, index=True)  # critical, high, medium, low, info
    description = db.Column(db.Text)
    cve_id = db.Column(db.String(50))
    cvss_score = db.Column(db.Float)
    port = db.Column(db.Integer)
    service = db.Column(db.String(100))
    remediation = db.Column(db.Text)
    status = db.Column(db.String(20), default='open')  # open, fixed, false_positive, accepted_risk
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    target = db.relationship('Target', backref='vulnerabilities')
    scan = db.relationship('Scan', backref='vulnerabilities')
    
    def to_dict(self):
        return {
            'id': self.id,
            'target_id': self.target_id,
            'scan_id': self.scan_id,
            'name': self.name,
            'severity': self.severity,
            'description': self.description,
            'cve_id': self.cve_id,
            'cvss_score': self.cvss_score,
            'port': self.port,
            'service': self.service,
            'remediation': self.remediation,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50))  # pdf, html, json, xml
    content = db.Column(db.Text)
    file_path = db.Column(db.String(500))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    project = db.relationship('Project', backref='reports')
    user = db.relationship('User', backref='reports')
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'type': self.type,
            'file_path': self.file_path,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


def init_db(app):
    """Initialize database and create tables"""
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        
        if User.query.count() == 0:
            admin = User(username='admin', email='admin@cybersec.local', role='admin')
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("✅ Created admin user (admin/admin123)")
        
        if Tool.query.count() == 0:
            # Import comprehensive Kali tools
            try:
                from seed_tools import KALI_TOOLS
                for tool_data in KALI_TOOLS:
                    db.session.add(Tool(**tool_data))
                db.session.commit()
                print(f"✅ Seeded {len(KALI_TOOLS)} Kali Linux tools")
            except ImportError:
                print("⚠️  seed_tools.py not found, using default tools")
                default_tools = [
                    {'name': 'Nmap', 'category': 'Information Gathering', 'description': 'Network exploration', 'command': 'nmap', 'installed': True, 'difficulty': 'beginner'},
                    {'name': 'Metasploit', 'category': 'Exploitation Tools', 'description': 'Penetration testing framework', 'command': 'msfconsole', 'installed': True, 'difficulty': 'advanced'},
                ]
                for t in default_tools:
                    db.session.add(Tool(**t))
                db.session.commit()
                print(f"✅ Seeded {len(default_tools)} default tools")
