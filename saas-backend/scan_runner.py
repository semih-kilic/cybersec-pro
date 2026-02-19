#!/usr/bin/env python3
"""
🛡️ CyberSec Pro — Scan Runner v7  (Execution Engine)
Secure, subprocess-based execution of security tools with real-time streaming.

Features:
  - Automatic command construction from tool_configs registry
  - Binary validation via shutil.which before launch
  - Real-time stdout/stderr capture  (line-by-line generator)
  - Timeout enforcement
  - Result collection + parser integration

Author : Semih Kılıç
Version: 7.0.0
"""

from __future__ import annotations

import os
import shlex
import shutil
import signal
import subprocess
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, Generator, List, Optional, Tuple

from tool_configs import (
    TOOL_REGISTRY,
    ToolConfig,
    ScanProfile,
    get_or_generic,
    get_tools_for_plan,
)

# ─────────────────────────────────────────────
# Exceptions
# ─────────────────────────────────────────────

class ToolNotFoundError(Exception):
    """Raised when the requested tool slug is not in the registry."""

class BinaryMissingError(Exception):
    """Raised when the binary is not installed on the server."""

class TargetRequiredError(Exception):
    """Raised when target is missing but needed."""

class PlanAccessDeniedError(Exception):
    """User's plan does not include this tool."""

class ScanTimeoutError(Exception):
    """Scan exceeded maximum allowed time."""


# ─────────────────────────────────────────────
# Data class for results
# ─────────────────────────────────────────────

class ScanRunResult:
    """Holds everything about a completed (or failed) scan run."""

    def __init__(self, scan_id: str, tool_slug: str, target: str, profile: str):
        self.scan_id = scan_id
        self.tool_slug = tool_slug
        self.target = target
        self.profile = profile
        self.command: List[str] = []
        self.command_str: str = ''
        self.stdout: str = ''
        self.stderr: str = ''
        self.exit_code: Optional[int] = None
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None
        self.duration: float = 0.0
        self.timed_out: bool = False
        self.error: Optional[str] = None
        self.binary_path: Optional[str] = None
        self.parsed: Optional[Dict[str, Any]] = None     # filled by parsers

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out and self.error is None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'scan_id': self.scan_id,
            'tool': self.tool_slug,
            'target': self.target,
            'profile': self.profile,
            'command': self.command_str,
            'exit_code': self.exit_code,
            'stdout_length': len(self.stdout),
            'stderr_length': len(self.stderr),
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'duration': round(self.duration, 2),
            'timed_out': self.timed_out,
            'success': self.success,
            'error': self.error,
            'binary_path': self.binary_path,
            'parsed': self.parsed,
        }


# ─────────────────────────────────────────────
# Command Builder
# ─────────────────────────────────────────────

def validate_binary(binary: str) -> str:
    """Verify the binary exists on the system. Returns resolved path."""
    path = shutil.which(binary)
    if not path:
        raise BinaryMissingError(
            f"Binary '{binary}' is not installed on this server. "
            f"Install it with: apt install {binary}"
        )
    return path


def build_command(
    tool: ToolConfig,
    target: str,
    profile_name: Optional[str] = None,
    extra_args: Optional[List[str]] = None,
) -> Tuple[List[str], ScanProfile]:
    """
    Build the full CLI command list from tool config + profile + target.

    Returns (command_list, resolved_profile).
    """
    # Resolve profile
    if profile_name and profile_name in tool.profiles:
        profile = tool.profiles[profile_name]
    else:
        profile = tool.default_profile
    if profile is None:
        raise ValueError(f"No profiles defined for tool '{tool.slug}'")

    # Start with binary
    cmd: List[str] = [tool.binary]

    # Profile args (some profiles put the mode first, e.g. gobuster 'dir')
    cmd.extend(profile.args)

    # Extra user args (sanitized)
    if extra_args:
        for arg in extra_args:
            if arg and not arg.startswith(';') and '&&' not in arg and '|' not in arg:
                cmd.append(arg)

    # Append target according to target_mode
    if tool.needs_target and target:
        mode = tool.target_mode
        if mode == 'append' or mode == 'positional':
            cmd.append(target)
        elif mode == 'none':
            # Tools like ffuf/wfuzz: target is embedded in profile or extra_args
            # For ffuf, check if -u is already set
            if tool.slug == 'ffuf' and '-u' not in cmd:
                cmd.extend(['-u', target.rstrip('/') + '/FUZZ'])
            elif tool.slug == 'wfuzz' and target not in ' '.join(cmd):
                cmd.append(target.rstrip('/') + '/FUZZ')
        else:
            # mode is a flag like '-h', '-u', '--url', '-d', etc.
            cmd.extend([mode, target])
    elif tool.needs_target and not target:
        raise TargetRequiredError(f"Tool '{tool.slug}' requires a target")

    return cmd, profile


# ─────────────────────────────────────────────
# Execution Engine
# ─────────────────────────────────────────────

def execute_scan(
    tool_slug: str,
    target: str,
    profile_name: Optional[str] = None,
    extra_args: Optional[List[str]] = None,
    user_plan: str = 'enterprise',
    scan_id: Optional[str] = None,
    on_output: Optional[Callable[[str], None]] = None,
    timeout_override: Optional[int] = None,
) -> ScanRunResult:
    """
    Execute a security tool synchronously.

    Args:
        tool_slug:    Registry key (e.g. 'nmap')
        target:       IP, URL, or file path
        profile_name: Named profile or None for default
        extra_args:   Additional CLI flags
        user_plan:    Subscription plan (for access check)
        scan_id:      Existing scan ID or auto-generated
        on_output:    Callback fired for every line of stdout/stderr
        timeout_override: Override profile timeout (seconds)

    Returns:
        ScanRunResult with stdout, stderr, exit_code, etc.
    """
    if not scan_id:
        scan_id = str(uuid.uuid4())

    result = ScanRunResult(scan_id, tool_slug, target, profile_name or 'default')

    # 1. Resolve tool from registry
    tool = TOOL_REGISTRY.get(tool_slug)
    if not tool:
        tool = get_or_generic(tool_slug)
        if tool.slug == '__generic__':
            # Check if the binary actually exists
            tool.binary = tool_slug

    # 2. Plan access check
    allowed = get_tools_for_plan(user_plan)
    if tool.slug in TOOL_REGISTRY and tool.slug not in allowed:
        result.error = f"Tool '{tool_slug}' requires '{tool.plan}' plan (you have '{user_plan}')"
        return result

    # 3. Binary validation
    try:
        binary_path = validate_binary(tool.binary)
        result.binary_path = binary_path
    except BinaryMissingError as e:
        result.error = str(e)
        return result

    # 4. Build command
    try:
        cmd, profile = build_command(tool, target, profile_name, extra_args)
    except (TargetRequiredError, ValueError) as e:
        result.error = str(e)
        return result

    result.command = cmd
    result.command_str = ' '.join(shlex.quote(c) for c in cmd)
    result.profile = profile.name

    timeout = timeout_override or profile.timeout
    result.started_at = datetime.utcnow()

    # 5. Execute
    stdout_lines: List[str] = []
    stderr_lines: List[str] = []

    try:
        env = os.environ.copy()
        env['TERM'] = 'dumb'  # suppress colour codes from some tools

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            preexec_fn=os.setsid if os.name != 'nt' else None,
        )

        # Threaded stderr reader so it doesn't block
        def _read_stderr():
            for line in proc.stderr:
                stderr_lines.append(line)

        t = threading.Thread(target=_read_stderr, daemon=True)
        t.start()

        # Read stdout line by line for real-time streaming
        deadline = time.monotonic() + timeout
        for line in proc.stdout:
            stdout_lines.append(line)
            if on_output:
                try:
                    on_output(line.rstrip('\n'))
                except Exception:
                    pass
            if time.monotonic() > deadline:
                # Kill process group
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    proc.kill()
                result.timed_out = True
                break

        proc.wait(timeout=10)
        t.join(timeout=5)

        result.exit_code = proc.returncode

    except subprocess.TimeoutExpired:
        result.timed_out = True
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            proc.kill()
        proc.wait()
        result.exit_code = proc.returncode

    except FileNotFoundError:
        result.error = f"Binary not found at execution time: {cmd[0]}"

    except PermissionError:
        result.error = f"Permission denied executing {cmd[0]} (may need sudo)"

    except Exception as e:
        result.error = f"Execution error: {type(e).__name__}: {str(e)}"

    result.finished_at = datetime.utcnow()
    result.duration = (result.finished_at - result.started_at).total_seconds()

    result.stdout = ''.join(stdout_lines)
    result.stderr = ''.join(stderr_lines)

    # 6. Auto-parse output
    try:
        from parsers import auto_parse
        result.parsed = auto_parse(tool_slug, result.stdout, result.stderr, tool.output_format)
    except ImportError:
        pass  # parsers module not available yet
    except Exception as e:
        # Don't fail the scan just because parsing failed
        result.parsed = {'parse_error': str(e)}

    return result


def execute_scan_async(
    tool_slug: str,
    target: str,
    profile_name: Optional[str] = None,
    extra_args: Optional[List[str]] = None,
    user_plan: str = 'enterprise',
    scan_id: Optional[str] = None,
    on_output: Optional[Callable[[str], None]] = None,
    on_complete: Optional[Callable[[ScanRunResult], None]] = None,
    timeout_override: Optional[int] = None,
) -> str:
    """
    Fire-and-forget scan execution in a background thread.
    Returns scan_id immediately.
    """
    if not scan_id:
        scan_id = str(uuid.uuid4())

    def _run():
        result = execute_scan(
            tool_slug=tool_slug,
            target=target,
            profile_name=profile_name,
            extra_args=extra_args,
            user_plan=user_plan,
            scan_id=scan_id,
            on_output=on_output,
            timeout_override=timeout_override,
        )
        if on_complete:
            on_complete(result)

    thread = threading.Thread(target=_run, daemon=True, name=f'scan-{scan_id[:8]}')
    thread.start()
    return scan_id


# ─────────────────────────────────────────────
# Quick CLI test
# ─────────────────────────────────────────────

if __name__ == '__main__':
    import sys

    slug = sys.argv[1] if len(sys.argv) > 1 else 'nmap'
    target = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
    profile = sys.argv[3] if len(sys.argv) > 3 else 'quick'

    print(f"▶ Running {slug} against {target} (profile={profile})")

    def printer(line: str):
        print(f"  │ {line}")

    r = execute_scan(slug, target, profile_name=profile, on_output=printer)
    print(f"\n{'✅' if r.success else '❌'} Exit={r.exit_code}  Duration={r.duration:.1f}s  "
          f"Timeout={r.timed_out}  Stdout={len(r.stdout)} bytes")
    if r.error:
        print(f"  Error: {r.error}")
    if r.parsed:
        import json
        print(f"  Parsed: {json.dumps(r.parsed, indent=2)[:500]}")
