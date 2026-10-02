"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { CATEGORY_LABEL, CATEGORY_TONE, fmtDate, getAnnouncement, type Announcement } from "@/lib/announcements";

/** Hiển thị nội dung dạng văn bản: dòng bắt đầu bằng "- " thành gạch đầu dòng, dòng "1. ..." / "Bước 1." thành tiêu đề nhỏ */
function Body({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isHeading = lines.length > 1 && /^(\d+\.|Bước \d+\.)\s/.test(lines[0].trim());
        const rest = isHeading ? lines.slice(1) : lines;
        const paragraphs = rest.filter((l) => !l.trim().startsWith("- "));
        const bullets = rest.filter((l) => l.trim().startsWith("- "));
        return (
          <div key={i}>
            {isHeading && <h3 className="mb-1 font-bold text-gray-900">{lines[0]}</h3>}
            {paragraphs.map((l, j) => (
              <p key={j}>{l}</p>
            ))}
            {bullets.length > 0 && (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {bullets.map((l, j) => (
                  <li key={j}>{l.trim().slice(2)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<Announcement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnnouncement(Number(id))
      .then(setA)
      .catch((e) => setError((e as { message?: string })?.message ?? "Không tải được thông báo."));
  }, [id]);

  return (
    <AppLayout allowGuest>
      <div className="mx-auto max-w-[760px]">
        <Link href="/announcements" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
          ← Tất cả thông báo
        </Link>
        {error ? (
          <Card className="mt-4 p-6 text-sm font-medium text-danger">{error}</Card>
        ) : !a ? (
          <div className="mt-4 h-96 animate-pulse rounded-card bg-gray-100" />
        ) : (
          <Card className="mt-4 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CATEGORY_TONE[a.category]}`}>{CATEGORY_LABEL[a.category]}</span>
              <span className="text-gray-400">Đăng ngày {fmtDate(a.publishedAt)}</span>
              {a.updatedAt && <span className="text-gray-400">· Cập nhật {fmtDate(a.updatedAt)}</span>}
            </div>
            <h1 className="mt-3 text-[22px] font-extrabold leading-snug text-gray-900">{a.title}</h1>
            {a.batch && (
              <p className="mt-2 text-sm text-gray-500">
                Đợt: <span className="font-semibold text-gray-700">{a.batch.batchName}</span>
              </p>
            )}
            <hr className="my-5 border-gray-100" />
            <Body text={a.content ?? a.excerpt} />
            <hr className="my-6 border-gray-100" />
            <p className="text-sm text-gray-500">
              Phòng Đào tạo Sau đại học — Trường Đại học An Giang
              {a.createdByName && <span className="block text-xs text-gray-400">Người đăng: {a.createdByName}</span>}
            </p>
            {a.batch && (
              <Link href="/announcements?tab=batches" className="mt-5 inline-block rounded-input bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-dark">
                Xem ngành, chỉ tiêu và hạn nộp →
              </Link>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
