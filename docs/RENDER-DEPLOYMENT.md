# Render Deployment Guide

This document provides information about deploying this Next.js application to Render.

## Configuration

The deployment is configured using the `render.yaml` file in the root of the project. This file defines:

- Service type: Web service
- Runtime: Node.js
- Build command: `npm install && npm run build`
- Start command: `node .next/standalone/server.js`
- Environment variables

## Build Process

The build process consists of several steps:

1. **Path Alias Check**: Verifies that path aliases are correctly configured in `tsconfig.json` and `jsconfig.json`.
2. **Next.js Build**: Compiles the application using Next.js build.
3. **Debug Information**: Collects debug information about the build.
4. **Post-Build Processing**: Prepares the standalone output for deployment.

## Troubleshooting

If you encounter build failures, check the following:

1. **Path Aliases**: Ensure path aliases are correctly configured in both `tsconfig.json` and `jsconfig.json`.
2. **Environment Variables**: Verify that all required environment variables are set in the Render dashboard.
3. **Node.js Version**: Make sure you're using Node.js 20 or later.
4. **Build Logs**: Check the build logs for specific error messages.
5. **Standalone Output**: Verify that the `.next/standalone` directory is being created during the build.

## Monitoring

You can monitor the application using:

- Render Dashboard
- Render CLI: `render logs`
- Health Check API: `/api/health`

## Deployment Commands

To deploy manually:

```bash
# Push to the GitHub repository
git push origin main

# Or deploy directly using the Render CLI
render deploy
```

## Environment Variables

The following environment variables are required:

- `NODE_ENV`: Set to `production`
- `NODE_VERSION`: Set to `20`
- `NEXT_TELEMETRY_DISABLED`: Set to `1`
- `NEXT_SHARP_PATH`: Set to `/opt/render/project/node_modules/sharp`
- `PORT`: Set to `10000`

Additional environment variables for your application should be added to the Render dashboard or the `render.yaml` file. 