"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchAdminClientsByQuery } from "@/lib/admin/clients/api-client";
import type { AdminClientSearchItem } from "@/lib/admin/clients/types";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_LIMIT = 8;

type SearchStatus = "idle" | "debouncing" | "loading" | "results" | "empty" | "error";

type SearchClient = Pick<AdminClientSearchItem, "clientId" | "name" | "phone" | "clientNumber" | "isLoyal">;

function normalizeErrorCode(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "UNKNOWN_ERROR";
}

export function useGlobalClientSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchClient[]>([]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");

  const trimmedQuery = query.trim();
  const isDropdownOpen = status !== "idle" && status !== "debouncing";

  const resetSearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setQuery("");
    setResults([]);
    setErrorCode(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    resetSearch();
  }, [pathname, resetSearch]);

  useEffect(() => {
    abortRef.current?.abort();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setErrorCode(null);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let isActive = true;

    setResults([]);
    setErrorCode(null);
    setStatus("debouncing");

    const timeoutId = window.setTimeout(() => {
      if (!isActive || controller.signal.aborted) {
        return;
      }

      setStatus("loading");

      void searchAdminClientsByQuery(trimmedQuery, {
        limit: SEARCH_LIMIT,
        signal: controller.signal,
      })
        .then((response) => {
          if (!isActive || controller.signal.aborted) {
            return;
          }

          const nextResults = response.clients.slice(0, SEARCH_LIMIT);
          setResults(nextResults);
          setErrorCode(null);
          setStatus(nextResults.length > 0 ? "results" : "empty");
        })
        .catch((error) => {
          if (!isActive || controller.signal.aborted) {
            return;
          }

          setResults([]);
          setErrorCode(normalizeErrorCode(error));
          setStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trimmedQuery]);

  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
  }, []);

  const handleClearSearch = useCallback(() => {
    resetSearch();
  }, [resetSearch]);

  const handleSelectClient = useCallback(
    (clientId: number) => {
      resetSearch();
      setIsModalOpen(false);
      router.push(`/admin/clients/${clientId}`);
    },
    [resetSearch, router],
  );

  const handleOpenSearchModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseSearchModal = useCallback(() => {
    setIsModalOpen(false);
    resetSearch();
  }, [resetSearch]);

  return {
    isModalOpen,
    query,
    results,
    errorCode,
    status,
    isDropdownOpen,
    handleOpenSearchModal,
    handleCloseSearchModal,
    handleQueryChange,
    handleClearSearch,
    handleSelectClient,
  };
}
