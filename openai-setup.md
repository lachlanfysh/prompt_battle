# OpenAI API Setup Guide

This application supports both direct OpenAI API and Azure OpenAI Service. Choose the option that best fits your needs.

## Option 1: Direct OpenAI API (Default)

### Getting Started with DALL-E 3

### 1. Create an OpenAI Account
1. Visit [https://platform.openai.com](https://platform.openai.com)
2. Sign up or log in to your account
3. Verify your account if required

### 2. Get Your API Key
1. Navigate to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Give it a name (e.g., "Prompt Battle App")
4. Copy the generated key (starts with `sk-`)
5. **Keep this key secure** - treat it like a password

### 3. Add Credits to Your Account
1. Go to [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
2. Add a payment method
3. Purchase credits or set up auto-recharge
4. **Note**: DALL-E 3 costs approximately $0.040 per image (1024x1024)

### 4. Configure the Application
1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Open your `.env` file and configure for OpenAI:
   ```env
   OPENAI_PROVIDER=openai
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
3. Save the file

### 5. Test Your Setup
1. Start the application: `./start.sh`
2. Open the admin panel and set a target prompt
3. Test image generation to ensure everything works

## Option 2: Azure OpenAI Service

Azure OpenAI provides enterprise-grade security, compliance, and regional availability. It's ideal for production deployments.

### 1. Create Azure OpenAI Resource
1. Sign in to [Azure Portal](https://portal.azure.com)
2. Create a new **Azure OpenAI** resource
3. Select your subscription, resource group, and region
4. Choose your pricing tier
5. Wait for deployment to complete

### 2. Deploy Required Models
1. Go to your Azure OpenAI resource
2. Navigate to **Model deployments** or **Azure OpenAI Studio**
3. Deploy these models:
   - **DALL-E 3**: For image generation
   - **GPT-4o**: For image analysis and judging
4. Note the deployment names (you'll need these)

### 3. Get Your Credentials
1. In your Azure OpenAI resource, go to **Keys and Endpoint**
2. Copy **Key 1** and **Endpoint**
3. Note your deployment names from step 2

### 4. Configure the Application
1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Open your `.env` file and configure for Azure:
   ```env
   OPENAI_PROVIDER=azure
   AZURE_OPENAI_API_KEY=your_azure_key_here
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_DALLE=dall-e-3
   AZURE_OPENAI_DEPLOYMENT_GPT=gpt-4o
   ```
3. Save the file

### 5. Test Your Setup
1. Start the application: `./start.sh`
2. Check the console for "🔄 Initializing Azure OpenAI client"
3. Test image generation to ensure everything works

## Choosing Between OpenAI and Azure

| Feature | Direct OpenAI | Azure OpenAI |
|---------|---------------|--------------|
| **Setup Complexity** | Simple | Moderate |
| **Security & Compliance** | Standard | Enterprise-grade |
| **Regional Data Residency** | US-based | Regional options |
| **Pricing** | Pay-per-use | Committed use discounts available |
| **SLA** | Standard | 99.9% uptime SLA |
| **Integration** | Direct API | Azure ecosystem integration |
| **Best For** | Development, small teams | Production, enterprises |

## Usage Tips

### Cost Management
- **DALL-E 3**: ~$0.040 per image (standard quality)
- **DALL-E 3 HD**: ~$0.080 per image (high quality)
- **DALL-E 2**: ~$0.020 per image (1024x1024)

For a typical game session with 10 rounds and 2 players:
- 20 images × $0.040 = ~$0.80 per session

### Rate Limits
- **DALL-E 3**: 5 images per minute (Tier 1 users)
- **DALL-E 2**: 50 images per minute (Tier 1 users)
- Higher tiers get increased limits

### Best Practices
1. **Start with small sessions** to test costs
2. **Monitor usage** at [https://platform.openai.com/usage](https://platform.openai.com/usage)
3. **Set billing alerts** to avoid unexpected charges
4. **Use fallback mode** for testing (no API calls)

## Model Comparison

| Feature | DALL-E 3 | DALL-E 2 |
|---------|----------|----------|
| Quality | Highest | Good |
| Cost | $0.040/img | $0.020/img |
| Speed | ~10-20s | ~10-15s |
| Prompt adherence | Excellent | Good |
| Available sizes | 1024×1024, 1792×1024, 1024×1792 | 256×256, 512×512, 1024×1024 |

## Troubleshooting

### Common Issues
1. **"Invalid API key"**: Double-check your key in the `.env` file
2. **"Insufficient quota"**: Add credits to your account
3. **"Rate limit exceeded"**: Wait a minute between generations
4. **Slow generation**: This is normal for DALL-E, typically 10-20 seconds

### Error Messages
- **401 Unauthorized**: Check API key
- **429 Rate Limited**: Slow down requests
- **402 Payment Required**: Add credits to account
- **500 Server Error**: OpenAI service issue, try again later

### Support Resources
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Community Forum](https://community.openai.com)
- [Status Page](https://status.openai.com)