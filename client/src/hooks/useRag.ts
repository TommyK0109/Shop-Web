import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { RagRequest } from "@storefront/shared";
import { getRagCapabilities, submitRag } from "../api/rag";

export function useRagCapabilities() {
  return useQuery({ queryKey: ["rag", "capabilities"], queryFn: getRagCapabilities, retry: false, staleTime: 30_000 });
}

export function useRag() {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ request, generate }: { request: RagRequest; generate: boolean }) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const result = await submitRag(request, generate, current.signal);
      current.signal.throwIfAborted();
      return result;
    },
  });
  return { ...mutation, cancel: () => controller.current?.abort() };
}
