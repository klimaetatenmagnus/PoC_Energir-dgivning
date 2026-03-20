import type {
  AdminBenefitDictionaryEntry,
  AdminDictionaryResponse,
  AdminFunFactDictionaryEntry,
  AdminGlossaryTermDictionaryEntry,
  AdminTiltakMetadata,
} from "../types";
import type { TiltakContent } from "../../../content/tiltak/schema";
import type { TilskuddContent } from "../../../content/tilskudd/schema";

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

export type FetchTiltakResponse = {
  tiltak: TiltakContent;
  generation: string | null;
  etag: string | null;
  hasDraft: boolean;
  source: "draft" | "published";
};

export type UpdateTiltakPayload = {
  tiltak: TiltakContent;
  generation: string;
  changeSummary?: string;
};

export type UpdateTiltakResponse = {
  id: string;
  path: string;
  tiltak: TiltakContent;
  metadata: TiltakContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft" | "published";
};

export type PublishTiltakResponse = {
  id: string;
  path: string;
  tiltak: TiltakContent;
  metadata: TiltakContent["metadata"];
  generation: string | null;
  message: string;
};

export type CreateTiltakPayload = {
  tiltak: TiltakContent;
  changeSummary?: string;
};

export type CreateTiltakResponse = {
  id: string;
  path: string;
  tiltak: TiltakContent;
  metadata: TiltakContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft";
};

export type DiscardDraftResponse = {
  id: string;
  message: string;
};

export type DeleteTiltakResponse = {
  id: string;
  message: string;
};

// Tilskudd types
export type FetchTilskuddResponse = {
  tilskudd: TilskuddContent;
  generation: string | null;
  etag: string | null;
  hasDraft: boolean;
  source: "draft" | "published";
};

export type UpdateTilskuddPayload = {
  tilskudd: TilskuddContent;
  generation: string;
  changeSummary?: string;
};

export type UpdateTilskuddResponse = {
  id: string;
  path: string;
  tilskudd: TilskuddContent;
  metadata: TilskuddContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft" | "published";
};

export type PublishTilskuddResponse = {
  id: string;
  path: string;
  tilskudd: TilskuddContent;
  metadata: TilskuddContent["metadata"];
  generation: string | null;
  message: string;
};

export type DiscardTilskuddDraftResponse = {
  id: string;
  message: string;
};

export type DeleteTilskuddResponse = {
  id: string;
  message: string;
};

export type CreateTilskuddPayload = {
  tilskudd: TilskuddContent;
  changeSummary?: string;
};

export type CreateTilskuddResponse = {
  id: string;
  path: string;
  tilskudd: TilskuddContent;
  metadata: TilskuddContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft";
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

export async function fetchTiltak(
  tiltakId: string
): Promise<FetchTiltakResponse> {
  return request<FetchTiltakResponse>(`/content/tiltak/${tiltakId}`);
}

export async function updateTiltak(
  tiltakId: string,
  payload: UpdateTiltakPayload
): Promise<UpdateTiltakResponse> {
  return request<UpdateTiltakResponse>(`/content/tiltak/${tiltakId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishTiltak(
  tiltakId: string
): Promise<PublishTiltakResponse> {
  return request<PublishTiltakResponse>(`/content/tiltak/${tiltakId}/publish`, {
    method: "POST",
  });
}

export async function discardTiltakDraft(
  tiltakId: string
): Promise<DiscardDraftResponse> {
  return request<DiscardDraftResponse>(`/content/tiltak/${tiltakId}/draft`, {
    method: "DELETE",
  });
}

export async function createTiltak(
  payload: CreateTiltakPayload
): Promise<CreateTiltakResponse> {
  return request<CreateTiltakResponse>("/content/tiltak", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTiltak(
  tiltakId: string
): Promise<DeleteTiltakResponse> {
  return request<DeleteTiltakResponse>(`/content/tiltak/${tiltakId}`, {
    method: "DELETE",
  });
}

// Tilskudd API functions
export async function fetchTilskudd(
  tilskuddId: string
): Promise<FetchTilskuddResponse> {
  return request<FetchTilskuddResponse>(`/content/tilskudd/${tilskuddId}`);
}

export async function updateTilskudd(
  tilskuddId: string,
  payload: UpdateTilskuddPayload
): Promise<UpdateTilskuddResponse> {
  return request<UpdateTilskuddResponse>(`/content/tilskudd/${tilskuddId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishTilskudd(
  tilskuddId: string
): Promise<PublishTilskuddResponse> {
  return request<PublishTilskuddResponse>(`/content/tilskudd/${tilskuddId}/publish`, {
    method: "POST",
  });
}

export async function discardTilskuddDraft(
  tilskuddId: string
): Promise<DiscardTilskuddDraftResponse> {
  return request<DiscardTilskuddDraftResponse>(`/content/tilskudd/${tilskuddId}/draft`, {
    method: "DELETE",
  });
}

export async function createTilskudd(
  payload: CreateTilskuddPayload
): Promise<CreateTilskuddResponse> {
  return request<CreateTilskuddResponse>("/content/tilskudd", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteTilskudd(
  tilskuddId: string
): Promise<DeleteTilskuddResponse> {
  return request<DeleteTilskuddResponse>(`/content/tilskudd/${tilskuddId}`, {
    method: "DELETE",
  });
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

// Glossary term mutations
type GlossaryTermMutationPayload = {
  entry: AdminGlossaryTermDictionaryEntry;
  generation: string;
};

export type GlossaryTermMutationResponse = {
  glossaryTerm: AdminGlossaryTermDictionaryEntry;
  generation: string | null;
};

export async function upsertGlossaryTerm(
  payload: GlossaryTermMutationPayload,
  mode: "create" | "update"
): Promise<GlossaryTermMutationResponse> {
  if (mode === "create") {
    return request<GlossaryTermMutationResponse>("/dictionary/glossary-terms", {
      method: "POST",
      body: JSON.stringify({ generation: payload.generation, glossaryTerm: payload.entry }),
    });
  }

  return request<GlossaryTermMutationResponse>(
    `/dictionary/glossary-terms/${payload.entry.id}`,
    {
      method: "PUT",
      body: JSON.stringify({ generation: payload.generation, glossaryTerm: payload.entry }),
    }
  );
}

export async function deleteGlossaryTerm(
  termId: string,
  generation: string
): Promise<{ generation: string | null; deletedId: string }> {
  return request<{ generation: string | null; deletedId: string }>(
    `/dictionary/glossary-terms/${termId}`,
    {
      method: "DELETE",
      body: JSON.stringify({ generation }),
    }
  );
}

// ===== FUN FACTS API =====

type FunFactMutationPayload = {
  entry: AdminFunFactDictionaryEntry;
  generation: string;
};

export type FunFactMutationResponse = {
  funFact: AdminFunFactDictionaryEntry;
  generation: string | null;
};

export async function upsertFunFact(
  payload: FunFactMutationPayload,
  mode: "create" | "update"
): Promise<FunFactMutationResponse> {
  if (mode === "create") {
    return request<FunFactMutationResponse>("/dictionary/fun-facts", {
      method: "POST",
      body: JSON.stringify({ generation: payload.generation, funFact: payload.entry }),
    });
  }

  return request<FunFactMutationResponse>(
    `/dictionary/fun-facts/${payload.entry.id}`,
    {
      method: "PUT",
      body: JSON.stringify({ generation: payload.generation, funFact: payload.entry }),
    }
  );
}

export async function deleteFunFact(
  factId: string,
  generation: string
): Promise<{ generation: string | null; deletedId: string }> {
  return request<{ generation: string | null; deletedId: string }>(
    `/dictionary/fun-facts/${factId}`,
    {
      method: "DELETE",
      body: JSON.stringify({ generation }),
    }
  );
}

// ===== DRAFTS API =====

export type DraftSummary = {
  id: string;
  collection: "tiltak" | "tilskudd";
  title: string;
  changeSummary?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type DraftsListResponse = {
  drafts: DraftSummary[];
  count: number;
};

export type SyncStagingResponse = {
  success: boolean;
  synced: Array<{ id: string; collection: "tiltak" | "tilskudd" }>;
  stagingUrl: string;
};

export type DiscardAllDraftsResponse = {
  success: boolean;
  discarded: Array<{ id: string; collection: "tiltak" | "tilskudd" }>;
  count: number;
  message: string;
};

export async function fetchDrafts(
  signal?: AbortSignal
): Promise<DraftsListResponse> {
  return request<DraftsListResponse>("/drafts", { signal });
}

export async function syncDraftsToStaging(): Promise<SyncStagingResponse> {
  return request<SyncStagingResponse>("/drafts/sync-staging", {
    method: "POST",
  });
}

export async function discardAllDrafts(): Promise<DiscardAllDraftsResponse> {
  return request<DiscardAllDraftsResponse>("/drafts/discard-all", {
    method: "DELETE",
  });
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
