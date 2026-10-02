"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onDataChange } from "./events";

/**
 * Tải dữ liệu bất đồng bộ + tự tải lại (không nháy màn hình) mỗi khi có thao
 * tác ghi thành công, để mọi khối trên màn hình luôn khớp nhau.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const callId = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++callId.current;
    if (!silent) setLoading(true);
    try {
      const res = await fnRef.current();
      if (id === callId.current) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (id === callId.current) setError((e as { message?: string })?.message ?? "Không tải được dữ liệu.");
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => onDataChange(() => run(true)), [run]);

  return { data, error, loading, reload: run };
}
