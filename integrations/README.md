# CyberSec Pro CI/CD Integration Templates

This directory contains ready-to-use CI/CD pipeline configurations for integrating CyberSec Pro security scanning into your development workflow.

## Setup

### 1. Configure Secrets

Add these secrets to your CI/CD platform:

| Secret | Description |
|--------|-------------|
| `CYBERSEC_API_URL` | Your CyberSec Pro API endpoint (e.g., `https://cybersec.example.com`) |
| `CYBERSEC_API_KEY` | Your API key for authentication |

### 2. Choose Your Platform

#### GitHub Actions

1. Copy `.github/workflows/cybersec-scan.yml` to your repository
2. Create a `.github/workflows/` directory if it doesn't exist
3. Add the secrets in your repository settings under Settings → Secrets and variables → Actions

**Features:**
- Triggers on push to `main` and pull requests
- Posts scan results as PR comments
- Fails build on critical vulnerabilities

#### GitLab CI

1. Copy `.gitlab-ci.yml` to your repository root
2. Add the variables in your project settings under Settings → CI/CD → Variables

**Features:**
- Runs on merge requests and `main` branch
- Uses Docker-in-Docker for execution

#### Bitbucket Pipelines

1. Copy `bitbucket-pipelines.yml` to your repository root
2. Add the variables in your repository settings under Repository settings → Repository variables

**Features:**
- Runs on `main` branch and pull requests
- Parallel execution support

## How It Works

1. **Scan Initiation**: The pipeline calls the CyberSec Pro API to start a security scan
2. **Wait for Completion**: Polls the API until the scan finishes (up to 30 minutes)
3. **Results Processing**: Fetches and parses the scan results
4. **Gate Enforcement**: Fails the pipeline if critical vulnerabilities are found

## Customization

### Scan Types

Modify the `scan_type` parameter in the API call:

- `full` - Complete security scan (default)
- `quick` - Fast scan for common vulnerabilities
- `custom` - Custom scan configuration

### Threshold Configuration

Adjust the failure criteria in the pipeline:

```yaml
# Example: Fail only on critical findings
if [ "$CRITICAL" -gt 0 ]; then
  exit 1
fi

# Example: Fail on critical or high findings
if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  exit 1
fi
```

### Notification Integration

Add notification steps after the scan:

```yaml
# Slack notification example
- name: Notify Slack
  run: |
    curl -X POST $SLACK_WEBHOOK_URL \
      -d "{\"text\": \"Security scan completed. Critical: $CRITICAL, High: $HIGH\"}"
```

## Troubleshooting

### Scan Timeout

If scans take longer than 30 minutes, increase the loop limit:

```bash
for i in $(seq 1 120); do  # Increase from 60 to 120
```

### API Connection Issues

Verify your `CYBERSEC_API_URL` is accessible:

```bash
curl -s "$CYBERSEC_API_URL/health" | jq .
```

### Authentication Errors

Ensure your API key has the required permissions:
- `scan:create` - To start scans
- `scan:read` - To fetch results
