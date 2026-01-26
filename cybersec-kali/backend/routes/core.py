from flask import Blueprint, jsonify
from datetime import datetime
from models import Tool, User, Scan

core_bp = Blueprint('core', __name__)


@core_bp.route('/api/health', methods=['GET'])
def health():
    try:
        return jsonify({
            'status': 'healthy',
            'version': '2.0.0',
            'database': 'connected',
            'tools_count': Tool.query.count(),
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500


@core_bp.route('/api/status', methods=['GET'])
def status():
    try:
        return jsonify({
            'status': 'operational',
            'version': '2.0.0',
            'database': {
                'connected': True,
                'users': User.query.count(),
                'tools': Tool.query.count(),
                'scans': Scan.query.count()
            },
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
