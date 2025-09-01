#!/bin/bash

# Prompt Battle Complete Setup Script
# This script installs Stable Diffusion and starts your prompt battle app

set -e  # Exit on any error

echo "🎨 Prompt Battle Complete Setup 🎨"
echo "=================================="

# Get local IP for network access
get_local_ip() {
    if command -v ipconfig &> /dev/null; then
        # macOS
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
    elif command -v hostname &> /dev/null; then
        # Linux
        hostname -I | awk '{print $1}'
    else
        echo "localhost"
    fi
}

LOCAL_IP=$(get_local_ip)

echo "🌐 Local Network IP: $LOCAL_IP"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the prompt_battle directory"
    exit 1
fi

# Check for Stable Diffusion installation
SD_DIR="$HOME/stable-diffusion-webui"
SD_LAUNCH_SCRIPT="$SD_DIR/launch_api.sh"

if [ ! -f "$SD_LAUNCH_SCRIPT" ]; then
    echo "🤖 Stable Diffusion not found. Installing automatically..."
    echo "⏳ This will download ~4GB and may take 10-15 minutes..."
    echo ""
    read -p "Continue with Stable Diffusion installation? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./install-stable-diffusion.sh
    else
        echo "⚠️  Skipping Stable Diffusion. App will use placeholder images."
        SD_AVAILABLE=false
    fi
else
    echo "✅ Stable Diffusion found at: $SD_DIR"
    SD_AVAILABLE=true
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

cd client
if [ ! -d "node_modules" ]; then
    echo "📦 Installing client dependencies..."
    npm install
fi

# Build the client
echo "🔨 Building client..."
npm run build
cd ..

# Function to check if a service is running on a port
check_port() {
    nc -z localhost $1 > /dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_wait=60
    local wait_time=0
    
    echo "⏳ Waiting for $service to start on port $port..."
    while ! check_port $port && [ $wait_time -lt $max_wait ]; do
        sleep 2
        wait_time=$((wait_time + 2))
        echo -n "."
    done
    echo ""
    
    if check_port $port; then
        echo "✅ $service is ready on port $port"
        return 0
    else
        echo "⚠️  $service didn't start within $max_wait seconds"
        return 1
    fi
}

# Start Stable Diffusion if available
if [ "$SD_AVAILABLE" = true ]; then
    echo ""
    echo "🤖 Starting Stable Diffusion WebUI..."
    echo "📍 Location: $SD_DIR"
    echo "🌐 Will be available at: http://localhost:7860"
    echo ""
    
    # Kill any existing SD process
    if check_port 7860; then
        echo "🔄 Port 7860 is busy. Attempting to free it..."
        pkill -f "python.*launch.py" || true
        sleep 3
    fi
    
    # Start SD in background
    cd "$SD_DIR"
    nohup ./launch_api.sh > sd_output.log 2>&1 &
    SD_PID=$!
    echo "🚀 Stable Diffusion started with PID: $SD_PID"
    cd - > /dev/null
    
    # Wait for SD to be ready
    if wait_for_service 7860 "Stable Diffusion"; then
        echo "🎨 Stable Diffusion API ready!"
    else
        echo "⚠️  Stable Diffusion may still be starting. Check logs: tail -f $SD_DIR/sd_output.log"
    fi
else
    echo "⚠️  Stable Diffusion not available. Using placeholder images."
fi

echo ""
echo "🚀 Starting Prompt Battle Server..."
echo ""
echo "📱 Access URLs:"
echo "   Local: http://localhost:3001"
echo "   Network: http://$LOCAL_IP:3001"
echo ""
echo "📋 Game URLs to share:"
echo "   🎮 Admin Panel: http://$LOCAL_IP:3001/admin"
echo "   👤 Player 1: http://$LOCAL_IP:3001/player/1"
echo "   👤 Player 2: http://$LOCAL_IP:3001/player/2"
echo "   📺 Central Display: http://$LOCAL_IP:3001/display"
echo ""
echo "📶 For hotspot use:"
echo "   1. Turn on your phone's hotspot"
echo "   2. Connect your Mac to the hotspot"
echo "   3. Share this IP ($LOCAL_IP) with players"
echo "   4. Players connect to the same hotspot and visit the URLs above"
echo ""

if [ "$SD_AVAILABLE" = true ]; then
    echo "🎯 Stable Diffusion Status:"
    echo "   🌐 WebUI: http://localhost:7860"
    echo "   📊 API Docs: http://localhost:7860/docs"
    echo "   📝 Logs: tail -f $SD_DIR/sd_output.log"
    echo ""
fi

echo "🎮 Ready to play! Open the admin panel to start your first battle!"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    if [ ! -z "$SD_PID" ]; then
        echo "Stopping Stable Diffusion (PID: $SD_PID)..."
        kill $SD_PID 2>/dev/null || true
    fi
    pkill -f "python.*launch.py" 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the game server
node server.js