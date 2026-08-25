#!/usr/bin/env python3
"""
CyberSec Pro — Local Service Manager Panel
Binds to the VPN interface only (10.0.0.241:8080). Proxies authenticated
requests to the backend API (127.0.0.1:5001). Stdlib only.
"""
import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API = "http://127.0.0.1:5001"
HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>CyberSec Pro — Service Manager (Local)</title>
<style>
*{box-sizing:border-box;margin:0}
body{font-family:system-ui;background:#0a0a0c;color:#e5e7eb;padding:24px}
h1{font-size:22px;margin-bottom:4px}
.sub{color:#6b7280;font-size:13px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
.card{background:#111114;border:1px solid #23232a;border-radius:12px;padding:14px}
.card b{font-size:20px;display:block;margin-top:4px}
.card span{color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{padding:10px;border-bottom:1px solid #23232a;text-align:left;font-size:13px}
.pill{padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700}
.ok{background:rgba(16,185,129,.15);color:#34d399}.bad{background:rgba(239,68,68,.15);color:#f87171}
.warn{background:rgba(245,158,11,.15);color:#fbbf24}
button{background:#0891b2;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;margin-left:6px}
button.red{background:#dc2626}button:hover{filter:brightness(1.2)}
input{background:#16161b;border:1px solid #2a2a32;color:#e5e7eb;border-radius:8px;padding:10px;width:100%;margin:6px 0}
.login{max-width:360px;margin:80px auto;background:#111114;border:1px solid #23232a;border-radius:14px;padding:28px}
.btn{width:100%;padding:11px;margin-top:10px;font-size:14px}
#app{display:none}
</style></head><body>
<div id="login" class="login">
<h1>🔐 Service Manager</h1><p class="sub">Local access only — 10.0.0.241</p>
<input id="em" type="email" placeholder="Superadmin email"><input id="pw" type="password" placeholder="Password">
<button class="btn" onclick="login()">Sign in</button><p id="err" style="color:#f87171;font-size:12px"></p>
</div>
<div id="app">
<h1>🖥️ Service Manager <span style="font-size:12px;color:#6b7280">local · 10.0.0.241:8080</span></h1>
<p class="sub">Auto-refresh 5s · <span id="clock"></span></p>
<div class="grid" id="kpis"></div>
<h3 style="margin:18px 0 4px">Services</h3>
<table id="services"><tr><th>Service</th><th>Status</th><th>Actions</th></tr></table>
<h3 style="margin:18px 0 4px">Alerts</h3>
<table id="alerts"><tr><th>Severity</th><th>Message</th><th>Action</th></tr></table>
</div>
<script>
const T = () => localStorage.getItem('sm_token');
async function login(){
  const r = await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:em.value,password:pw.value})});
  const d = await r.json();
  if(d.token){localStorage.setItem('sm_token',d.token);boot();}else{err.textContent=d.error||'Login failed';}
}
async function api(p,method='GET'){
  const r = await fetch('/api'+p,{method,headers:{Authorization:'Bearer '+T()}});
  if(r.status===401){localStorage.removeItem('sm_token');location.reload();throw 0;}
  return r.json();
}
function act(id,action){
  if(action!=='status' && !confirm(action.toUpperCase()+' — are you sure?'))return;
  api('/v1/admin/services/'+id+'/action','POST',{action}).then(load);
}
async function load(){
  try{
    const d = await api('/v1/admin/service-manager/dashboard');
    const k = document.getElementById('kpis');
    const sys = d.system||{};
    k.innerHTML = `
      <div class="card"><span>CPU</span><b>${(sys.cpu_percent??0).toFixed(0)}%</b></div>
      <div class="card"><span>RAM</span><b>${(sys.memory_percent??0).toFixed(0)}%</b></div>
      <div class="card"><span>Disk</span><b>${(sys.disk_percent??0).toFixed(0)}%</b></div>
      <div class="card"><span>Services healthy</span><b>${(d.services_healthy??0)}/${(d.services_total??0)}</b></div>`;
    const st = s => s==='running'?'<span class="pill ok">running</span>':s==='stopped'?'<span class="pill bad">stopped</span>':`<span class="pill warn">${s||'?'}</span>`;
    document.querySelector('#services').innerHTML = '<tr><th>Service</th><th>Status</th><th>Actions</th></tr>' +
      (d.services||[]).map(s=>`<tr><td><b>${s.name}</b><br><span style="color:#6b7280;font-size:11px">${s.description||''}</span></td>
        <td>${st(s.status)}</td>
        <td>${['start','restart','stop'].map(a=>`<button onclick="act('${s.id}','${a}')">${a}</button>`).join('')}</td></tr>`).join('');
    const al = d.alerts||[];
    document.querySelector('#alerts').innerHTML = '<tr><th>Severity</th><th>Message</th><th>Action</th></tr>' +
      (al.length?al.map(a=>`<tr><td><span class="pill ${a.severity==='critical'?'bad':'warn'}">${a.severity}</span></td>
        <td>${a.message||''}</td>
        <td>${a.acknowledged?'<span style="color:#6b7280;font-size:11px">ack</span>':`<button onclick="ack('${a.id}')">ack</button>`}</td></tr>`).join('')
        :'<tr><td colspan="3" style="color:#6b7280">No alerts</td></tr>');
    document.getElementById('clock').textContent = new Date().toLocaleTimeString();
  }catch(e){console.log(e)}
}
function ack(id){ api('/v1/admin/alerts/'+id+'/acknowledge','POST',{acknowledged:true}).then(load); }
function boot(){
  if(!T())return;
  document.getElementById('login').style.display='none';
  document.getElementById('app').style.display='block';
  load(); setInterval(load,5000); setInterval(()=>document.getElementById('clock').textContent=new Date().toLocaleTimeString(),1000);
}
if(T())boot();
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200); self._cors()
            self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
            self.wfile.write(HTML.encode()); return
        if self.path.startswith("/api/"):
            self.proxy("GET", self.path[4:]); return
        self.send_response(404); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(n) if n else None
        if self.path == "/login":
            self.proxy("POST", "/api/v1/auth/login", body, forward_auth=False); return
        if self.path.startswith("/api/"):
            self.proxy("POST", self.path[4:], body); return
        self.send_response(404); self.end_headers()

    def proxy(self, method, path, body=None, forward_auth=True):
        url = API + path
        req = urllib.request.Request(url, method=method)
        if forward_auth:
            auth = self.headers.get("Authorization", "")
            req.add_header("Authorization", auth)
        data = None
        if body:
            req.add_header("Content-Type", "application/json")
            data = body
        try:
            with urllib.request.urlopen(req, data, timeout=30) as r:
                payload = r.read()
                self.send_response(r.status); self._cors()
                self.send_header("Content-Type", "application/json"); self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            self.send_response(e.code); self._cors()
            self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            self.send_response(502); self._cors()
            self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, *a): pass

if __name__ == "__main__":
    print("Service Manager panel on http://10.0.0.241:8080")
    ThreadingHTTPServer(("10.0.0.241", 8080), H).serve_forever()
