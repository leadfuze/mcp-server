# LeadFuze Enrichment MCP Server

## Description

Enable Claude to be your everyday sales prospector. Enrich contacts and companies with verified business data directly from Claude and other MCP-compatible AI agents. Get detailed person and company information including emails, phone numbers, job titles, company details, and social profiles. 

## Features

- **Email Enrichment**: Look up detailed person and company data using an email address
- **LinkedIn Enrichment**: Look up detailed person and company data using a LinkedIn profile URL
- **Rich Data**: Returns verified business emails, phone numbers, job titles, company info, and social profiles
- **No Match = No Charge**: Credits are only consumed when a profile match is found

## Getting Started

1. Visit [LeadFuze Console](https://console.leadfuze.com/register) to create an account
2. Your API key is automatically created on account setup
3. Find your API key on the API Keys page (starts with `lfz_`)

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| Enrichment (Email/LinkedIn) | 10,000 requests/minute |
| Email Validation (future) | 20,000 requests/minute |

Need higher limits? Contact us at help@leadfuze.co

## Examples

### Example 1: Email Enrichment (Match Found)

**User prompt:** "Look up the contact information for jane.doe@example-health.com"

**What happens:**
- Server searches LeadFuze database by email
- Returns person profile with job title, company, location
- Includes company details (industry, size, revenue)
- Returns social profile links
- One credit consumed for successful match

**Example response:**
```
Found: Jane Doe
- Email: jane.doe@example-health.com (Valid)
- Title: Medical Assistant at Example Health Inc
- Location: Phoenix, AZ
- LinkedIn: linkedin.com/in/jane-doe-example

Company: Example Health Inc
- Industry: Hospitals And Health Care
- Size: 1001-5000 employees
- Revenue: $250M - $500M
```

### Example 2: LinkedIn Enrichment (Match Found)

**User prompt:** "Get contact details for linkedin.com/in/johndoe-ceo"

**What happens:**
- Server searches LeadFuze database by LinkedIn URL
- Returns person profile with verified business email
- Includes company details and contact information
- Returns additional social profiles if available
- One credit consumed for successful match

**Example response:**
```
Found: John Doe
- Email: john.doe@acme-corp.com (Valid)
- Title: CEO at Acme Corporation
- Location: San Francisco, CA
- Phone: +1-555-123-4567

Company: Acme Corporation
- Industry: Software Development
- Size: 51-200 employees
- Revenue: $10M - $50M
```

### Example 3: No Match Found (No Credit Consumed)

**User prompt:** "Look up contact@nonexistent-domain-xyz.com"

**What happens:**
- Server searches LeadFuze database
- No matching profile found in database
- Returns "no match" response
- **No credit consumed** - you only pay for successful matches

**Example response:**
```
No match found for: contact@nonexistent-domain-xyz.com

No credits were consumed for this lookup.
Try searching with a different email or LinkedIn URL.
```

## Privacy Policy

See our privacy policy: https://www.leadfuze.com/privacy

## Support

- Email: help@leadfuze.co
- Documentation: https://www.leadfuze.com/api-docs/

---

## Development

This section is for contributors and self-hosting.

### Installation

```bash
npm install
npm run build
```

### Running Locally

**stdio mode** (for Claude Desktop, Claude Code, MCP Inspector):
```bash
LEADFUZE_API_KEY=lfz_your_key node dist/index.js
```

**With MCP Inspector:**
```bash
LEADFUZE_API_KEY=lfz_your_key npx @modelcontextprotocol/inspector node dist/index.js
```

### Running as HTTP Server

**HTTP mode** (for remote deployments):
```bash
LEADFUZE_API_KEY=lfz_your_key node dist/index.js --http --port 3000
```

This starts an HTTP server with:
- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

For production, deploy behind a reverse proxy (nginx) with TLS.
