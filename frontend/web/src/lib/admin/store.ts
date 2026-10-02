// ============================================================================
// "CSDL giả" cho chế độ MOCK: giữ trong bộ nhớ + lưu localStorage để thao tác
// duyệt/từ chối vẫn còn khi tải lại trang (demo trước hội đồng không bị mất).
// Khi nối Backend thật (USE_MOCK = false) file này không còn được dùng tới.
// ============================================================================
import { emitDataChange } from "./events";
import { createSeedDb, DB_VERSION } from "./mockData";
import type { AdminDb } from "./types";

const STORAGE_KEY = "admin_mock_db";

let db: AdminDb | null = null;
const listeners = new Set<() => void>();

function load(): AdminDb {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminDb;
        if (parsed.version === DB_VERSION) return parsed;
      }
    } catch {
      // dữ liệu hỏng -> tạo lại
    }
  }
  return createSeedDb();
}

function persist() {
  if (typeof window === "undefined" || !db) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // hết dung lượng / chế độ ẩn danh: vẫn chạy bình thường trong phiên
  }
}

export function getDb(): AdminDb {
  if (!db) {
    db = load();
    persist();
  }
  return db;
}

export function nextId(key: keyof AdminDb["seq"] | string): number {
  const d = getDb();
  const id = d.seq[key] ?? 1;
  d.seq[key] = id + 1;
  return id;
}

/** Ghi thay đổi rồi báo cho các màn hình đang mở cập nhật lại */
export function commit() {
  persist();
  listeners.forEach((l) => l());
  emitDataChange();
}

export function subscribeDb(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetDb() {
  db = createSeedDb();
  commit();
}
