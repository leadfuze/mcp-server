/**
 * LeadFuze Enrichment API Types
 */

export interface CompanyData {
  name: string | null;
  domain: string | null;
  phone: string[] | null;
  sic: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  linkedin_url: string | null;
  revenue: string | null;
  employee_count: string | null;
  primary_industry: string | null;
  description: string | null;
  naics: number | null;
  related_domains: string[] | null;
  last_updated: string | null;
}

export interface SocialData {
  linkedin_url: string | null;
  social_connections: string | null;
}

export interface PersonData {
  lf_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  business_email: string | null;
  personal_emails: string[] | null;
  additional_personal_emails: string[] | null;
  programmatic_business_emails: string[] | null;
  mobile_phone: string | null;
  direct_number: string | null;
  personal_phone: string | null;
  linkedin_url: string | null;
  personal_address: string | null;
  personal_address_2: string | null;
  personal_city: string | null;
  personal_state: string | null;
  personal_zip: string | null;
  personal_zip4: string | null;
  full_address: string | null;
  gender: string | null;
  age_range: string | null;
  income_range: string | null;
  net_worth: string | null;
  married: string | null;
  children: string | null;
  homeowner: string | null;
  dob: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  professional_address: string | null;
  professional_address_2: string | null;
  professional_city: string | null;
  professional_state: string | null;
  professional_zip: string | null;
  professional_zip4: string | null;
  professional_full_address: string | null;
  business_email_validation_status: string | null;
  business_email_last_seen: string | null;
  personal_emails_validation_status: string | null;
  personal_emails_last_seen: string | null;
  last_updated: string | null;
  created_at: string | null;
  updated_at: string | null;
  company: CompanyData | null;
  social: SocialData | null;
}

export interface EnrichmentMeta {
  input: string;
  search_type: "email" | "linkedin";
  source: string;
  result_count: number;
  limit: number;
  timestamp: string;
}

export interface EnrichmentResponse {
  success: boolean;
  cached: boolean;
  data: PersonData | PersonData[] | null;
  meta: EnrichmentMeta;
}

export interface EnrichmentError {
  error: {
    code: string;
    message: string;
  };
}

export interface EmailEnrichmentParams {
  email: string;
  include_company?: boolean;
  include_social?: boolean;
}

export interface LinkedInEnrichmentParams {
  linkedin: string;
  include_company?: boolean;
  include_social?: boolean;
}
