// Báo cho các màn hình đang mở biết dữ liệu vừa thay đổi (sau khi duyệt, phân
// quyền…) để tự tải lại — dùng chung cho cả chế độ dữ liệu mẫu và API thật.
const listeners = new Set<() => void>();

export function onDataChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDataChange() {
  listeners.forEach((l) => l());
}
