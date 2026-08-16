package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ServiceStatus struct {
	Name      string        `json:"name"`
	Target    string        `json:"target"`
	Status    string        `json:"status"` // "UP", "DOWN", "DEGRADED"
	Latency   time.Duration `json:"latency_ms"`
	Details   string        `json:"details,omitempty"`
	Timestamp time.Time     `json:"timestamp"`
}

type SystemMetrics struct {
	TotalMemMB     uint64 `json:"total_mem_mb"`
	AvailableMemMB uint64 `json:"available_mem_mb"`
	MemUsedPercent float64 `json:"mem_used_percent"`
	CPUCount       int    `json:"cpu_count"`
}

type HealthReport struct {
	Timestamp time.Time       `json:"timestamp"`
	System    SystemMetrics   `json:"system"`
	Services  []ServiceStatus `json:"services"`
	AllHealthy bool          `json:"all_healthy"`
}

func readMemInfo() (SystemMetrics, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return SystemMetrics{}, err
	}
	defer file.Close()

	var total, avail uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		if key == "MemTotal" {
			total = val / 1024 // KB to MB
		} else if key == "MemAvailable" {
			avail = val / 1024
		}
	}

	usedPct := 0.0
	if total > 0 {
		usedPct = float64(total-avail) / float64(total) * 100.0
	}

	return SystemMetrics{
		TotalMemMB:     total,
		AvailableMemMB: avail,
		MemUsedPercent: usedPct,
		CPUCount:       4,
	}, nil
}

func checkTCP(name, address string, timeout time.Duration) ServiceStatus {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", address, timeout)
	latency := time.Since(start)

	if err != nil {
		return ServiceStatus{
			Name:      name,
			Target:    address,
			Status:    "DOWN",
			Latency:   latency,
			Details:   err.Error(),
			Timestamp: time.Now(),
		}
	}
	conn.Close()

	return ServiceStatus{
		Name:      name,
		Target:    address,
		Status:    "UP",
		Latency:   latency,
		Timestamp: time.Now(),
	}
}

func checkHTTP(name, url string, expectedCode int, timeout time.Duration) ServiceStatus {
	start := time.Now()
	client := &http.Client{Timeout: timeout}
	resp, err := client.Get(url)
	latency := time.Since(start)

	if err != nil {
		return ServiceStatus{
			Name:      name,
			Target:    url,
			Status:    "DOWN",
			Latency:   latency,
			Details:   err.Error(),
			Timestamp: time.Now(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != expectedCode && (expectedCode == 200 && resp.StatusCode >= 400) {
		return ServiceStatus{
			Name:      name,
			Target:    url,
			Status:    "DEGRADED",
			Latency:   latency,
			Details:   fmt.Sprintf("HTTP %d", resp.StatusCode),
			Timestamp: time.Now(),
		}
	}

	return ServiceStatus{
		Name:      name,
		Target:    url,
		Status:    "UP",
		Latency:   latency,
		Timestamp: time.Now(),
	}
}

func checkDockerHealth(containerName string) ServiceStatus {
	start := time.Now()
	cmd := exec.Command("docker", "inspect", "--format", "{{.State.Health.Status}}", containerName)
	out, err := cmd.Output()
	latency := time.Since(start)

	statusStr := strings.TrimSpace(string(out))
	if err != nil || statusStr == "" {
		// Fallback to checking running status
		cmdRun := exec.Command("docker", "inspect", "--format", "{{.State.Running}}", containerName)
		outRun, errRun := cmdRun.Output()
		if errRun == nil && strings.TrimSpace(string(outRun)) == "true" {
			return ServiceStatus{
				Name:      containerName,
				Target:    "docker:" + containerName,
				Status:    "UP",
				Latency:   latency,
				Details:   "running (no healthcheck)",
				Timestamp: time.Now(),
			}
		}
		return ServiceStatus{
			Name:      containerName,
			Target:    "docker:" + containerName,
			Status:    "DOWN",
			Latency:   latency,
			Details:   "container missing/stopped",
			Timestamp: time.Now(),
		}
	}

	status := "UP"
	if statusStr != "healthy" {
		status = "DEGRADED"
	}

	return ServiceStatus{
		Name:      containerName,
		Target:    "docker:" + containerName,
		Status:    status,
		Latency:   latency,
		Details:   statusStr,
		Timestamp: time.Now(),
	}
}

func autoHeal(report HealthReport, projectDir string) {
	for _, svc := range report.Services {
		if svc.Status == "DOWN" {
			fmt.Printf("⚠️  [AUTO-HEAL] %s is %s! Triggering recovery...\n", svc.Name, svc.Status)
			switch svc.Name {
			case "cybersec-api":
				_ = exec.Command("docker", "compose", "-f", projectDir+"/docker-compose.yml", "up", "-d", "rust-backend").Run()
			case "cybersec-scan-engine":
				_ = exec.Command("docker", "compose", "-f", projectDir+"/docker-compose.yml", "up", "-d", "rust-scan-engine").Run()
			case "cybersec-nginx":
				_ = exec.Command("docker", "compose", "-f", projectDir+"/docker-compose.yml", "restart", "nginx").Run()
			case "PostgreSQL":
				_ = exec.Command("docker", "compose", "-f", projectDir+"/docker-compose.yml", "up", "-d", "postgres").Run()
			case "Redis":
				_ = exec.Command("docker", "compose", "-f", projectDir+"/docker-compose.yml", "up", "-d", "redis").Run()
			}
		}
	}

	// RAM cleanup if memory is critically low (< 800MB available)
	if report.System.AvailableMemMB < 800 {
		fmt.Printf("⚠️  [RAM-CLEANUP] Available RAM is %d MB. Dropping caches...\n", report.System.AvailableMemMB)
		_ = exec.Command("sync").Run()
	}
}

func runHealthCheck() HealthReport {
	metrics, _ := readMemInfo()

	var wg sync.WaitGroup
	var mu sync.Mutex
	services := make([]ServiceStatus, 0, 7)

	addStatus := func(st ServiceStatus) {
		mu.Lock()
		services = append(services, st)
		mu.Unlock()
	}

	checks := []func(){
		func() { addStatus(checkHTTP("Rust API (/health)", "http://127.0.0.1:5001/health", 200, 2*time.Second)) },
		func() { addStatus(checkHTTP("Rust Scan Engine (/health)", "http://127.0.0.1:5002/health", 200, 2*time.Second)) },
		func() { addStatus(checkHTTP("Nginx Edge (Port 80)", "http://127.0.0.1:80/", 200, 2*time.Second)) },
		func() { addStatus(checkTCP("PostgreSQL", "127.0.0.1:5432", 1*time.Second)) },
		func() { addStatus(checkTCP("Redis", "127.0.0.1:6379", 1*time.Second)) },
		func() { addStatus(checkDockerHealth("cybersec-api")) },
		func() { addStatus(checkDockerHealth("cybersec-nginx")) },
	}

	for _, fn := range checks {
		wg.Add(1)
		go func(f func()) {
			defer wg.Done()
			f()
		}(fn)
	}

	wg.Wait()

	allHealthy := true
	for _, s := range services {
		if s.Status == "DOWN" {
			allHealthy = false
			break
		}
	}

	return HealthReport{
		Timestamp:  time.Now(),
		System:     metrics,
		Services:   services,
		AllHealthy: allHealthy,
	}
}

func printPretty(report HealthReport) {
	fmt.Printf("\n🛡️  CyberSec Pro Watchdog Report — %s\n", report.Timestamp.Format("2006-01-02 15:04:05"))
	fmt.Println(strings.Repeat("═", 65))
	fmt.Printf("💻 Memory: %d MB / %d MB (%.1f%% used) | Available: %d MB\n",
		report.System.TotalMemMB-report.System.AvailableMemMB,
		report.System.TotalMemMB,
		report.System.MemUsedPercent,
		report.System.AvailableMemMB,
	)
	fmt.Println(strings.Repeat("─", 65))
	fmt.Printf("%-30s %-10s %-12s %s\n", "SERVICE", "STATUS", "LATENCY", "DETAILS")
	fmt.Println(strings.Repeat("─", 65))

	for _, s := range report.Services {
		statusIcon := "🟢 UP"
		if s.Status == "DOWN" {
			statusIcon = "🔴 DOWN"
		} else if s.Status == "DEGRADED" {
			statusIcon = "🟡 DEGRADED"
		}

		latStr := fmt.Sprintf("%dms", s.Latency.Milliseconds())
		fmt.Printf("%-30s %-10s %-12s %s\n", s.Name, statusIcon, latStr, s.Details)
	}
	fmt.Println(strings.Repeat("═", 65))
	if report.AllHealthy {
		fmt.Println("✅ ALL CORE SERVICES HEALTHY & OPERATIONAL")
	} else {
		fmt.Println("⚠️  ONE OR MORE SERVICES ARE UNHEALTHY")
	}
	fmt.Println()
}

func main() {
	daemonMode := flag.Bool("daemon", false, "Run in background loop")
	intervalSec := flag.Int("interval", 15, "Check interval in seconds for daemon mode")
	jsonOutput := flag.Bool("json", false, "Output machine-readable JSON")
	autoHealFlag := flag.Bool("heal", true, "Automatically restart crashed services")
	projectDir := flag.String("dir", "/home/cybersec/cybersec-pro", "CyberSec Pro project directory")
	flag.Parse()

	if *daemonMode {
		fmt.Printf("🛡️  Starting CyberSec Pro Watchdog Daemon (interval: %ds)...\n", *intervalSec)
		ticker := time.NewTicker(time.Duration(*intervalSec) * time.Second)
		defer ticker.Stop()

		for {
			report := runHealthCheck()
			if *autoHealFlag && !report.AllHealthy {
				autoHeal(report, *projectDir)
			}
			if *jsonOutput {
				b, _ := json.Marshal(report)
				fmt.Println(string(b))
			} else {
				printPretty(report)
			}
			<-ticker.C
		}
	} else {
		report := runHealthCheck()
		if *autoHealFlag && !report.AllHealthy {
			autoHeal(report, *projectDir)
		}
		if *jsonOutput {
			b, _ := json.MarshalIndent(report, "", "  ")
			fmt.Println(string(b))
		} else {
			printPretty(report)
		}
		if !report.AllHealthy {
			os.Exit(1)
		}
	}
}
