import { useState, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Non-sensitive view preferences survive route unmounts in the session's
// bounded memory cache. Auth changes clear this along with business queries.
export function useAdminViewState<T>(key: string, initial: T) {
  const client = useQueryClient();
  const cacheKey = ["admin-view", key];
  const [value, setValue] = useState<T>(() => client.getQueryData<T>(cacheKey) ?? initial);
  const update = (next: SetStateAction<T>) => {
    const current = client.getQueryData<T>(cacheKey) ?? value;
    const resolved = typeof next === "function" ? (next as (previous: T) => T)(current) : next;
    client.setQueryData(cacheKey, resolved);
    setValue(resolved);
  };
  return [value, update] as const;
}
