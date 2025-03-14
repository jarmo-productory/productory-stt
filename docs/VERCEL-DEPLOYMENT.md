# Vercel Deployment Guide

This document provides information about deploying this Next.js application to Vercel.

## Why Vercel?

Vercel is the recommended platform for Next.js applications because:

1. Next.js is developed by Vercel, ensuring first-class support
2. Zero-configuration deployments for Next.js projects
3. Automatic handling of serverless functions, API routes, and edge functions
4. Built-in handling of environment variables and secrets
5. Preview deployments for pull requests

## Deployment Process

### Manual Deployment

1. Create an account on [Vercel](https://vercel.com)
2. Connect your GitHub repository
3. Import your project
4. Configure environment variables
5. Deploy

### Automated Environment Variable Setup

We've created scripts to help automate the environment variable setup:

```bash
# Export environment variables from .env file to a format that can be copied to Vercel UI
npm run vercel:env

# Set up environment variables programmatically using Vercel API
# Requires VERCEL_TOKEN and PROJECT_ID environment variables
npm run vercel:setup
```

### Getting Your Vercel Project ID

You can get your Vercel project ID using the Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# List your projects
vercel projects

# Link to your project
vercel link
```

## Configuration

The deployment is configured using the `vercel.json` file in the root of the project. This file defines:

- Framework: Next.js
- Build command: `npm run build`
- Development command: `npm run dev`
- Install command: `npm install`
- Environment variables

## Build Process

For Vercel, we've simplified the build process to use Next.js's native build:

```json
"build": "next build"
```

The custom build process for Render is preserved in a separate script:

```json
"build:render": "node scripts/check-path-aliases.js && next build && node scripts/debug-build.js && node scripts/post-build.js"
```

## Monitoring

You can monitor the application using:

- Vercel Dashboard
- Vercel CLI: `vercel logs`
- Vercel Analytics (if enabled)

## Redeployment

To redeploy your application, you can use any of these methods:

### Using Git

The simplest way to trigger a redeployment is to push a new commit to your repository:

```bash
git add .
git commit -m "Trigger redeployment"
git push origin main
```

### Using Vercel CLI

You can also redeploy directly using the Vercel CLI:

```bash
# Deploy the current directory
vercel

# Deploy to production
vercel --prod

# Force a new deployment even if no changes are detected
vercel --force
```

### Using Vercel Dashboard

You can manually trigger a redeployment from the Vercel dashboard by:
1. Going to your project
2. Clicking on the "Deployments" tab
3. Finding the deployment you want to redeploy
4. Clicking the three dots menu (⋮)
5. Selecting "Redeploy"

## Environment Variables

The following environment variables are recommended:

- `NODE_ENV`: Set to `production` for production deployments
- `NEXT_TELEMETRY_DISABLED`: Set to `1` to disable telemetry

Additional environment variables for your application should be added to the Vercel dashboard or the `vercel.json` file.

## Troubleshooting

If you encounter deployment issues:

1. Check the build logs in the Vercel dashboard
2. Verify that all required environment variables are set
3. Ensure your Next.js configuration is compatible with Vercel
4. Check for any serverless function size limits (Vercel has a 50MB limit per function)

## Useful Commands

```bash
# Deploy to Vercel
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List environment variables
vercel env ls

# Add an environment variable
vercel env add
``` 