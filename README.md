# STC Diagnostic Grader

AI-powered Spanish diagnostic grader for Spanish That Clicks. Scores student responses using ACTFL proficiency levels.

## Setup

### 1. Deploy to Vercel

- Connect this GitHub repo to Vercel
- Set the build command to `npm run build`
- Set the output directory to `dist`

### 2. Add your Anthropic API key

In your Vercel project dashboard:

- Go to **Settings → Environment Variables**
- Add a new variable:
  - Name: `ANTHROPIC_API_KEY`
  - Value: your key from console.anthropic.com
- Click **Save** then **Redeploy**

## Usage

1. Export responses from Tally as CSV (Results → Export → CSV)
1. Upload the CSV to the grader
1. Each student gets an ACTFL level, grammar breakdown, and recommendations
1. Click any student card to expand and use “Analyze Writing with AI”