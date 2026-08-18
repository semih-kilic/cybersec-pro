# CyberSec Pro CLI (`csec`)

A command-line interface for interacting with the CyberSec Pro platform. Browse, search, and export 1,510+ security tools directly from your terminal.

## Installation

```bash
cargo install cybersec-cli
```

Or download a pre-built binary from [Releases](https://github.com/semih-kilic/cybersec-pro/releases).

## Usage

### List all tools
```bash
csec list
csec list --category recon
csec list --format json
csec list --format csv --output tools.csv
```

### Search tools
```bash
csec search "subdomain"
csec search "nmap" --format table
csec search "web vulnerability" --category web
```

### Check tool health
```bash
csec health
csec health --verbose
```

### View statistics
```bash
csec stats
```

### Export tool catalog
```bash
csec export --format json --output catalog.json
csec export --format csv --output catalog.csv
csec export --format yaml --output catalog.yaml
```

## Configuration

Set the API URL via environment variable:

```bash
export CYBERSEC_API_URL=https://api.cyber-sec-pro.com
csec list
```

Or use the `--api-url` flag:

```bash
csec --api-url http://localhost:5001 list
```

## Output Formats

| Format | Flag | Description |
|--------|------|-------------|
| Table | `--format table` | Colored terminal table (default) |
| JSON | `--format json` | Machine-readable JSON |
| CSV | `--format csv` | Spreadsheet-compatible |
| YAML | `--format yaml` | Configuration-friendly |

## Examples

```bash
# Export all recon tools to JSON
csec list --category recon --format json > recon.json

# Count tools per category
csec stats

# Search and export
csec search "wifi" --format csv > wifi-tools.csv
```

## Requirements

- Rust 1.70+ (for `cargo install`)
- Network access to CyberSec Pro API

## License

MIT License — see [LICENSE](LICENSE)

## Contributing

Contributions welcome! See [CONTRIBUTING.md](https://github.com/semih-kilic/cybersec-pro/blob/master/CONTRIBUTING.md).

---

Built by [CyberSec Pro](https://cyber-sec-pro.com) — 1,510 Kali Linux tools in the cloud.
