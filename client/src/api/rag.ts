import { ragCapabilitiesSchema, ragResponseSchema, type RagRequest } from "@storefront/shared";
import { apiFetch } from "./client";

export async function getRagCapabilities() {
  return ragCapabilitiesSchema.parse(await apiFetch<unknown>("/rag/capabilities"));
}

export async function submitRag(request: RagRequest, generate: boolean, signal?: AbortSignal) {
  return ragResponseSchema.parse(await apiFetch<unknown>(`/rag/${generate ? "answer" : "search"}`, {
    method: "POST", body: request, signal,
  }));
}
