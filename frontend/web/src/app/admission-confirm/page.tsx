"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Trang cũ (bản mẫu). Xác nhận nhập học nay nằm trong trang Hồ sơ xét tuyển
 * (mục "Quyết định trúng tuyển & nhập học") — chuyển thẳng sang đó để link cũ vẫn dùng được.
 */
export default function AdmissionConfirmRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/application");
  }, [router]);
  return <p className="p-10 text-center text-sm text-gray-500">Đang chuyển tới trang hồ sơ xét tuyển…</p>;
}
