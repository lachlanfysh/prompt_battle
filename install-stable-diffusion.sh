#!/bin/bash

# Automatic1111 Stable Diffusion WebUI Installer for macOS
# This script automatically installs and configures Stable Diffusion for the Prompt Battle app

set -e  # Exit on any error

echo "🎨 Installing Stable Diffusion WebUI..."
echo "======================================"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS. Please install manually on other systems."
    exit 1
fi

# Check for required tools
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed."
        return 1
    fi
}

echo "🔍 Checking prerequisites..."

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

# Install required packages
echo "📦 Installing prerequisites..."
brew install python@3.10 git wget

# Ensure we're using the right Python
export PATH="/opt/homebrew/bin:$PATH"
PYTHON_PATH="/opt/homebrew/bin/python3.10"

echo "🐍 Using Python: $PYTHON_PATH"
$PYTHON_PATH --version

# Set up Stable Diffusion directory
SD_DIR="$HOME/stable-diffusion-webui"

if [ -d "$SD_DIR" ]; then
    echo "📁 Stable Diffusion directory already exists. Updating..."
    cd "$SD_DIR"
    git pull
else
    echo "📁 Cloning Stable Diffusion WebUI..."
    git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git "$SD_DIR"
    cd "$SD_DIR"
fi

# Create virtual environment
echo "🔧 Setting up Python environment..."
$PYTHON_PATH -m venv venv
source venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install torch torchvision torchaudio

# Download a default model (Stable Diffusion 1.5)
MODEL_DIR="$SD_DIR/models/Stable-diffusion"
MODEL_FILE="$MODEL_DIR/v1-5-pruned-emaonly.safetensors"

mkdir -p "$MODEL_DIR"

if [ ! -f "$MODEL_FILE" ]; then
    echo "📥 Downloading Stable Diffusion 1.5 model (4GB)..."
    echo "This may take several minutes depending on your connection..."
    
    # Download from Hugging Face
    wget -O "$MODEL_FILE" "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"
    
    if [ $? -eq 0 ]; then
        echo "✅ Model downloaded successfully!"
    else
        echo "❌ Model download failed. You can download it manually later."
    fi
else
    echo "✅ Model already exists: $MODEL_FILE"
fi

# Create launch script
cat > "$SD_DIR/launch_api.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate

echo "🚀 Starting Stable Diffusion WebUI with API..."
echo "This will be available at http://localhost:7860"
echo "API endpoint: http://localhost:7860/docs"

python launch.py --api --listen --port 7860 --skip-torch-cuda-test --no-half --precision full
EOF

chmod +x "$SD_DIR/launch_api.sh"

# Create config file for better performance on Mac
mkdir -p "$SD_DIR/configs"
cat > "$SD_DIR/config.json" << 'EOF'
{
    "samples_filename_pattern": "",
    "save_images_add_number": true,
    "grid_save": true,
    "grid_format": "png",
    "grid_extended_filename": false,
    "grid_only_if_multiple": true,
    "grid_prevent_empty_spots": false,
    "n_rows": -1,
    "enable_pnginfo": true,
    "save_txt": false,
    "save_images_before_face_restoration": false,
    "save_images_before_highres_fix": false,
    "save_images_before_color_correction": false,
    "jpeg_quality": 80,
    "webp_lossless": false,
    "export_for_4chan": true,
    "img_downscale_threshold": 4.0,
    "target_side_length": 4000,
    "img_max_size_mp": 200,
    "use_original_name_batch": true,
    "use_upscaler_name_as_suffix": false,
    "save_selected_only": true,
    "do_not_add_watermark": false,
    "temp_dir": "",
    "clean_temp_dir_at_start": false,
    "outdir_samples": "",
    "outdir_txt2img_samples": "outputs/txt2img-images",
    "outdir_img2img_samples": "outputs/img2img-images",
    "outdir_extras_samples": "outputs/extras-images",
    "outdir_grids": "outputs/txt2img-grids",
    "outdir_txt2img_grids": "outputs/txt2img-grids",
    "outdir_save": "log/images"
}
EOF

echo ""
echo "✅ Stable Diffusion WebUI installed successfully!"
echo ""
echo "📍 Installation location: $SD_DIR"
echo "🚀 Launch command: $SD_DIR/launch_api.sh"
echo ""
echo "🎯 Next steps:"
echo "   1. The installation is complete"
echo "   2. Run ./start.sh from your prompt_battle directory"
echo "   3. This will automatically start both Stable Diffusion and your game server"
echo ""
echo "💡 Manual start (if needed): cd $SD_DIR && ./launch_api.sh"
echo ""