"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout, { notifyNotificationsChanged } from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import {
  CATEGORY_LABEL,
  CATEGORY_TONE,
  EXAM_FORMAT_LABEL,
  fmtDate,
  fmtDateTime,
  getAnnouncements,
  getOpenBatches,
  timeLeft,
  type Announcement,
  type AnnouncementCategory,
  type OpenBatch,
} from "@/lib/announcements";
import { getMyNotifications, isLoggedIn, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { CandidateNotification } from "@/lib/types";

type Tab = "news" | "batches" | "mine";
const CATS: ("" | AnnouncementCategory)[] = ["", "TUYEN_SINH", "QUY_DINH", "HUONG_DAN", "KET_QUA"];

function errText(e: unknown) {
  return (e as { message?: string })?.message ?? "Không tải được dữ liệu.";
}

function NewsTab({ initialCategory }: { initialCategory: "" | AnnouncementCategory }) {
  const [category, setCategory] = useState<"" | AnnouncementCategory>(initialCategory);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Announcement[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const pageSize = 10;

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setError("");
    getAnnouncements({ category, q, page, pageSize })
      .then(setData)
      .catch((e) => setError(errText(e)));
  }, [category, q, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Lọc theo loại thông báo">
          {CATS.map((c) => (
            <button
              key={c || "all"}
              role="tab"
              aria-selected={category === c}
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                category === c ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {c ? CATEGORY_LABEL[c] : "Tất cả"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm thông báo…"
          aria-label="Tìm thông báo"
          className="w-full rounded-input border border-gray-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-accent sm:w-64"
        />
      </div>

      {error && <Card className="mt-4 p-5 text-sm font-medium text-danger">{error}</Card>}

      <div className="mt-4 flex flex-col gap-3">
        {!data && !error
          ? [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-card bg-gray-100" />)
          : data?.items.length === 0
            ? <Card className="p-8 text-center text-sm text-gray-500">Chưa có thông báo nào{category ? ` thuộc mục “${CATEGORY_LABEL[category]}”` : ""}.</Card>
            : data?.items.map((a) => (
                <Link key={a.announcementId} href={`/announcements/${a.announcementId}`} className="group block">
                  <Card className="p-5 transition-colors group-hover:border-gray-300">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {a.isPinned && <span className="font-bold text-accent">📌 Ghim</span>}
                      <span className={`rounded-full px-2.5 py-0.5 font-semibold ${CATEGORY_TONE[a.category]}`}>{CATEGORY_LABEL[a.category]}</span>
                      <span className="text-gray-400">{fmtDate(a.publishedAt)}</span>
                      {a.batch && <span className="text-gray-400">· {a.batch.batchName}</span>}
                    </div>
                    <h3 className="mt-2 text-base font-bold leading-snug text-gray-900 group-hover:text-accent">{a.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">{a.excerpt}</p>
                  </Card>
                </Link>
              ))}
      </div>

      {data && pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-input border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
            ← Trước
          </button>
          <span className="text-gray-500">
            Trang {page}/{pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-input border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">
            Sau →
          </button>
        </div>
      )}
    </>
  );
}

function BatchesTab({ loggedIn }: { loggedIn: boolean }) {
  const [batches, setBatches] = useState<OpenBatch[] | null>(null);
  const [error, setError] = useState("");
  const [openMajor, setOpenMajor] = useState<number | null>(null);

  useEffect(() => {
    getOpenBatches()
      .then(setBatches)
      .catch((e) => setError(errText(e)));
  }, []);

  if (error) return <Card className="p-5 text-sm font-medium text-danger">{error}</Card>;
  if (!batches) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />;
  if (!batches.length) return <Card className="p-8 text-center text-sm text-gray-500">Hiện chưa có đợt tuyển sinh nào đang mở đăng ký. Theo dõi mục Thông báo để cập nhật lịch mới.</Card>;

  return (
    <div className="flex flex-col gap-5">
      {batches.map((b) => {
        const left = timeLeft(b.registrationEndAt);
        const urgent = new Date(b.registrationEndAt).getTime() - Date.now() < 7 * 86_400_000;
        return (
          <Card key={b.batchId} className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-navy-50/60 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-800">
                  {b.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"} · {b.batchCode}
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-gray-900">{b.batchName}</h3>
                <p className="mt-1 text-[13px] text-gray-500">
                  Nhận hồ sơ: {fmtDateTime(b.registrationStartAt)} – {fmtDateTime(b.registrationEndAt)}
                  {b.examStartAt && <> · Thi/phỏng vấn dự kiến: {fmtDate(b.examStartAt)}</>}
                </p>
                {b.legalBasis && <p className="mt-0.5 text-xs text-gray-400">Căn cứ: {b.legalBasis}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${urgent ? "bg-danger-50 text-danger" : "bg-success-50 text-[#166534]"}`}>Hạn nộp: {left}</span>
                <Link
                  href={loggedIn ? `/application/new?batch=${b.batchId}` : "/register"}
                  className="rounded-input bg-accent px-4 py-2 text-[13px] font-bold text-white hover:bg-accent-dark"
                >
                  {loggedIn ? "Nộp hồ sơ đợt này" : "Đăng ký để nộp hồ sơ"}
                </Link>
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {b.majors.map((m) => {
                const expanded = openMajor === m.batchMajorId;
                return (
                  <li key={m.batchMajorId}>
                    <button
                      onClick={() => setOpenMajor(expanded ? null : m.batchMajorId)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50"
                    >
                      <span>
                        <span className="block text-sm font-bold text-gray-900">{m.majorName}</span>
                        <span className="text-xs text-gray-400">
                          Mã {m.majorCode}
                          {m.facultyName && ` · ${m.facultyName}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-bold text-navy-800">{m.quota} chỉ tiêu</span>
                        <span className="text-gray-400" aria-hidden="true">
                          {expanded ? "▴" : "▾"}
                        </span>
                      </span>
                    </button>
                    {expanded && (
                      <div className="grid gap-4 bg-gray-50 px-5 pb-5 pt-1 text-[13px] sm:grid-cols-2">
                        <div>
                          <p className="mb-1.5 font-bold text-gray-700">Điều kiện dự tuyển</p>
                          {m.conditions.length ? (
                            <ul className="list-disc space-y-1 pl-4 text-gray-600">
                              {m.conditions.map((c, i) => (
                                <li key={i}>
                                  {c.description}
                                  {c.minGpa !== null && ` (điểm TB tối thiểu ${c.minGpa})`}
                                  {c.requiredCertificate && ` — ${c.requiredCertificate}`}
                                  {!c.isMandatory && <span className="text-gray-400"> (ưu tiên)</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-400">Xem thông báo tuyển sinh của đợt.</p>
                          )}
                        </div>
                        <div>
                          <p className="mb-1.5 font-bold text-gray-700">Hình thức xét tuyển</p>
                          {m.subjects.length ? (
                            <ul className="space-y-1 text-gray-600">
                              {m.subjects.map((s, i) => (
                                <li key={i} className="flex justify-between gap-3">
                                  <span>
                                    {s.subjectName} <span className="text-gray-400">({EXAM_FORMAT_LABEL[s.examFormat] ?? s.examFormat})</span>
                                  </span>
                                  {s.weight !== null && <span className="font-semibold tabular-nums">{Math.round(s.weight * 100)}%</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-400">Đang cập nhật.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function MineTab() {
  const [list, setList] = useState<CandidateNotification[] | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    getMyNotifications()
      .then(setList)
      .catch((e) => setError(errText(e)));
  useEffect(() => {
    load();
  }, []);

  async function readOne(n: CandidateNotification) {
    if (n.readAt) return;
    setList((xs) => xs?.map((x) => (x.notificationId === n.notificationId ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    await markNotificationRead(n.notificationId).catch(() => undefined);
    notifyNotificationsChanged();
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => undefined);
    await load();
    notifyNotificationsChanged();
  }

  if (error) return <Card className="p-5 text-sm font-medium text-danger">{error}</Card>;
  if (!list) return <div className="h-48 animate-pulse rounded-card bg-gray-100" />;
  const unread = list.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{unread ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết thông báo."}</p>
        {unread > 0 && (
          <button onClick={readAll} className="text-[13px] font-semibold text-accent hover:underline">
            Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">Chưa có thông báo nào về hồ sơ của bạn. Khi cán bộ xử lý hồ sơ, thông báo sẽ hiện ở đây và gửi về email.</Card>
      ) : (
        <Card className="divide-y divide-gray-100">
          {list.map((n) => (
            <button key={n.notificationId} onClick={() => readOne(n)} className={`flex w-full gap-3 px-5 py-4 text-left ${n.readAt ? "" : "bg-accent-50/40"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block text-sm ${n.readAt ? "font-semibold text-gray-700" : "font-bold text-gray-900"}`}>{n.title ?? "Thông báo"}</span>
                <span className="mt-0.5 block whitespace-pre-line text-[13px] leading-relaxed text-gray-500">{n.content}</span>
                <span className="mt-1 block text-xs text-gray-400">
                  {fmtDateTime(n.createdAt)}
                  {!n.readAt && <span className="sr-only"> — chưa đọc</span>}
                </span>
              </span>
            </button>
          ))}
        </Card>
      )}
    </>
  );
}

function AnnouncementsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const initialTab = (params.get("tab") as Tab) || "news";
  const [tab, setTab] = useState<Tab>(["news", "batches", "mine"].includes(initialTab) ? initialTab : "news");
  const cat = params.get("category") as AnnouncementCategory | null;

  useEffect(() => setLoggedIn(isLoggedIn()), []);

  function go(t: Tab) {
    setTab(t);
    router.replace(t === "news" ? "/announcements" : `/announcements?tab=${t}`, { scroll: false });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "news", label: "Thông báo & quy định" },
    { id: "batches", label: "Đợt đang mở đăng ký" },
    ...(loggedIn ? [{ id: "mine" as Tab, label: "Thông báo của tôi" }] : []),
  ];

  return (
    <AppLayout allowGuest>
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Thông báo</h1>
        <p className="mt-1 text-sm text-gray-500">Thông báo tuyển sinh, quy định và hướng dẫn của Phòng Đào tạo Sau đại học, Trường Đại học An Giang.</p>

        <div className="mt-6 flex gap-1 border-b border-gray-200" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => go(t.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 ${
                tab === t.id ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "news" && <NewsTab initialCategory={cat && cat in CATEGORY_LABEL ? cat : ""} />}
          {tab === "batches" && <BatchesTab loggedIn={loggedIn} />}
          {tab === "mine" && loggedIn && <MineTab />}
        </div>
      </div>
    </AppLayout>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={null}>
      <AnnouncementsInner />
    </Suspense>
  );
}
