# Deploying to Render

This document provides instructions for deploying our Next.js 15 application to Render.

## Prerequisites

- A Render account (https://render.com)
- Access to the GitHub repository
- Environment variables from your `.env.local` file

## Deployment Steps

### 1. Create a New Web Service on Render

1. Log in to your Render dashboard
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Use the following settings:
   - **Name**: productory-stt (or your preferred name)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Choose appropriate plan (Starter is a good starting point)

### 2. Configure Environment Variables

Add all required environment variables from your `.env.local` file to the Render dashboard:

1. In your web service dashboard, go to the "Environment" tab
2. Add each environment variable from your `.env.local` file
3. Click "Save Changes"

#### Using the Environment Variables Export Script

We've created a script to help you export environment variables from your `.env.local` file to formats that can be easily imported into Render:

```bash
# Run the export script
npm run export:env
```

This will create three files in the `tmp` directory:
- `render-env-vars.json`: JSON format for bulk import
- `render-env-vars.csv`: CSV format for bulk import
- `render.env`: Plain text format for manual copying

To import these variables into Render:
1. In your web service dashboard, go to the "Environment" tab
2. Click "Bulk Import" and select either JSON or CSV format
3. Upload the corresponding file
4. Click "Import"

### 3. Deploy

1. Click "Manual Deploy" and select "Deploy latest commit"
2. Render will build and deploy your application
3. Once deployed, you can access your application at the provided URL

## Using render.yaml for Infrastructure as Code

We've included a `render.yaml` file in the repository for Infrastructure as Code deployment:

1. In the Render dashboard, click "New" and select "Blueprint"
2. Connect your GitHub repository
3. Render will automatically detect the `render.yaml` file and create the required resources

## Monitoring and Logs

- Access logs from the "Logs" tab in your web service dashboard
- Set up alerts in the "Alerts" tab for monitoring

## Testing Your Deployment

We've created a script to help you test your Render deployment:

```bash
# Run the test script
npm run test:render
```

This script will:
1. Prompt you for your Render URL
2. Test key endpoints to ensure they're working correctly
3. Provide a summary of the test results

The script tests the following endpoints:
- Home page
- Favicon
- Static assets
- Health check API
- 404 page

If any tests fail, check the Render logs for more information.

## Troubleshooting

If you encounter issues during deployment:

1. Check the build logs for errors
2. Verify all environment variables are correctly set
3. Ensure your Node.js version is compatible (we use Node 20)
4. Check that the `output: 'standalone'` is set in `next.config.js`

## CI/CD Pipeline

Render automatically deploys when changes are pushed to the main branch. To customize this behavior:

1. Go to the "Settings" tab in your web service dashboard
2. Under "Deploy Hooks", you can configure custom deployment triggers
3. Under "Auto-Deploy", you can enable/disable automatic deployments

### GitHub Actions Integration

We've also set up a GitHub Actions workflow for deploying to Render. This workflow is defined in `.github/workflows/render-deploy.yml` and will automatically deploy your application to Render when changes are pushed to the main branch.

To set up the GitHub Actions workflow:

1. In your Render dashboard, go to your account settings
2. Create an API key in the "API Keys" section
3. Copy the API key and the service ID of your web service
4. In your GitHub repository, go to "Settings" > "Secrets and variables" > "Actions"
5. Add the following secrets:
   - `RENDER_API_KEY`: Your Render API key
   - `RENDER_SERVICE_ID`: Your Render service ID

The workflow will automatically trigger when you push to the main branch, or you can manually trigger it from the "Actions" tab in your GitHub repository 