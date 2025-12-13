/**
 * LeadFuze API Client
 */

import type {
  EnrichmentResponse,
  EmailEnrichmentParams,
  LinkedInEnrichmentParams,
} from "../types/enrichment.js";

const API_BASE_URL = "https://console.leadfuze.com/api/v1";

export class LeadFuzeClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("LeadFuze API key is required");
    }
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Enrich a contact by email address
   */
  async enrichByEmail(params: EmailEnrichmentParams): Promise<EnrichmentResponse> {
    return this.request<EnrichmentResponse>("/enrichment/email", {
      email: params.email,
      include_company: params.include_company ?? true,
      include_social: params.include_social ?? true,
      limit: 100,
      page: 1,
      cache_ttl: 600,
    });
  }

  /**
   * Enrich a contact by LinkedIn URL
   */
  async enrichByLinkedIn(params: LinkedInEnrichmentParams): Promise<EnrichmentResponse> {
    // Normalize LinkedIn URL - strip protocol and www
    const normalizedLinkedIn = normalizeLinkedInUrl(params.linkedin);

    return this.request<EnrichmentResponse>("/enrichment/linkedin", {
      linkedin_url: normalizedLinkedIn,
      include_company: params.include_company ?? true,
      include_social: params.include_social ?? true,
      limit: 100,
      page: 1,
      cache_ttl: 600,
    });
  }
}

/**
 * Normalize LinkedIn URL to the format expected by the API
 * Strips https://, http://, www. prefixes
 * Example: "https://www.linkedin.com/in/johndoe" -> "linkedin.com/in/johndoe"
 */
function normalizeLinkedInUrl(url: string): string {
  let normalized = url.trim();

  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, "");

  // Remove www.
  normalized = normalized.replace(/^www\./, "");

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");

  return normalized;
}

/**
 * Format enrichment response into human-readable text
 */
export function formatEnrichmentResponse(response: EnrichmentResponse): string {
  if (!response.success) {
    return "Error: The enrichment request was not successful.";
  }

  if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
    return `No match found for: ${response.meta.input}\n\nNo credits were consumed for this lookup.\nTry searching with a different email or LinkedIn URL.`;
  }

  // Handle both single object and array responses
  const person = Array.isArray(response.data) ? response.data[0] : response.data;
  const lines: string[] = [];

  // Build display name from available data
  const displayName = person.full_name || 
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    person.business_email ||
    "Unknown";
  
  // Person details
  lines.push(`Found: ${displayName}`);
  
  if (person.business_email) {
    const validationStatus = person.business_email_validation_status 
      ? ` (${person.business_email_validation_status})`
      : "";
    lines.push(`- Email: ${person.business_email}${validationStatus}`);
  }

  if (person.job_title && person.company?.name) {
    lines.push(`- Title: ${person.job_title} at ${person.company.name}`);
  } else if (person.job_title) {
    lines.push(`- Title: ${person.job_title}`);
  }

  if (person.seniority_level) {
    lines.push(`- Seniority: ${person.seniority_level}`);
  }

  if (person.department) {
    lines.push(`- Department: ${person.department}`);
  }

  // Location
  const location = person.full_address || 
    [person.personal_city, person.personal_state].filter(Boolean).join(", ");
  if (location) {
    lines.push(`- Location: ${location}`);
  }

  // Phone numbers
  if (person.mobile_phone) {
    lines.push(`- Mobile: ${person.mobile_phone}`);
  }
  if (person.direct_number) {
    lines.push(`- Direct: ${person.direct_number}`);
  }

  // LinkedIn
  if (person.linkedin_url) {
    lines.push(`- LinkedIn: ${person.linkedin_url}`);
  }

  // Company details
  if (person.company) {
    const company = person.company;
    lines.push("");
    lines.push(`Company: ${company.name || "Unknown"}`);
    
    if (company.primary_industry) {
      lines.push(`- Industry: ${company.primary_industry}`);
    }
    if (company.employee_count) {
      lines.push(`- Size: ${company.employee_count} employees`);
    }
    if (company.revenue) {
      lines.push(`- Revenue: ${company.revenue}`);
    }
    if (company.domain) {
      lines.push(`- Website: ${company.domain}`);
    }
    
    const companyLocation = [company.city, company.state, company.country]
      .filter(Boolean)
      .join(", ");
    if (companyLocation) {
      lines.push(`- Location: ${companyLocation}`);
    }

    if (company.phone && company.phone.length > 0) {
      lines.push(`- Phone: ${company.phone[0]}`);
    }

    if (company.linkedin_url) {
      lines.push(`- LinkedIn: ${company.linkedin_url}`);
    }
  }

  // Add raw data for completeness
  lines.push("");
  lines.push("--- Raw Data ---");
  lines.push(JSON.stringify(response.data, null, 2));

  return lines.join("\n");
}
