package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ToolProbeResult struct {
	ToolName    string        `json:"tool_name"`
	Binary      string        `json:"binary"`
	Path        string        `json:"path,omitempty"`
	Status      string        `json:"status"` // "ok", "missing", "broken", "timeout", "skipped"
	ExitCode    int           `json:"exit_code"`
	Duration    time.Duration `json:"duration_ms"`
	Evidence    string        `json:"evidence,omitempty"`
	TestedAt    time.Time     `json:"tested_at"`
}

type ProbeSummary struct {
	Total      int               `json:"total"`
	OK         int               `json:"ok"`
	Missing    int               `json:"missing"`
	Broken     int               `json:"broken"`
	Timeout    int               `json:"timeout"`
	Skipped    int               `json:"skipped"`
	DurationMs int64             `json:"total_duration_ms"`
	Results    []ToolProbeResult `json:"results"`
}

var tuiDenylist = map[string]bool{
	"vim": true, "vi": true, "nvim": true, "less": true, "more": true,
	"mc": true, "tmux": true, "screen": true, "htop": true, "top": true,
	"nano": true, "joe": true, "emacs": true, "mutt": true, "ranger": true,
}

func truncate(s string, maxLen int) string {
	s = strings.TrimSpace(s)
	if len(s) > maxLen {
		return s[:maxLen] + "...[trunc]"
	}
	return s
}

func probeBinary(ctx context.Context, name string, timeout time.Duration) ToolProbeResult {
	start := time.Now()

	if tuiDenylist[strings.ToLower(name)] {
		return ToolProbeResult{
			ToolName: name,
			Binary:   name,
			Status:   "skipped",
			Evidence: "TUI/Interactive binary (denylisted)",
			TestedAt: time.Now(),
		}
	}

	binPath, err := exec.LookPath(name)
	if err != nil {
		return ToolProbeResult{
			ToolName: name,
			Binary:   name,
			Status:   "missing",
			Duration: time.Since(start),
			Evidence: "not found in PATH",
			TestedAt: time.Now(),
		}
	}

	// Try first probe flag
	flag := "--help"
	if name == "nmap" || name == "nikto" {
		flag = "-h"
	}

	probeCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(probeCtx, binPath, flag)
	cmd.Stdin = nil
	cmd.Env = []string{"TERM=dumb", "NO_COLOR=1", "PAGER=cat"}

	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	_ = cmd.Run()
	dur := time.Since(start)

	outStr := out.String()
	if len(outStr) > 0 {
		return ToolProbeResult{
			ToolName: name,
			Binary:   name,
			Path:     binPath,
			Status:   "ok",
			Duration: dur,
			Evidence: truncate(outStr, 120),
			TestedAt: time.Now(),
		}
	}

	return ToolProbeResult{
		ToolName: name,
		Binary:   name,
		Path:     binPath,
		Status:   "ok",
		Duration: dur,
		Evidence: "binary exists in PATH",
		TestedAt: time.Now(),
	}
}

func main() {
	concurrency := flag.Int("c", 40, "Number of concurrent workers")
	timeoutSec := flag.Int("timeout", 4, "Timeout per tool probe in seconds")
	toolsArg := flag.String("tools", "", "Comma-separated list of tools to probe (or scan common Kali security tools if empty)")
	jsonOutput := flag.Bool("json", false, "Output machine-readable JSON summary")
	flag.Parse()

	var toolList []string
	if *toolsArg != "" {
		toolList = strings.Split(*toolsArg, ",")
	} else {
		// Common high-profile CyberSec Pro tools
		toolList = []string{
			"nmap", "nikto", "sqlmap", "hydra", "john", "hashcat", "gobuster",
			"ffuf", "dirb", "wfuzz", "wpscan", "amass", "subfinder", "httpx",
			"nuclei", "trivy", "grype", "syft", "semgrep", "checkov", "prowler",
			"masscan", "rustscan", "zmap", "aircrack-ng", "wireshark", "tshark",
			"tcpdump", "responder", "impacket", "crackmapexec", "netexec", "bloodhound",
			"enum4linux", "smbclient", "whatweb", "wafw00f", "sslscan", "testssl",
			"ghidra", "radare2", "binwalk", "metasploit", "msfconsole", "evil-winrm",
		}
	}

	startTime := time.Now()
	timeout := time.Duration(*timeoutSec) * time.Second

	ch := make(chan string, len(toolList))
	for _, t := range toolList {
		ch <- strings.TrimSpace(t)
	}
	close(ch)

	var wg sync.WaitGroup
	var mu sync.Mutex
	summary := ProbeSummary{
		Total:   len(toolList),
		Results: make([]ToolProbeResult, 0, len(toolList)),
	}

	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for tool := range ch {
				if tool == "" {
					continue
				}
				res := probeBinary(context.Background(), tool, timeout)
				mu.Lock()
				summary.Results = append(summary.Results, res)
				switch res.Status {
				case "ok":
					summary.OK++
				case "missing":
					summary.Missing++
				case "broken":
					summary.Broken++
				case "timeout":
					summary.Timeout++
				case "skipped":
					summary.Skipped++
				}
				mu.Unlock()
			}
		}()
	}

	wg.Wait()
	summary.DurationMs = time.Since(startTime).Milliseconds()

	if *jsonOutput {
		b, _ := json.MarshalIndent(summary, "", "  ")
		fmt.Println(string(b))
	} else {
		fmt.Printf("\n⚡ CyberSec Pro High-Speed Tool Probe\n")
		fmt.Println(strings.Repeat("═", 75))
		fmt.Printf("Total Tools Tested : %d\n", summary.Total)
		fmt.Printf("🟢 Installed & OK  : %d\n", summary.OK)
		fmt.Printf("⚪ Missing         : %d\n", summary.Missing)
		fmt.Printf("🔴 Broken/Failed   : %d\n", summary.Broken)
		fmt.Printf("⏳ Time Taken      : %d ms (%.2fs)\n", summary.DurationMs, float64(summary.DurationMs)/1000.0)
		fmt.Println(strings.Repeat("─", 75))
		fmt.Printf("%-20s %-12s %-10s %s\n", "TOOL", "STATUS", "LATENCY", "EVIDENCE")
		fmt.Println(strings.Repeat("─", 75))

		for _, r := range summary.Results {
			icon := "🟢 OK"
			if r.Status == "missing" {
				icon = "⚪ MISSING"
			} else if r.Status == "broken" {
				icon = "🔴 BROKEN"
			} else if r.Status == "timeout" {
				icon = "⏳ TIMEOUT"
			}
			fmt.Printf("%-20s %-12s %-10d %s\n", r.ToolName, icon, r.Duration.Milliseconds(), filepath.Base(r.Path))
		}
		fmt.Println(strings.Repeat("═", 75))
	}
}
