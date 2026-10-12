"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "./useDebounce";
import { PaginationMeta } from "@/lib/pagination";

export interface TicketItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  category?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName: string; email: string } | null;
  assignedTo?: { id: string; fullName: string; email: string } | null;
}

export interface UseTicketSearchOptions {
  initialSearch?: string;
  initialStatus?: string;
  initialCategory?: string;
  initialAssignee?: string;
  initialPage?: number;
  initialLimit?: number;
  viewType?: string; // e.g. "my_tickets"
  debounceMs?: number;
}

export function useTicketSearch(options: UseTicketSearchOptions = {}) {
  const {
    initialSearch = "",
    initialStatus = "all",
    initialCategory = "all",
    initialAssignee = "all",
    initialPage = 1,
    initialLimit = 20,
    viewType,
    debounceMs = 350,
  } = options;

  const [searchTerm, setSearchTermState] = useState(initialSearch);
  const debouncedSearch = useDebounce(searchTerm, debounceMs);

  const [statusFilter, setStatusFilterState] = useState(initialStatus);
  const [categoryFilter, setCategoryFilterState] = useState(initialCategory);
  const [assigneeFilter, setAssigneeFilterState] = useState(initialAssignee);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(Math.min(initialLimit, 50));

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setters that reset page to 1 automatically
  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterState(status);
    setPage(1);
  }, []);

  const setCategoryFilter = useCallback((category: string) => {
    setCategoryFilterState(category);
    setPage(1);
  }, []);

  const setAssigneeFilter = useCallback((assignee: string) => {
    setAssigneeFilterState(assignee);
    setPage(1);
  }, []);

  // Fetch trigger counter for manual refetch
  const [refreshIndex, setRefreshIndex] = useState(0);
  const refetch = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Track active controller
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let isCurrent = true;

    const executeFetch = async () => {
      try {
        const params = new URLSearchParams();
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
        if (assigneeFilter && assigneeFilter !== "all") params.set("assignee", assigneeFilter);
        if (viewType) params.set("view", viewType);
        params.set("page", String(page));
        params.set("limit", String(limit));

        const res = await fetch(`/api/v1/tickets?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status}`);
        }

        const json = await res.json();

        if (isCurrent) {
          if (json.success) {
            setTickets(json.data || []);
            if (json.pagination) {
              setPagination(json.pagination);
            }
            setError(null);
          } else {
            setError(json.message || "Failed to load tickets");
          }
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (isCurrent) {
          setError(err instanceof Error ? err.message : "Error fetching tickets");
          setIsLoading(false);
        }
      }
    };

    // Execute asynchronously to avoid synchronous effect setState warnings
    Promise.resolve().then(() => {
      if (isCurrent) {
        setIsLoading(true);
        executeFetch();
      }
    });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [
    debouncedSearch,
    statusFilter,
    categoryFilter,
    assigneeFilter,
    page,
    limit,
    viewType,
    refreshIndex,
  ]);

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    assigneeFilter,
    setAssigneeFilter,
    page,
    setPage,
    limit,
    setLimit,
    tickets,
    pagination,
    isLoading,
    error,
    refetch,
  };
}
