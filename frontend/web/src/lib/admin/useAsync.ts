"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { USE_MOCK } from "./api";
import { subscribeDb } from "./store";

/**
 * Tải dữ liệu bất đồng bộ + tự tải lại khi "CSDL giả" thay đổi (mock) để mọi
 * khối trên màn hình luôn khớp nhau sau mỗi thao tác. Khi dùng API thật, gọi
 * reload() sau thao tác ghi.
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

  useEffect(() => {
    if (!USE_MOCK) return;
    return subscribeDb(() => run(true));
  }, [run]);

  return { data, error, loading, reload: run };
}
