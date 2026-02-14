# AI Podcast Generator - Deployment Guide

## Table of Contents

1. [Local Deployment Guide](#1-local-deployment-guide)
   - [1.1 System Requirements](#11-system-requirements)
   - [1.2 Run Locally](#12-run-locally)
   - [1.3 Build for Production](#13-build-for-production)
2. [Remote Deployment Guide](#2-remote-deployment-guide)
   - [2.1 Platform Analysis and Recommendations](#21-platform-analysis-and-recommendations)
   - [2.2 Detailed Deployment Steps per Platform](#22-detailed-deployment-steps-per-platform)
3. [Troubleshooting](#3-troubleshooting)
4. [Security Considerations](#4-security-considerations)

---

## 1. Local Deployment Guide

### 1.1 System Requirements

#### Operating System Requirements

| OS | Minimum Version | Notes |
|----|-----------------|-------|
| **macOS** | 11.0 (Big Sur) | Apple Silicon (M1/M2) or Intel |
| **Windows** | 10/11 | Latest version recommended |
| **Linux** | Ubuntu 20.04+ / Debian 11+ | Recommended for production |

#### Software Dependencies

| Software | Minimum Version | Required For | Installation Command |
|----------|-----------------|--------------|---------------------|
| **Node.js** | 18.0+ | Frontend runtime | [Download Node.js](https://nodejs.org/) |
| **npm** | 9.0+ | Frontend dependencies | Included with Node.js |
| **Modern Browser** | Chrome 90+, Firefox 88+, Safari 15+ | Running the app | Built-in with OS |

> **Note**: This is now a browser-only application. All processing happens in the browser, so no backend services or Docker containers are required.

---

### 1.2 Run Locally

This is now a browser-only application. All processing happens directly in your browser.

#### Step 1: Install Node.js

**macOS:**
```bash
# Using Homebrew
brew install node@18

# Or download from https://nodejs.org/
```

**Windows:**
```bash
# Using winget
winget install OpenJS.NodeJS.LTS

# Or download from https://nodejs.org/
```

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 2: Clone the Repository

```bash
git clone <repository-url>
cd ai-podcast-generator
```

#### Step 3: Install Dependencies

```bash
cd frontend
npm install
```

#### Step 4: Run Development Server

```bash
# Start development server with hot reload
npm run dev

# Server runs at http://localhost:5173
```

#### Step 5: Access the Application

Open your browser and navigate to http://localhost:5173

No additional services or Docker containers are required. The application will prompt you for API keys when needed.

---

### 1.3 Build for Production

#### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

#### Step 2: Build for Production

```bash
# Build for production
npm run build

# Output in ./dist directory
```

#### Step 3: Deploy Static Files

The built files in the `dist` directory can be deployed to any static hosting service:

- **Vercel**: Connect your GitHub repository and deploy
- **Netlify**: Drag and drop the dist folder or connect Git
- **GitHub Pages**: Copy files to gh-pages branch
- **Any web server**: Serve the dist directory as static files

#### Step 4: Environment Variables for Deployment

For deployment, you can optionally set these environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_PERPLEXITY_API_KEY` | Perplexity API key (recommended for best research) |
| `VITE_OPENAI_API_KEY` | OpenAI API key (for OpenAI TTS) |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for Gemini models) |

Note: Users can also enter their own API keys directly in the application interface.

---



## 2. Remote Deployment Guide

### 2.1 Platform Analysis and Recommendations

This is now a browser-only application that can be deployed to any static hosting service. Here's an analysis of suitable deployment platforms:

#### Platform Comparison

| Platform | Pros | Cons | Best For |
|----------|------|------|----------|
| **Vercel** | Easy deployment, automatic SSL, great DX | May have bandwidth limits on free tier | Small teams, quick deployment |
| **Netlify** | Simple setup, built-in forms, split testing | Less flexible than Vercel | Marketing sites, simple apps |
| **GitHub Pages** | Free, integrated with GitHub | No custom server logic, limited build process | Open source projects, personal sites |
| **AWS S3 + CloudFront** | Highly scalable, reliable | More complex setup | Enterprise, high traffic |
| **Google Cloud Storage** | Integrated with Google ecosystem | Pricing can be complex | Google Cloud users |
| **Azure Static Web Apps** | Integrated with Azure, free SSL | Limited to Azure ecosystem | Microsoft ecosystem users |

#### Recommendation Matrix

| Use Case | Recommended Platform | Reason |
|----------|---------------------|--------|
| **Personal/Hobby** | Vercel or Netlify | Free tier available, easy setup |
| **Startup/MVP** | Vercel | Great developer experience, good performance |
| **Enterprise** | AWS S3 + CloudFront | Scalability, reliability, enterprise features |
| **Cost-conscious** | GitHub Pages | Completely free |
| **Existing Cloud Provider** | Match your cloud provider | Simplified billing and management |

---

### 2.2 Detailed Deployment Steps per Platform

#### Platform 1: Vercel (Recommended)

Vercel is the recommended platform for deploying this application.

**Deployment Steps:**

1. Create account at [Vercel](https://vercel.com/)

2. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   # Navigate to frontend directory
   cd frontend
   
   # Deploy to Vercel
   vercel --prod
   ```

5. Set environment variables (optional):
   In the Vercel dashboard, you can set these environment variables:
   - `VITE_PERPLEXITY_API_KEY` - Perplexity API key
   - `VITE_OPENAI_API_KEY` - OpenAI API key
   - `VITE_GEMINI_API_KEY` - Google Gemini API key

   Note: Users can also enter their own API keys directly in the application interface.

**Estimated Cost:**
- Free Hobby plan available
- Pro plan: $20/month per team member

---

#### Platform 2: Netlify

Netlify is another excellent option for static site hosting.

**Deployment Steps:**

1. Create account at [Netlify](https://netlify.com/)

2. Build the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. Deploy:
   - Go to Netlify dashboard
   - Click "New site from Git"
   - Connect your repository
   - Set build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Deploy site

4. Set environment variables (optional):
   In the Netlify dashboard, you can set these environment variables:
   - `VITE_PERPLEXITY_API_KEY` - Perplexity API key
   - `VITE_OPENAI_API_KEY` - OpenAI API key
   - `VITE_GEMINI_API_KEY` - Google Gemini API key

**Estimated Cost:**
- Free plan available (100GB bandwidth/month)
- Pro plan: $19/month per site

---



---



---



---

#### Platform 3: GitHub Pages

GitHub Pages is a free option for hosting static sites.

**Deployment Steps:**

1. Build the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Deploy to GitHub Pages:
   - Copy the contents of the `dist` folder to a branch named `gh-pages`
   - Or use a GitHub Action to automate deployment:
   
   Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             
         - name: Install dependencies
           run: |
             cd frontend
             npm install
             
         - name: Build
           run: |
             cd frontend
             npm run build
             
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./frontend/dist
   ```

**Estimated Cost:**
- Completely free
- 1GB storage limit
- 100GB bandwidth/month

---

### 2.3 CI/CD Automation

#### GitHub Actions Configuration

For GitHub Pages deployment, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm install
          
      - name: Build
        run: |
          cd frontend
          npm run build
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

---

## 3. Troubleshooting

### Common Issues and Solutions

#### Issue: API Key Not Working

**Symptoms:**
- Research or generation fails with authentication errors
- "Invalid API key" messages

**Solutions:**
1. Verify your API key is correct and active
2. Check that you've entered the key in the correct field in the application
3. Ensure your API key has the necessary permissions

#### Issue: Research Service Timeout

**Symptoms:**
- Research step hangs
- Timeout errors

**Solutions:**
1. Check your internet connection
2. Verify your Perplexity API key is valid
3. Try using a different research provider if available

#### Issue: TTS Audio Generation Failing

**Symptoms:**
- Error during audio generation
- Empty audio file

**Solutions:**
1. Verify your OpenAI API key is valid (if using OpenAI TTS)
2. Check your browser's console for error messages
3. Try using a different TTS provider if available

#### Issue: Application Not Loading

**Symptoms:**
- Blank page or error messages
- JavaScript errors in browser console

**Solutions:**
1. Check browser compatibility (modern browsers required)
2. Clear browser cache and refresh
3. Check browser console for specific error messages
4. Ensure all dependencies were installed correctly during build

### Viewing Logs

All processing happens directly in the browser. Use your browser's Developer Tools (F12) to view console logs.

### Performance Optimization

| Area | Optimization | Impact |
|------|--------------|--------|
| **Research** | Use sonar instead of sonar-pro | Faster but less detailed |
| **TTS** | Use Web Speech API (free) | No cost, instant playback |
| **TTS** | Use OpenAI TTS (paid) | Higher quality audio |
| **Build** | Enable gzip on hosting platform | Faster page load |

---

## 4. Security Considerations

### API Key Management

**Best Practices:**

1. **API keys are stored locally in your browser**
   - Keys are never sent to any server
   - Keys are stored in browser's localStorage
   - You can clear them at any time in the application settings

2. **Use environment variables for deployment (optional)**
   - For static deployments, you can set these environment variables:
     - `VITE_PERPLEXITY_API_KEY`
     - `VITE_OPENAI_API_KEY`
     - `VITE_GEMINI_API_KEY`

3. **Rotate keys regularly**
   - Set calendar reminder to rotate keys every 90 days
   - Use separate keys for development and production

### HTTPS Configuration

When deploying to hosting platforms like Vercel, Netlify, or GitHub Pages, HTTPS is automatically provided.

For custom domain deployments:

1. **Vercel**: Automatic HTTPS with Let's Encrypt
2. **Netlify**: Automatic SSL certificates
3. **GitHub Pages**: Automatic HTTPS for *.github.io domains
4. **Custom domains**: Most platforms offer automatic SSL certificate provisioning

### Additional Security Recommendations

1. **Browser Security**
   - Always use the latest version of your browser
   - Enable built-in security features (Content Security Policy, etc.)

2. **Data Privacy**
   - All data processing happens in your browser
   - No data is sent to any server except API providers
   - Generated audio files are stored locally in your browser

3. **Input Validation**
   - All inputs are validated in the browser
   - Sanitize topic input to prevent injection

4. **CORS**
   - As a static site, CORS is handled by the browser
   - API requests are made directly to external services

---

## Quick Reference

### Essential Commands

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables Summary

For static deployments, you can optionally set these environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_PERPLEXITY_API_KEY` | Perplexity API key (recommended for best research) |
| `VITE_OPENAI_API_KEY` | OpenAI API key (for OpenAI TTS) |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for Gemini models) |

Note: Users can also enter their own API keys directly in the application interface.

*Last updated: 2026-02-14*