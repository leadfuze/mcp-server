#!/usr/bin/env node

/**
 * LeadFuze MCP Server
 *
 * Enrich contacts and companies with verified business data directly from
 * Claude and other MCP-compatible AI agents.
 *
 * Supports two modes:
 * - stdio: For local testing with MCP Inspector, Claude Desktop, Claude Code
 *          (uses LEADFUZE_API_KEY environment variable)
 * - http: For remote deployment (Claude.ai, hosted environments)
 *          (users pass their API key via Authorization header)
 *
 * Usage:
 *   Local:  LEADFUZE_API_KEY=lfz_xxx node dist/index.js
 *   Remote: node dist/index.js --http --port 3000
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { LeadFuzeClient, formatEnrichmentResponse, formatValidationResponse } from "./api/leadfuze-client.js";

// Parse command line arguments
const args = process.argv.slice(2);
const isHttpMode = args.includes("--http");
const portIndex = args.indexOf("--port");
const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

// Store clients per session (for HTTP mode with per-user API keys)
const sessionClients = new Map<string, LeadFuzeClient>();

/**
 * Create an MCP server with tools configured to use a specific client
 */
function createMcpServer(getClient: () => LeadFuzeClient): McpServer {
  const server = new McpServer({
    name: "leadfuze-enrichment",
    version: "1.0.0",
  });

  // Email Enrichment Tool
  server.registerTool(
    "enrich_by_email",
    {
      title: "Email Enrichment",
      description:
        "Look up detailed person and company information using an email address. Returns verified business data including job title, company details, phone numbers, and social profiles.",
      inputSchema: {
        email: z.string().email().describe("The email address to enrich"),
        include_company: z
          .boolean()
          .default(true)
          .describe("Include company data in response"),
        include_social: z
          .boolean()
          .default(true)
          .describe("Include social profile data in response"),
      },
      annotations: {
        title: "Email Enrichment",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ email, include_company, include_social }) => {
      try {
        const client = getClient();
        const response = await client.enrichByEmail({
          email,
          include_company,
          include_social,
        });

        const formattedResponse = formatEnrichmentResponse(response);

        return {
          content: [
            {
              type: "text" as const,
              text: formattedResponse,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";

        return {
          content: [
            {
              type: "text" as const,
              text: `Error enriching email: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // LinkedIn Enrichment Tool
  server.registerTool(
    "enrich_by_linkedin",
    {
      title: "LinkedIn Enrichment",
      description:
        "Look up detailed person and company information using a LinkedIn profile URL. Returns verified business data including email, job title, company details, and phone numbers.",
      inputSchema: {
        linkedin: z
          .string()
          .describe(
            "The LinkedIn profile URL (e.g., linkedin.com/in/johndoe or https://www.linkedin.com/in/johndoe)"
          ),
        include_company: z
          .boolean()
          .default(true)
          .describe("Include company data in response"),
        include_social: z
          .boolean()
          .default(true)
          .describe("Include social profile data in response"),
      },
      annotations: {
        title: "LinkedIn Enrichment",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ linkedin, include_company, include_social }) => {
      try {
        const client = getClient();
        const response = await client.enrichByLinkedIn({
          linkedin,
          include_company,
          include_social,
        });

        const formattedResponse = formatEnrichmentResponse(response);

        return {
          content: [
            {
              type: "text" as const,
              text: formattedResponse,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";

        return {
          content: [
            {
              type: "text" as const,
              text: `Error enriching LinkedIn profile: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Email Validation Tool
  server.registerTool(
    "validate_email",
    {
      title: "Email Validation",
      description:
        "Validate an email address to check if it's deliverable, has valid format, and assess its risk level. Returns detailed validation results including deliverability, catch-all status, and mail server information.",
      inputSchema: {
        email: z.string().email().describe("The email address to validate"),
      },
      annotations: {
        title: "Email Validation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ email }) => {
      try {
        const client = getClient();
        const response = await client.validateEmail({ email });

        const formattedResponse = formatValidationResponse(response);

        return {
          content: [
            {
              type: "text" as const,
              text: formattedResponse,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";

        return {
          content: [
            {
              type: "text" as const,
              text: `Error validating email: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Start the server in stdio mode (for local testing)
 * Uses LEADFUZE_API_KEY environment variable
 */
async function startStdioServer() {
  const API_KEY = process.env.LEADFUZE_API_KEY;

  if (!API_KEY) {
    console.error("Error: LEADFUZE_API_KEY environment variable is required");
    console.error("Get your API key at: https://console.leadfuze.com/register");
    process.exit(1);
  }

  const client = new LeadFuzeClient(API_KEY);
  const server = createMcpServer(() => client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LeadFuze MCP Server running on stdio");
}

/**
 * Start the server in HTTP mode (for remote deployment)
 * Users pass their API key via Authorization header
 */
async function startHttpServer() {
  const app = express();
  // Note: Don't use express.json() globally - MCP transport needs raw body access

  // CORS middleware for Claude.ai and other MCP clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow Claude.ai, Claude.com, and localhost for testing
    const allowedOrigins = [
      'https://claude.ai',
      'https://www.claude.ai',
      'https://claude.com',
      'https://www.claude.com',
      'http://localhost:6274', // MCP Inspector
      'http://127.0.0.1:6274',
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Allow requests without origin (server-to-server)
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  });

  // Store transports and servers by session ID
  const sessions = new Map<string, {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    apiKey: string;
  }>();

  // Handle MCP requests
  app.all("/mcp", async (req, res) => {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    let apiKey: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    }

    // Fall back to env var if no header (for backwards compatibility)
    if (!apiKey) {
      apiKey = process.env.LEADFUZE_API_KEY;
    }

    if (!apiKey) {
      res.status(401).json({
        error: "Authorization required. Pass your LeadFuze API key in the Authorization header: Bearer lfz_xxx"
      });
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Check for existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // Create new session with user's API key
    const client = new LeadFuzeClient(apiKey);
    const server = createMcpServer(() => client);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { transport, server, apiKey: apiKey! });
        console.log(`Session initialized: ${newSessionId}`);
      },
      onsessionclosed: (closedSessionId) => {
        sessions.delete(closedSessionId);
        console.log(`Session closed: ${closedSessionId}`);
      },
    });

    // Connect the server to the transport
    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res);
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "leadfuze-mcp" });
  });

  // Start listening
  app.listen(port, "0.0.0.0", () => {
    console.log(`LeadFuze MCP Server running on http://0.0.0.0:${port}`);
    console.log(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
    console.log(`Health check: http://0.0.0.0:${port}/health`);
    console.log(`\nUsers should pass their API key via Authorization header:`);
    console.log(`  Authorization: Bearer lfz_your_api_key`);
  });
}

// Main entry point
async function main() {
  if (isHttpMode) {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
