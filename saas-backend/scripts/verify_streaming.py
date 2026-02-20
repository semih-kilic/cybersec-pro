#!/usr/bin/env python3
"""
V11: Streaming Verification Script
Tests that scan_runner.py delivers real-time output via PTY.

Prints numbered lines every 0.5s for 10 seconds — if the on_output
callback fires within 1s of each print, streaming works correctly.

Usage:
    python3 scripts/verify_streaming.py
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scan_runner import execute_scan, ScanPhase

# ── Create a tiny script that prints 1 line per 0.5s ──
TEST_SCRIPT = '/tmp/_cybersec_stream_test.sh'
with open(TEST_SCRIPT, 'w') as f:
    f.write('#!/bin/bash\nfor i in $(seq 1 20); do echo "LINE_${i}_$(date +%s%N)"; sleep 0.5; done\n')
os.chmod(TEST_SCRIPT, 0o755)


def main():
    received_lines: list[tuple[float, str]] = []
    phases_seen: list[tuple[float, str, str, int]] = []

    def on_output(line: str):
        received_lines.append((time.time(), line))

    def on_phase(phase: str, desc: str, progress: int):
        phases_seen.append((time.time(), phase, desc, progress))

    print("── V11 Streaming Test ──")
    print(f"Running test script that prints 20 lines (one every 0.5s)...")
    print()

    t0 = time.time()

    # Use a dummy tool entry that runs our test script
    # We'll call execute_scan with a tool that maps to our script
    from tool_configs import ToolConfig, ScanProfile, TOOL_REGISTRY

    test_tool = ToolConfig(
        slug='_stream_test',
        name='StreamTest',
        binary=TEST_SCRIPT,
        category='Test',
        description='Streaming test',
        plan='starter',
        target_mode='none',
        output_format='text',
        version_flag='--help',
        profiles={
            'default': ScanProfile(
                name='default',
                description='Test',
                args=[],
                timeout=30,
            ),
        },
    )
    TOOL_REGISTRY['_stream_test'] = test_tool

    result = execute_scan(
        tool_slug='_stream_test',
        target='test',
        on_output=on_output,
        on_phase=on_phase,
    )

    elapsed = time.time() - t0
    print(f"\n── Results ──")
    print(f"Total time    : {elapsed:.1f}s")
    print(f"Lines received: {len(received_lines)}")
    print(f"Phases seen   : {len(phases_seen)}")
    print(f"Exit code     : {result.exit_code}")
    print(f"Success       : {result.success}")
    print()

    # Verify real-time delivery
    if len(received_lines) < 2:
        print("❌ FAIL: Too few lines received")
        return False

    # Check inter-line timing — should be ~0.5s between consecutive lines
    delays = []
    for i in range(1, len(received_lines)):
        d = received_lines[i][0] - received_lines[i - 1][0]
        delays.append(d)

    avg_delay = sum(delays) / len(delays) if delays else 0
    max_delay = max(delays) if delays else 0

    print(f"Average delay between lines: {avg_delay:.3f}s (expected ~0.5s)")
    print(f"Max delay between lines    : {max_delay:.3f}s")
    print()

    # Verify phases
    print("Phases observed:")
    for t, phase, desc, prog in phases_seen:
        print(f"  [{t - t0:6.2f}s] {phase:20s} {prog:3d}% | {desc}")

    # Check that all expected phases appeared
    expected = {'INITIALIZING', 'RESOLVING_TARGET', 'PREPARING_TOOL', 'EXECUTING',
                'PARSING_OUTPUT', 'SAVING_RESULTS', 'COMPLETED'}
    seen = {p[1] for p in phases_seen}
    missing = expected - seen
    if missing:
        print(f"\n⚠️  Missing phases: {missing}")
    else:
        print(f"\n✅ All {len(expected)} phases observed")

    # Streaming quality check
    streaming_ok = avg_delay < 1.5 and max_delay < 3.0 and len(received_lines) >= 18
    if streaming_ok:
        print("✅ STREAMING: Real-time output delivery verified")
    else:
        print("❌ STREAMING: Output appears buffered or delayed")
        if avg_delay >= 1.5:
            print(f"   Average delay {avg_delay:.2f}s is too high (expected < 1.5s)")
        if max_delay >= 3.0:
            print(f"   Max delay {max_delay:.2f}s is too high (expected < 3.0s)")
        if len(received_lines) < 18:
            print(f"   Only {len(received_lines)} lines received (expected >= 18)")

    all_ok = streaming_ok and not missing
    print(f"\n{'✅ ALL CHECKS PASSED' if all_ok else '❌ SOME CHECKS FAILED'}")

    # Cleanup
    del TOOL_REGISTRY['_stream_test']
    try:
        os.unlink(TEST_SCRIPT)
    except OSError:
        pass

    return all_ok


if __name__ == '__main__':
    ok = main()
    sys.exit(0 if ok else 1)
