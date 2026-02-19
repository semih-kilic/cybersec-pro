#!/usr/bin/env python3
from app import app, db, User
from flask_jwt_extended import create_access_token
import requests

with app.app_context():
    user = User.query.filter_by(email='semihkilic@semihkilic.com').first()
    if user:
        print(f"User found: {user.email}")
        with app.test_request_context():
            token = create_access_token(identity=str(user.id))
            print(f"Token created")
            
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            data = {'tool_id': 'nmap', 'target': '10.0.0.115'}
            
            resp = requests.post('http://localhost:5001/api/v2/scan/execute', json=data, headers=headers)
            print(f'Status: {resp.status_code}')
            print(f'Response: {resp.text[:500]}')
    else:
        print("User not found")
