#!/usr/bin/env python3
import subprocess, json, uuid, re, time, hmac, hashlib, base64

def psql(sql):
    out = subprocess.run(["bash","/home/cybersec/cybersec-pro/rust-backend/.dbq.sh", sql], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode==0 else ("ERR:"+out.stderr.strip()[:400])

ORG="a7c9c30f-9bac-4101-b043-bf511f956356"

# 1) test users
users=[]
for i in range(1,9):
    uid=str(uuid.uuid4()); email=f"zt-user-{i}@test.local"
    psql(f"INSERT INTO users (id,email,password_hash,role,organization_id,is_active,email_verified,email_normalized) VALUES ('{uid}','{email}','','admin','{ORG}',TRUE,TRUE,'{email}') ON CONFLICT (email) DO NOTHING;")
    users.append(uid)
print("users ensured:", len(users))

# 2) dry-run reverse-tunnel agent (offline => job queued, never executed)
agent_id=str(uuid.uuid4())
psql(f"INSERT INTO agents (id,name,connection_type,status,organization_id) VALUES ('{agent_id}','dryrun-harness','reverse_tunnel','offline','{ORG}') ON CONFLICT (id) DO NOTHING;")
print("dryrun agent:", agent_id)

# 3) mint JWTs
secret_line=[l for l in open("/home/cybersec/cybersec-pro/rust-backend/.env") if l.startswith("JWT_SECRET_KEY=")]
secret=secret_line[0].strip().split("=",1)[1] if secret_line else ""
def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(user_id):
    now=int(time.time())
    hdr=b64u(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    pay=b64u(json.dumps({"sub":user_id,"org":ORG,"role":"admin","exp":now+7200,"iat":now,"token_type":"access","fresh":True},separators=(",",":")).encode())
    sig=b64u(hmac.new(secret.encode(),f"{hdr}.{pay}".encode(),hashlib.sha256).digest())
    return f"{hdr}.{pay}.{sig}"
tokens={u:jwt(u) for u in users}
json.dump({"users":users,"agent_id":agent_id,"tokens":tokens}, open("/home/cybersec/cybersec-pro/zero-code-test/harness.json","w"), indent=1)
print("tokens minted:", len(tokens))
print("sample token:", list(tokens.values())[0][:50]+"...")
