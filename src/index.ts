#!/usr/bin/env node

/**
 * LeadFuze MCP Server
 *
 * Enrich contacts and companies with verified business data directly from
 * Claude and other MCP-compatible AI agents.
 *
 * Supports two modes:
 * - stdio: For local testing with MCP Inspector, Claude Desktop, Claude Code
 * - http: For remote deployment (Claude.ai, hosted environments)
 *
 * Usage:
 *   Local:  node dist/index.js
 *   Remote: node dist/index.js --http --port 3000
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { LeadFuzeClient, formatEnrichmentResponse } from "./api/leadfuze-client.js";

// Parse command line arguments
const args = process.argv.slice(2);
const isHttpMode = args.includes("--http");
const portIndex = args.indexOf("--port");
const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

// Get API key from environment
const API_KEY = process.env.LEADFUZE_API_KEY;

if (!API_KEY) {
  console.error("Error: LEADFUZE_API_KEY environment variable is required");
  console.error("Get your API key at: https://console.leadfuze.com/register");
  process.exit(1);
}

// Initialize LeadFuze client
const client = new LeadFuzeClient(API_KEY);

// Create MCP server
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

/**
 * Start the server in stdio mode (for local testing)
 */
async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LeadFuze MCP Server running on stdio");
}

/**
 * Start the server in HTTP mode (for remote deployment)
 */
async function startHttpServer() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  // Store transports by session ID for cleanup
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Handle MCP requests
  app.all("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // For new sessions or requests without session ID
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else {
      // Create new transport for new session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport);
          console.log(`Session initialized: ${newSessionId}`);
        },
        onsessionclosed: (closedSessionId) => {
          transports.delete(closedSessionId);
          console.log(`Session closed: ${closedSessionId}`);
        },
      });

      // Connect the server to the transport
      await server.connect(transport);
    }

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
