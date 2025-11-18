import type {
  AdminBenefitDictionaryEntry,
  AdminDictionaryResponse,
  AdminTiltakMetadata,
} from "../types";

const ADMIN_API_BASE =
  import.meta.env.VITE_ADMIN_API_BASE?.trim() || "/admin/api";

const ADMIN_USER_OVERRIDE =
  (import.meta.env.VITE_ADMIN_USER_EMAIL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? "local-redaktor@energinokkelen.dev" : "");

type UpdateBenefitRefsPayload = {
  benefitRefs: string[];
  generation: string;
  changeSummary?: string;
};

type DictionaryMutationPayload = {
  entry: AdminBenefitDictionaryEntry;
  generation: string;
};

export type UpdateBenefitRefsResponse = {
  id: string;
  path: string;
  benefitRefs: string[];
  metadata: {
    updatedAt?: string;
    updatedBy?: string;
    changeSummary?: string;
  };
  generation: string | null;
};

export type DictionaryMutationResponse = {
  benefit: AdminBenefitDictionaryEntry;
  generation: string | null;
};

export async function fetchDictionary(
  signal?: AbortSignal
): Promise<AdminDictionaryResponse> {
  return request<AdminDictionaryResponse>("/dictionary", { signal });
}

export async function fetchTiltakMetadata(
  tiltakId: string
): Promise<AdminTiltakMetadata> {
  return request<AdminTiltakMetadata>(`/content/tiltak/${tiltakId}/metadata`);
}

export async function updateTiltakBenefitRefs(
  tiltakId: string,
  payload: UpdateBenefitRefsPayload
): Promise<UpdateBenefitRefsResponse> {
  return request<UpdateBenefitRefsResponse>(
    `/content/tiltak/${tiltakId}/benefit-refs`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function upsertDictionaryEntry(
  payload: DictionaryMutationPayload,
  mode: "create" | "update"
): Promise<DictionaryMutationResponse> {
  if (mode === "create") {
    return request<DictionaryMutationResponse>("/dictionary/benefits", {
      method: "POST",
      body: JSON.stringify({ generation: payload.generation, benefit: payload.entry }),
    });
  }

  return request<DictionaryMutationResponse>(
    `/dictionary/benefits/${payload.entry.id}`,
    {
      method: "PUT",
      body: JSON.stringify({ generation: payload.generation, benefit: payload.entry }),
    }
  );
}

export async function deleteDictionaryEntry(
  benefitId: string,
  generation: string
): Promise<{ generation: string | null; deletedId: string }> {
  return request<{ generation: string | null; deletedId: string }>(
    `/dictionary/benefits/${benefitId}`,
    {
      method: "DELETE",
      body: JSON.stringify({ generation }),
    }
  );
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ADMIN_API_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers = new Headers(normaliseHeaders(options.headers));
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (ADMIN_USER_OVERRIDE && !headers.has("x-admin-user")) {
    headers.set("x-admin-user", ADMIN_USER_OVERRIDE);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    credentials: "same-origin",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function normaliseHeaders(input?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!input) {
    return result;
  }

  if (input instanceof Headers) {
    input.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  const entries = Array.isArray(input) ? input : Object.entries(input);
  for (const [key, value] of entries) {
    result[key] = value as string;
  }
  return result;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return `Forespørselen feilet med status ${response.status}`;
}
