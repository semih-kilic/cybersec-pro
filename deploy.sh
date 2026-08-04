#!/bin/bash
# 🛡️ CyberSec Pro - Production Deployment Script
# FAZ 4: Automated deployment with health checks
#
# Author: Semih Kılıç
# Version: 1.0.0
#
# Usage:
#   ./deploy.sh              # Full deployment
#   ./deploy.sh --build      # Build only
#   ./deploy.sh --start      # Start services only
#   ./deploy.sh --stop       # Stop services
#   ./deploy.sh --logs       # Show logs
#   ./deploy.sh --status     # Show status

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================${NC}"
}

check_requirements() {
    print_header "🔍 Checking Requirements"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker installed: $(docker --version | cut -d' ' -f3)"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
    log_success "Docker Compose installed"
    
    # Check .env file
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        log_warning ".env file not found, copying from .env.example"
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            log_warning "Please edit .env file with your production values!"
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi
    log_success ".env file present"
}

# ============================================
# Build Functions
# ============================================

build_frontend() {
    print_header "🔨 Building Frontend"
    
    cd "$PROJECT_DIR/saas-frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing npm dependencies..."
        npm ci
    fi
    
    # Build
    log_info "Building React application..."
    npm run build
    
    log_success "Frontend build complete"
    cd "$PROJECT_DIR"
}

build_docker() {
    print_header "🐳 Building Docker Images"
    
    log_info "Building all services..."
    docker compose build --no-cache
    
    log_success "Docker images built"
}

# ============================================
# Deployment Functions
# ============================================

start_services() {
    print_header "🚀 Starting Services"
    
    log_info "Starting Docker containers..."
    docker compose up -d
    
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Check health
    check_health
}

stop_services() {
    print_header "🛑 Stopping Services"
    
    log_info "Stopping Docker containers..."
    docker compose down
    
    log_success "All services stopped"
}

restart_services() {
    stop_services
    start_services
}

# ============================================
# Health Check Functions
# ============================================

check_health() {
    print_header "❤️ Health Check"
    
    local healthy=true
    
    # Check backend
    log_info "Checking backend health..."
    if curl -sf http://localhost:5001/health > /dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_warning "Backend health check failed (may still be starting)"
        healthy=false
    fi
    
    # Check scan engine
    log_info "Checking scan engine..."
    if curl -sf http://localhost:5002/health > /dev/null 2>&1; then
        log_success "Scan engine is healthy"
    else
        log_warning "Scan engine health check failed (may still be starting)"
        healthy=false
    fi
    
    # Check nginx
    log_info "Checking nginx..."
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        log_success "Nginx is healthy"
    else
        log_warning "Nginx health check failed (may still be starting)"
        healthy=false
    fi
    
    if [ "$healthy" = true ]; then
        log_success "All services are healthy! 🎉"
    else
        log_warning "Some services may still be starting. Check logs with: ./deploy.sh --logs"
    fi
}

show_status() {
    print_header "📊 Service Status"
    
    docker compose ps
    
    echo ""
    log_info "Service URLs:"
    echo "  - Frontend:  http://localhost:3000"
    echo "  - Backend:   http://localhost:5001"
    echo "  - Nginx:     http://localhost (proxy)"
    echo "  - Health:    http://localhost:5001/api/health"
}

show_logs() {
    print_header "📜 Service Logs"
    
    docker compose logs -f --tail=100
}

# ============================================
# Cleanup Functions
# ============================================

cleanup() {
    print_header "🧹 Cleanup"
    
    log_info "Removing stopped containers..."
    docker compose down --remove-orphans
    
    log_info "Pruning unused images..."
    docker image prune -f
    
    log_success "Cleanup complete"
}

# ============================================
# Full Deployment
# ============================================

full_deploy() {
    print_header "🛡️ CyberSec Pro - Full Deployment"
    echo "Started at: $(date)"
    
    check_requirements
    build_frontend
    build_docker
    start_services
    show_status
    
    print_header "🎉 Deployment Complete!"
    echo ""
    echo "Access CyberSec Pro at: http://localhost"
    echo ""
    echo "Useful commands:"
    echo "  ./deploy.sh --status  - Show service status"
    echo "  ./deploy.sh --logs    - Show logs"
    echo "  ./deploy.sh --stop    - Stop all services"
    echo ""
}

# ============================================
# Run Integration Tests
# ============================================

run_tests() {
    print_header "🧪 Running Integration Tests"
    
    cd "$PROJECT_DIR"
    python3 test_integration.py
    
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_success "All tests passed!"
    else
        log_error "Some tests failed"
        exit $exit_code
    fi
}

# ============================================
# Main
# ============================================

case "${1:-}" in
    --build)
        check_requirements
        build_frontend
        build_docker
        ;;
    --start)
        start_services
        ;;
    --stop)
        stop_services
        ;;
    --restart)
        restart_services
        ;;
    --status)
        show_status
        ;;
    --logs)
        show_logs
        ;;
    --health)
        check_health
        ;;
    --cleanup)
        cleanup
        ;;
    --test)
        run_tests
        ;;
    --help)
        echo "🛡️ CyberSec Pro - Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [option]"
        echo ""
        echo "Options:"
        echo "  (none)      Full deployment (build + start)"
        echo "  --build     Build frontend and Docker images"
        echo "  --start     Start all services"
        echo "  --stop      Stop all services"
        echo "  --restart   Restart all services"
        echo "  --status    Show service status"
        echo "  --logs      Show service logs"
        echo "  --health    Run health checks"
        echo "  --cleanup   Remove stopped containers and prune images"
        echo "  --test      Run integration tests"
        echo "  --help      Show this help"
        ;;
    *)
        full_deploy
        ;;
esac
