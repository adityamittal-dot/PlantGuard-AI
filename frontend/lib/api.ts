const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export const ACCESS_KEY = "plantguard_access";
export const REFRESH_KEY = "plantguard_refresh";

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  request_id?: string;
};

export class ApiError extends Error {
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
};

export type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
};

export type AuthPayload = {
  user: User;
  tokens: Tokens;
};

export type ImageUpload = {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  quality_score?: number | null;
  quality_status?: string;
  quality_messages?: string[];
  url?: string | null;
  created_at: string;
};

export type Prediction = {
  id: string;
  label: string;
  probability: number;
  rank: number;
  disease_id?: string | null;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  source_metadata?: Record<string, unknown> | null;
};

export type Severity = {
  severity_score: number;
  severity_label: string;
  method: string;
};

export type Explanation = {
  method: string;
  heatmap_url?: string | null;
  mask_url?: string | null;
  disclaimer?: string;
};

export type Diagnosis = {
  id: string;
  status: string;
  job_stage?: string | null;
  overall_confidence?: number | null;
  inference_time_ms?: number | null;
  quality_status?: string | null;
  quality_messages?: string[] | null;
  error_code?: string | null;
  error_message?: string | null;
  image_id: string;
  crop_id?: string | null;
  model_version_id?: string | null;
  created_at: string;
  predictions: Prediction[];
  recommendations: Recommendation[];
  severity?: Severity | null;
  explanation?: Explanation | null;
  image_url?: string | null;
  scientific_note?: string;
};

export type JobStatus = {
  job_id: string;
  diagnosis_id: string;
  status: string;
  stage?: string | null;
  error_code?: string | null;
  error_message?: string | null;
};

export type AnalyticsOverview = {
  total_diagnoses: number;
  healthy_detections: number;
  diseased_detections: number;
  average_confidence: number;
  completed_diagnoses: number;
  failed_diagnoses: number;
};

export type AnalyticsFilters = {
  date_from?: string;
  date_to?: string;
  category?: string;
};

export type TimeseriesPoint = { date: string; count: number };

export type AnalyticsTimeseries = {
  date_from: string;
  date_to: string;
  category?: string | null;
  total: number;
  points: TimeseriesPoint[];
};

export type DistributionItem = { label: string; count: number; share: number };

export type AnalyticsDistribution = { total: number; items: DistributionItem[] };

export type AnalyticsSummary = AnalyticsOverview & {
  confidence_by_category: { label: string; average_confidence: number; count: number }[];
  quality_breakdown: { status: string; count: number }[];
};

export type DatasetClass = { label: string; count: number; share: number };

export type DatasetSummary = {
  name: string;
  source_url: string;
  source: string;
  approximate: boolean;
  total_images: number;
  class_count: number;
  imbalance_ratio: number | null;
  classes: DatasetClass[];
  note: string;
};

export type ModelMetrics = {
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1_score?: number | null;
  inference_time_ms?: number | null;
};

export type ModelVersionRow = {
  id: string;
  model_id: string;
  model_name: string;
  architecture: string;
  framework: string;
  version: string;
  status: string;
  is_active: boolean;
  artifact_uri?: string | null;
  artifact_available: boolean;
  class_labels?: string[] | null;
  metrics: ModelMetrics;
  created_at: string;
};

export type ClassMetric = {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

export type ActiveClassMetrics = {
  model_version_id: string;
  model_name: string;
  version: string;
  available: boolean;
  classes: ClassMetric[];
  macro?: { precision: number; recall: number; f1: number } | null;
  accuracy?: number | null;
  note?: string | null;
};

export type Paged<T> = {
  total: number;
  limit: number;
  offset: number;
  items: T[];
};

export type AdminUsersPage = Paged<User> & { roles: string[] };

export type AuditLogEntry = {
  id: string;
  action: string;
  user_id?: string | null;
  user_email?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
};

export type AuditLogPage = Paged<AuditLogEntry> & { actions: string[] };

export type AdminUserFilters = {
  q?: string;
  role?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export type AuditLogFilters = {
  action?: string;
  resource_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
};

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export type Disease = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  pathogen_type?: string | null;
  pathogen_name?: string | null;
  symptoms?: string | null;
  cause?: string | null;
  prevention?: string | null;
  management_notes?: string | null;
  source_metadata?: Record<string, unknown> | null;
};

export type Crop = {
  id: string;
  name: string;
  slug: string;
  scientific_name?: string | null;
  description?: string | null;
  diseases?: { id: string; name: string; slug: string }[];
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: Tokens) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/v1")) {
    const origin = API_BASE.replace(/\/api\/v1\/?$/, "");
    return `${origin}${path}`;
  }
  const base = API_BASE.replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError("PARSE_ERROR", "Unable to parse server response.", null);
  }

  if (!res.ok || !body.success) {
    throw new ApiError(
      body.error?.code || `HTTP_${res.status}`,
      body.error?.message || res.statusText || "Request failed",
      body.error?.details,
      body.request_id
    );
  }

  return body.data as T;
}

export type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
  headers?: Record<string, string>;
};

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the stored refresh token for a new token pair. Single-flight
 * across concurrent callers so a burst of 401s only triggers one refresh. */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const tokens = await apiRequest<Tokens>("/auth/refresh", {
          method: "POST",
          body: { refresh_token: refreshToken },
          auth: false,
        });
        setTokens(tokens);
        return true;
      } catch {
        clearTokens();
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  const auth = options.auth !== false;

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  return fetch(resolveUrl(path), {
    method: options.method || (options.body || options.formData ? "POST" : "GET"),
    headers,
    body,
  });
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  _retried = false
): Promise<T> {
  const res = await doFetch(path, options);

  if (
    res.status === 401 &&
    options.auth !== false &&
    !_retried &&
    path !== "/auth/refresh" &&
    getRefreshToken()
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, options, true);
    }
  }

  return parseEnvelope<T>(res);
}

/** Fetch a storage URL with auth and return a blob object URL. Caller must revoke. */
export async function fetchAuthorizedBlobUrl(storagePath: string): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(resolveUrl(storagePath), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError("STORAGE_ERROR", "Unable to load protected image.", null);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Fetch the diagnosis PDF report with auth and return it as a Blob. */
export async function fetchDiagnosisReport(diagnosisId: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(resolveUrl(`/diagnoses/${diagnosisId}/report`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(`HTTP_${res.status}`, "Unable to download the PDF report.", null);
  }
  return res.blob();
}

/** Download the diagnoses CSV (honoring filters) with auth and return it as a Blob. */
export async function fetchAnalyticsCsv(filters: AnalyticsFilters): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(resolveUrl(`/analytics/export.csv${toQuery(filters)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new ApiError(`HTTP_${res.status}`, "Unable to export the CSV.", null);
  }
  return res.blob();
}

export const api = {
  register(payload: { email: string; password: string; full_name: string }) {
    return apiRequest<AuthPayload>("/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
  },

  login(payload: { email: string; password: string }) {
    return apiRequest<AuthPayload>("/auth/login", {
      method: "POST",
      body: payload,
      auth: false,
    });
  },

  me() {
    return apiRequest<User>("/users/me");
  },

  uploadImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return apiRequest<ImageUpload>("/images/upload", {
      method: "POST",
      formData: fd,
    });
  },

  createDiagnosis(payload: { image_id: string; crop_id?: string }) {
    return apiRequest<JobStatus>("/diagnoses", {
      method: "POST",
      body: payload,
    });
  },

  getJob(id: string) {
    return apiRequest<JobStatus>(`/ai/jobs/${id}`);
  },

  getDiagnosis(id: string) {
    return apiRequest<Diagnosis>(`/diagnoses/${id}`);
  },

  listDiagnoses() {
    return apiRequest<Diagnosis[]>("/diagnoses");
  },

  analyticsOverview() {
    return apiRequest<AnalyticsOverview>("/analytics/overview");
  },

  analyticsSummary(filters: AnalyticsFilters = {}) {
    return apiRequest<AnalyticsSummary>(`/analytics/summary${toQuery(filters)}`);
  },

  analyticsTimeseries(filters: AnalyticsFilters = {}) {
    return apiRequest<AnalyticsTimeseries>(`/analytics/timeseries${toQuery(filters)}`);
  },

  analyticsDistribution(filters: AnalyticsFilters = {}) {
    return apiRequest<AnalyticsDistribution>(`/analytics/distribution${toQuery(filters)}`);
  },

  researchDatasets() {
    return apiRequest<DatasetSummary>("/research/datasets");
  },

  researchModels() {
    return apiRequest<ModelVersionRow[]>("/research/models");
  },

  researchClassMetrics() {
    return apiRequest<ActiveClassMetrics | null>("/research/models/active/class-metrics");
  },

  promoteModel(versionId: string) {
    return apiRequest<ModelVersionRow>(`/research/models/${versionId}/promote`, {
      method: "POST",
    });
  },

  adminUsers(filters: AdminUserFilters = {}) {
    return apiRequest<AdminUsersPage>(`/admin/users${toQuery(filters)}`);
  },

  adminUpdateUser(id: string, patch: { role?: string; is_active?: boolean }) {
    return apiRequest<User>(`/admin/users/${id}`, { method: "PATCH", body: patch });
  },

  adminAuditLogs(filters: AuditLogFilters = {}) {
    return apiRequest<AuditLogPage>(`/admin/audit-logs${toQuery(filters)}`);
  },

  listDiseases(q?: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return apiRequest<Disease[]>(`/diseases${qs}`, { auth: false });
  },

  getDisease(slug: string) {
    return apiRequest<Disease>(`/diseases/${slug}`, { auth: false });
  },

  listCrops() {
    return apiRequest<Crop[]>("/crops", { auth: false });
  },

  logout(refreshToken: string) {
    return apiRequest<{ logged_out: boolean }>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
    });
  },
};

export { API_BASE };
