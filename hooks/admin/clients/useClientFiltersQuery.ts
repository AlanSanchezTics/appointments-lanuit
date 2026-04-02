"use client";

import { useCallback, useEffect, useState } from "react";

type UseClientFiltersQueryInput = {
  query: string;
  onQueryChange: (query: string) => void;
};

const SEARCH_DEBOUNCE_MS = 350;

export function useClientFiltersQuery({
  query,
  onQueryChange,
}: UseClientFiltersQueryInput) {
  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    if (draftQuery === query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onQueryChange(draftQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [draftQuery, onQueryChange, query]);

  const handleQueryChange = useCallback((nextQuery: string) => {
    setDraftQuery(nextQuery);
  }, []);

  return {
    draftQuery,
    handleQueryChange,
  };
}
