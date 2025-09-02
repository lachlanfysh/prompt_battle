#!/bin/bash

# Prompt Battle Complete Setup Script
# This script sets up dependencies and starts your prompt battle app with OpenAI DALL-E

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

# Check for OpenAI API Key
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Optional: DALL-E model settings
# DALLE_MODEL=dall-e-3
# DALLE_SIZE=1024x1024
# DALLE_QUALITY=standard
EOF
fi

if ! grep -q "^OPENAI_API_KEY=sk-" .env 2>/dev/null; then
    echo "⚠️  OpenAI API key not configured!"
    echo "📝 Please edit .env file and add your API key:"
    echo "   OPENAI_API_KEY=sk-your-actual-key-here"
    echo ""
    echo "🔑 Get your API key at: https://platform.openai.com/api-keys"
    echo "💡 The app will use placeholder images without a valid API key."
    echo ""
    API_CONFIGURED=false
else
    echo "✅ OpenAI API key found in .env"
    API_CONFIGURED=true
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

# Check OpenAI API connection if configured
if [ "$API_CONFIGURED" = true ]; then
    echo ""
    echo "🤖 Testing OpenAI API connection..."
    # We'll test this when the server starts
    echo "✅ API key configured - will test connection when server starts"
else
    echo "⚠️  OpenAI API not configured. Using placeholder images."
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

if [ "$API_CONFIGURED" = true ]; then
    echo "🎯 OpenAI DALL-E Status:"
    echo "   🎨 Model: DALL-E 3 (1024x1024)"
    echo "   💰 Cost: ~$0.040 per image"
    echo "   📊 Usage: https://platform.openai.com/usage"
    echo ""
fi

echo "🎮 Ready to play! Open the admin panel to start your first battle!"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    echo "Stopping Prompt Battle server..."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the game server
node server.js