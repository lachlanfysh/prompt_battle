# Local Stable Diffusion Setup for Mac

## Option 1: Automatic1111 WebUI (Recommended)

### Installation Steps:

1. **Install Prerequisites:**
   ```bash
   # Install Homebrew if not already installed
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install Python 3.10
   brew install python@3.10
   
   # Install Git
   brew install git
   ```

2. **Clone and Setup Automatic1111:**
   ```bash
   cd ~/Desktop
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
   cd stable-diffusion-webui
   
   # Run the setup script
   ./webui.sh --api --listen --port 7860
   ```

3. **Download a Model (required):**
   - Download a model file (.safetensors or .ckpt) from:
     - Hugging Face: https://huggingface.co/models?pipeline_tag=text-to-image
     - Civitai: https://civitai.com/
   - Recommended starter model: Stable Diffusion 1.5 or 2.1
   - Place the model file in: `stable-diffusion-webui/models/Stable-diffusion/`

### Integration with Your App:

The server.js file needs to be updated to call the local Stable Diffusion API:

```javascript
// Replace the generateImage function in server.js with:
async function generateImage(prompt) {
  try {
    const response = await axios.post('http://localhost:7860/sdapi/v1/txt2img', {
      prompt: prompt,
      negative_prompt: "blurry, low quality, distorted",
      steps: 20,
      width: 1024,
      height: 1024,
      cfg_scale: 7,
      sampler_name: "Euler a"
    });
    
    // The response contains base64 encoded image
    const imageBase64 = response.data.images[0];
    
    return {
      url: `data:image/png;base64,${imageBase64}`,
      prompt: prompt
    };
  } catch (error) {
    console.error('Local SD generation failed:', error);
    // Fallback to placeholder
    return {
      url: `https://via.placeholder.com/1024x1024.png?text=${encodeURIComponent(prompt.substring(0, 50))}`,
      prompt: prompt
    };
  }
}
```

## Option 2: Draw Things (Mac App Store - Easier)

1. Install "Draw Things" from Mac App Store
2. Enable API access in settings
3. Use HTTP API endpoint (similar to above but different port)

## Option 3: Diffusion Bee (Free Mac App)

1. Download from: https://diffusionbee.com/
2. Install and run
3. No API access but you could use AppleScript automation

## Starting Both Services:

Create a start script:

```bash
#!/bin/bash
echo "Starting Stable Diffusion WebUI..."
cd ~/Desktop/stable-diffusion-webui
./webui.sh --api --listen --port 7860 &

sleep 5

echo "Starting Prompt Battle Server..."
cd ~/Desktop/prompt_battle
npm start
```

The Automatic1111 setup will give you the most flexibility and best API integration for your prompt battle app.