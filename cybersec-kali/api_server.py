# CyberSec Kali Tools API Server
# Minimal FastAPI-based API for tool execution behind nginx reverse proxy.

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import subprocess
import sys
import urllib.parse

API_SECRET = os.environ.get("API_SECRET", "")
TOOLS_DIR = "/opt/tools"


class ToolAPIHandler(BaseHTTPRequestHandler):
    """Lightweight API handler — no heavy framework needed."""

    def _check_auth(self):
        """Validate API secret from Authorization header."""
        auth = self.headers.get("Authorization", "")
        expected = f"Bearer {API_SECRET}"
        if not API_SECRET or auth != expected:
            self.send_json(401, {"error": "unauthorized"})
            return False
        return True

    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "https://cyber-sec-pro.com")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/health":
            self.send_json(200, {"status": "healthy", "service": "kali-tools"})
            return

        if path == "/api/tools":
            if not self._check_auth():
                return
            tools = []
            if os.path.isdir(TOOLS_DIR):
                for name in sorted(os.listdir(TOOLS_DIR)):
                    p = os.path.join(TOOLS_DIR, name)
                    if os.path.isfile(p):
                        tools.append({"name": name, "size": os.path.getsize(p)})
            self.send_json(200, {"tools": tools})
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/execute":
            if not self._check_auth():
                return
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
            tool_name = body.get("tool", "")
            args = body.get("args", [])
            timeout = min(int(body.get("timeout", 60)), 300)

            tool_path = os.path.join(TOOLS_DIR, tool_name)
            if not os.path.isfile(tool_path):
                self.send_json(404, {"error": f"tool not found: {tool_name}"})
                return

            try:
                result = subprocess.run(
                    [tool_path] + [str(a) for a in args],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd="/tmp",
                )
                self.send_json(200, {
                    "stdout": result.stdout[-50000:],
                    "stderr": result.stderr[-50000:],
                    "exit_code": result.returncode,
                })
            except subprocess.TimeoutExpired:
                self.send_json(408, {"error": "timeout"})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
            return

        self.send_json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "https://cyber-sec-pro.com")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        """Suppress default stderr logging."""
        pass


def main():
    port = int(os.environ.get("PORT", "5003"))
    server = HTTPServer(("0.0.0.0", port), ToolAPIHandler)
    print(f"Kali API server listening on :{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()