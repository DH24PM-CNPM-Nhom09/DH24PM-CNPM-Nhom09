"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconPlus, IconX } from "@/components/admin/Icons";
import { MajorPicker, MajorProgress } from "@/components/admin/MajorPicker";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, Modal, Notice, PageHeader, Panel, Skeleton, Tag, useToast } from "@/components/admin/ui";
import {
  autoScheduleInterviews,
  getScoringOverview,
  publishScores,
  saveCommittee,
  saveScores,
  updateInterview,
  type CommitteeMember,
  type CommitteeRole,
  type ScoringCandidate,
  type ScoringMajor,
  type ScoringOverview,
} from "@/lib/admin/api";
import { errorMessage, fmtDate, fmtDateTime, toLocalInput } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const ROLE_LABEL: Record<CommitteeRole, string> = { CHU_TICH: "Chủ tịch", THU_KY: "Thư ký", UY_VIEN: "Ủy viên" };
const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));

/** Thứ 2 kế tiếp lúc 7:30 (giờ máy) — gợi ý giờ bắt đầu xếp lịch */
function nextMorning() {
  const d = new Date(Date.now() + 86_400_000);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(7, 30, 0, 0);
  return d;
}

type Tab = "committee" | "schedule" | "scores";

function MajorWork({ bm }: { bm: ScoringMajor }) {
  const { can } = useAdmin();
  const toast = useToast();
  const canManage = can("exam:manage");
  const canScore = can("score:enter");
  const ov = useAsync(() => getScoringOverview(bm.batchMajorId), [bm.batchMajorId]);
  const data = ov.data;
  const [tab, setTab] = useState<Tab>("committee");
  useEffect(() => {
    if (!data) return;
    // Mở sẵn bước đang cần làm
    setTab(!data.committee ? "committee" : data.hasInterview && data.stats.scheduled < data.stats.total ? "schedule" : "scores");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bm.batchMajorId, !!data]);

  if (ov.error) return <ErrorBox message={ov.error} onRetry={() => ov.reload()} />;
  if (!data) return <Skeleton className="h-72" />;

  const tabs: [Tab, string, boolean][] = [
    ["committee", "1. Tiểu ban xét tuyển", !!data.committee],
    ...(data.hasInterview ? ([["schedule", `2. Lịch ${data.interviewLabel.toLowerCase()}`, data.stats.total > 0 && data.stats.scheduled === data.stats.total]] as [Tab, string, boolean][]) : []),
    ["scores", `${data.hasInterview ? 3 : 2}. Nhập & công bố điểm`, !!data.scoresPublishedAt],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{data.major.majorName}</h2>
          <p className="text-[13px] text-gray-500">
            {data.batch.batchName} · chỉ tiêu {data.major.quota} · {data.stats.total} thí sinh đạt thẩm định ·{" "}
            {data.subjects.map((s) => `${s.subjectName} ${Math.round(s.weight * 100)}%`).join(", ")}
          </p>
        </div>
        {data.scoresPublishedAt && <Tag tone="green">Đã công bố điểm {fmtDateTime(data.scoresPublishedAt)}</Tag>}
      </div>
      {!data.scoringOpen && (
        <Notice>
          Đợt tuyển sinh đang ở trạng thái chưa cho phép xét tuyển. Chuyển đợt sang <b>Đóng đăng ký</b> ở trang{" "}
          <Link href="/admin/batches" className="font-semibold underline">
            Đợt tuyển sinh
          </Link>{" "}
          trước khi xếp lịch và nhập điểm.
        </Notice>
      )}
      {data.pendingReview > 0 && (
        <Notice>
          Còn <b>{data.pendingReview}</b> hồ sơ của ngành chưa thẩm định xong — các hồ sơ này chưa có trong danh sách xét tuyển và phải kết luận trước khi công bố điểm.
        </Notice>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Các bước xét tuyển">
        {tabs.map(([k, label, done]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${tab === k ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:text-gray-900"}`}
          >
            {label}
            {done && <span aria-label="đã xong">✓</span>}
          </button>
        ))}
      </div>

      {tab === "committee" && <CommitteeTab data={data} canManage={canManage} />}
      {tab === "schedule" && <ScheduleTab data={data} canManage={canManage} />}
      {tab === "scores" && (
        <ScoresTab
          data={data}
          canScore={canScore}
          canPublish={canManage}
          onPublished={(dl) => toast(`Đã công bố điểm và báo cho thí sinh. Hạn phúc khảo: ${fmtDateTime(dl)}.`)}
        />
      )}
    </div>
  );
}

// =============================================================================== tiểu ban
function CommitteeTab({ data, canManage }: { data: ScoringOverview; canManage: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ committeeName: "", decisionNo: "", formedAt: "", members: [] as CommitteeMember[] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = data.committee;
  const locked = !!data.scoresPublishedAt;

  function edit() {
    setErr("");
    setForm(
      c
        ? { committeeName: c.committeeName, decisionNo: c.decisionNo ?? "", formedAt: c.formedAt ?? "", members: c.members.map((m) => ({ ...m })) }
        : {
            committeeName: `Tiểu ban xét tuyển ${data.batch.degreeLevel === "TIEN_SI" ? "nghiên cứu sinh" : "thạc sĩ"} ngành ${data.major.majorName}`,
            decisionNo: "",
            formedAt: new Date().toISOString().slice(0, 10),
            members: [
              { fullName: "", lecturerCode: null, role: "CHU_TICH" },
              { fullName: "", lecturerCode: null, role: "THU_KY" },
              { fullName: "", lecturerCode: null, role: "UY_VIEN" },
            ],
          },
    );
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await saveCommittee(data.major.batchMajorId, form);
      toast("Đã lưu tiểu ban xét tuyển.");
      setOpen(false);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const setMember = (i: number, patch: Partial<CommitteeMember>) => setForm((f) => ({ ...f, members: f.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  return (
    <Panel
      title="Tiểu ban xét tuyển"
      action={
        canManage && !locked ? (
          <Btn size="sm" variant={c ? "outline" : "primary"} onClick={edit}>
            {c ? "Sửa tiểu ban" : "Lập tiểu ban"}
          </Btn>
        ) : undefined
      }
    >
      {!c ? (
        <EmptyState title="Chưa lập tiểu ban">Tiểu ban (ít nhất 3 người: 1 Chủ tịch, 1 Thư ký, các Ủy viên) chấm hồ sơ và {data.interviewLabel.toLowerCase()} của thí sinh ngành này.</EmptyState>
      ) : (
        <div>
          <p className="font-semibold text-gray-900">{c.committeeName}</p>
          <p className="text-[13px] text-gray-500">
            {c.decisionNo ? `Quyết định số ${c.decisionNo}` : "Chưa ghi số quyết định"}
            {c.formedAt ? ` · ngày ${fmtDate(c.formedAt)}` : ""}
          </p>
          <ul className="mt-3 divide-y divide-gray-100 rounded-input border border-gray-200">
            {c.members.map((m) => (
              <li key={m.memberId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">
                  {m.fullName}
                  {m.lecturerCode && <span className="ml-2 font-mono text-xs text-gray-500">{m.lecturerCode}</span>}
                </span>
                <Tag tone={m.role === "CHU_TICH" ? "navy" : m.role === "THU_KY" ? "blue" : "gray"}>{ROLE_LABEL[m.role]}</Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={c ? "Sửa tiểu ban xét tuyển" : "Lập tiểu ban xét tuyển"}
        width="max-w-2xl"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={save}>
              Lưu tiểu ban
            </Btn>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_150px]">
          <div className="sm:col-span-3">
            <Label htmlFor="cm-name" required>
              Tên tiểu ban
            </Label>
            <input id="cm-name" className={fieldCls} value={form.committeeName} maxLength={255} onChange={(e) => setForm({ ...form, committeeName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cm-no">Số quyết định thành lập</Label>
            <input id="cm-no" className={fieldCls} value={form.decisionNo} maxLength={50} placeholder="1234/QĐ-ĐHAG" onChange={(e) => setForm({ ...form, decisionNo: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cm-date">Ngày quyết định</Label>
            <input id="cm-date" type="date" className={fieldCls} value={form.formedAt} onChange={(e) => setForm({ ...form, formedAt: e.target.value })} />
          </div>
        </div>
        <p className="mb-2 mt-4 text-[13px] font-semibold text-gray-700">Thành viên</p>
        <div className="space-y-2">
          {form.members.map((m, i) => (
            <div key={i} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_36px]">
              <input className={fieldCls} placeholder="Học hàm, học vị, họ tên (ví dụ: PGS.TS Nguyễn Văn A)" value={m.fullName} aria-label={`Họ tên thành viên ${i + 1}`} onChange={(e) => setMember(i, { fullName: e.target.value })} />
              <input className={fieldCls} placeholder="Mã giảng viên" value={m.lecturerCode ?? ""} aria-label={`Mã giảng viên thành viên ${i + 1}`} onChange={(e) => setMember(i, { lecturerCode: e.target.value || null })} />
              <select className={fieldCls} value={m.role} aria-label={`Vai trò thành viên ${i + 1}`} onChange={(e) => setMember(i, { role: e.target.value as CommitteeRole })}>
                {(Object.keys(ROLE_LABEL) as CommitteeRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Bỏ thành viên ${i + 1}`} onClick={() => setForm((f) => ({ ...f, members: f.members.filter((_, j) => j !== i) }))}>
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline" onClick={() => setForm((f) => ({ ...f, members: [...f.members, { fullName: "", lecturerCode: null, role: "UY_VIEN" }] }))}>
          <IconPlus size={14} /> Thêm thành viên
        </button>
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>
    </Panel>
  );
}

// =============================================================================== lịch
function ScheduleTab({ data, canManage }: { data: ScoringOverview; canManage: boolean }) {
  const toast = useToast();
  const [auto, setAuto] = useState(false);
  const [form, setForm] = useState({ startAt: "", minutes: data.defaults.interviewMinutes, location: "" });
  const [edit, setEdit] = useState<ScoringCandidate | null>(null);
  const [editForm, setEditForm] = useState({ scheduledAt: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const unscheduled = data.candidates.filter((c) => !c.interview).length;
  const locked = !!data.scoresPublishedAt;
  const list = [...data.candidates].sort((a, b) => (a.interview?.scheduledAt ?? "9").localeCompare(b.interview?.scheduledAt ?? "9"));

  async function runAuto() {
    setBusy(true);
    setErr("");
    try {
      const r = await autoScheduleInterviews(data.major.batchMajorId, { ...form, startAt: new Date(form.startAt).toISOString(), minutes: Number(form.minutes) });
      toast(r.scheduled ? `Đã xếp lịch ${r.scheduled} thí sinh và gửi thông báo.` : "Không còn thí sinh nào cần xếp lịch.");
      setAuto(false);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit() {
    if (!edit?.interview) return;
    setBusy(true);
    setErr("");
    try {
      await updateInterview(edit.interview.scheduleId, { scheduledAt: new Date(editForm.scheduledAt).toISOString(), location: editForm.location });
      toast(`Đã đổi lịch của ${edit.fullName} và báo cho thí sinh.`);
      setEdit(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={`Lịch ${data.interviewLabel.toLowerCase()} (${data.stats.scheduled}/${data.stats.total})`}
      bodyClass=""
      action={
        <div className="flex flex-wrap gap-2">
          {data.stats.scheduled > 0 && (
            <Link href={`/admin/interview-print?bm=${data.major.batchMajorId}`} target="_blank">
              <Btn size="sm">In lịch &amp; phiếu chấm</Btn>
            </Link>
          )}
          {canManage && !locked && unscheduled > 0 && (
            <Btn
              size="sm"
              variant="primary"
              disabled={!data.committee || !data.scoringOpen}
              title={!data.committee ? "Lập tiểu ban trước" : !data.scoringOpen ? "Đợt chưa đóng đăng ký" : undefined}
              onClick={() => {
                setErr("");
                setForm({ startAt: toLocalInput(nextMorning()), minutes: data.defaults.interviewMinutes, location: "" });
                setAuto(true);
              }}
            >
              Xếp lịch tự động ({unscheduled})
            </Btn>
          )}
        </div>
      }
    >
      {data.candidates.length === 0 ? (
        <EmptyState title="Chưa có thí sinh đạt thẩm định" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Thời gian</th>
                <th className="px-4 py-2.5">Thí sinh</th>
                <th className="px-4 py-2.5">Địa điểm / đường dẫn</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((c) => (
                <tr key={c.applicationId}>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{c.interview ? fmtDateTime(c.interview.scheduledAt) : <span className="text-gray-400">Chưa xếp</span>}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/applications/${c.applicationId}`} className="font-semibold text-gray-900 hover:text-accent hover:underline">
                      {c.fullName}
                    </Link>
                    <span className="block font-mono text-xs text-gray-500">{c.applicationCode}</span>
                    {c.researchTopic && <span className="block max-w-[46ch] truncate text-xs text-gray-500" title={c.researchTopic}>Đề cương: {c.researchTopic}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.interview?.location ?? ""}</td>
                  <td className="px-4 py-2.5">{c.interview ? c.interview.status === "COMPLETED" ? <Tag tone="green">Đã chấm</Tag> : <Tag tone="blue">Đã báo lịch</Tag> : <Tag tone="gray">Chưa xếp</Tag>}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canManage && !locked && c.interview?.status === "SCHEDULED" && (
                      <Btn
                        size="sm"
                        onClick={() => {
                          setErr("");
                          setEditForm({ scheduledAt: toLocalInput(new Date(c.interview!.scheduledAt)), location: c.interview!.location ?? "" });
                          setEdit(c);
                        }}
                      >
                        Đổi lịch
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={auto}
        onClose={() => setAuto(false)}
        title={`Xếp lịch ${data.interviewLabel.toLowerCase()}`}
        description="Hệ thống xếp lần lượt theo mã hồ sơ, chỉ trong giờ hành chính (sáng 7:30–11:30, chiều 13:30–17:00, nghỉ Chủ nhật) và gửi lịch cho từng thí sinh."
        footer={
          <>
            <Btn onClick={() => setAuto(false)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={runAuto}>
              Xếp lịch và gửi thông báo
            </Btn>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="sc-start" required>
              Bắt đầu từ
            </Label>
            <input id="sc-start" type="datetime-local" className={fieldCls} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="sc-min" required>
              Mỗi lượt (phút)
            </Label>
            <input id="sc-min" type="number" min={5} max={120} className={fieldCls} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sc-loc" required>
              Địa điểm hoặc đường dẫn họp trực tuyến
            </Label>
            <input id="sc-loc" className={fieldCls} value={form.location} maxLength={500} placeholder="Phòng họp C1-201, Trường Đại học An Giang" onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
        </div>
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Đổi lịch — ${edit.fullName}` : ""}
        description="Thí sinh nhận thông báo lịch mới."
        footer={
          <>
            <Btn onClick={() => setEdit(null)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={saveEdit}>
              Lưu
            </Btn>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ed-time" required>
              Thời gian
            </Label>
            <input id="ed-time" type="datetime-local" className={fieldCls} value={editForm.scheduledAt} onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ed-loc" required>
              Địa điểm / đường dẫn
            </Label>
            <input id="ed-loc" className={fieldCls} value={editForm.location} maxLength={500} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          </div>
        </div>
        {err && (
          <div className="mt-3">
            <ErrorBox message={err} />
          </div>
        )}
      </Modal>
    </Panel>
  );
}

// =============================================================================== điểm
type Cell = { score: string; absent: boolean };

function ScoresTab({ data, canScore, canPublish, onPublished }: { data: ScoringOverview; canScore: boolean; canPublish: boolean; onPublished: (deadline: string) => void }) {
  const toast = useToast();
  const locked = !!data.scoresPublishedAt;
  const initial = useMemo(() => {
    const m: Record<string, Cell> = {};
    data.candidates.forEach((c) =>
      data.subjects.forEach((s) => {
        const v = c.scores[s.subjectId];
        m[`${c.applicationId}:${s.subjectId}`] = { score: v && !v.absent ? String(v.score).replace(".", ",") : "", absent: !!v?.absent };
      }),
    );
    return m;
  }, [data]);
  const [cells, setCells] = useState(initial);
  useEffect(() => setCells(initial), [initial]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const now = Date.now();
  const editable = canScore && !locked && data.scoringOpen;

  const dirty = Object.keys(cells).filter((k) => cells[k].score !== initial[k].score || cells[k].absent !== initial[k].absent);
  const parse = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const liveTotal = (c: ScoringCandidate) => {
    let t = 0;
    for (const s of data.subjects) {
      const v = cells[`${c.applicationId}:${s.subjectId}`];
      const n = v?.absent ? 0 : parse(v?.score ?? "");
      if (n === null || Number.isNaN(n)) return null;
      t += n * s.weight;
    }
    return Math.round(t * 100) / 100;
  };
  const complete = data.candidates.filter((c) => liveTotal(c) !== null).length;

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const items = dirty.map((k) => {
        const [applicationId, subjectId] = k.split(":").map(Number);
        const v = cells[k];
        return { applicationId, subjectId, score: v.absent ? null : parse(v.score), absent: v.absent };
      });
      const r = await saveScores(data.major.batchMajorId, items);
      toast(r.changed ? `Đã lưu ${r.changed} điểm thành phần.` : "Không có thay đổi.");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setErr("");
    try {
      const r = await publishScores(data.major.batchMajorId);
      setConfirmPublish(false);
      onPublished(r.appealDeadline);
    } catch (e) {
      setErr(errorMessage(e));
      setConfirmPublish(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title={`Bảng điểm xét tuyển (${complete}/${data.candidates.length} đủ điểm)`}
      bodyClass=""
      action={
        !locked ? (
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Btn size="sm" variant="navy" loading={busy && !confirmPublish} disabled={!dirty.length} onClick={save}>
                Lưu điểm{dirty.length ? ` (${dirty.length})` : ""}
              </Btn>
            )}
            {canPublish && (
              <Btn size="sm" variant="primary" disabled={!!dirty.length || complete < data.candidates.length || !data.candidates.length || data.pendingReview > 0} title={dirty.length ? "Lưu điểm trước" : complete < data.candidates.length ? "Còn thí sinh chưa đủ điểm" : undefined} onClick={() => setConfirmPublish(true)}>
                Công bố điểm
              </Btn>
            )}
          </div>
        ) : undefined
      }
    >
      {locked && (
        <div className="border-b border-gray-100 px-5 py-3">
          <Notice tone="blue">
            Điểm đã công bố ngày {fmtDateTime(data.scoresPublishedAt)}. Hạn phúc khảo: <b>{fmtDateTime(data.appealDeadline)}</b>. Điểm chỉ thay đổi qua{" "}
            <Link href="/admin/appeals" className="font-semibold underline">
              Phúc khảo
            </Link>
            .
          </Notice>
        </div>
      )}
      {err && (
        <div className="border-b border-gray-100 px-5 py-3">
          <ErrorBox message={err} />
        </div>
      )}
      {data.candidates.length === 0 ? (
        <EmptyState title="Chưa có thí sinh đạt thẩm định" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Thí sinh</th>
                {data.subjects.map((s) => (
                  <th key={s.subjectId} className="px-3 py-2.5">
                    {s.subjectName}
                    <span className="block font-normal text-gray-400">
                      {s.examFormatLabel} · hệ số {s.weight} · thang {s.maxScore}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right">Tổng (thang 10)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.candidates.map((c) => {
                const total = liveTotal(c);
                return (
                  <tr key={c.applicationId}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-gray-900">{c.fullName}</span>
                      <span className="block font-mono text-xs text-gray-500">{c.applicationCode}</span>
                      {c.appeal && <Tag tone="amber">Có đơn phúc khảo</Tag>}
                    </td>
                    {data.subjects.map((s) => {
                      const key = `${c.applicationId}:${s.subjectId}`;
                      const v = cells[key];
                      const isInterview = s.examFormat === "PHONG_VAN";
                      const notYet = isInterview && (!c.interview || new Date(c.interview.scheduledAt).getTime() > now);
                      const canAbsent = s.examFormat !== "XET_HO_SO";
                      if (!editable)
                        return (
                          <td key={s.subjectId} className="px-3 py-2.5 tabular-nums">
                            {v.absent ? <Tag tone="red">Vắng</Tag> : fmtScore(parse(v.score))}
                          </td>
                        );
                      return (
                        <td key={s.subjectId} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              className={`w-20 rounded-input border px-2 py-1.5 text-[13px] tabular-nums ${v.score !== initial[key].score ? "border-accent bg-accent-50" : "border-gray-300"}`}
                              inputMode="decimal"
                              placeholder={notYet ? "Chưa đến giờ" : "0–" + s.maxScore}
                              disabled={v.absent || notYet}
                              value={v.score}
                              aria-label={`${s.subjectName} của ${c.fullName}`}
                              onChange={(e) => setCells((m) => ({ ...m, [key]: { ...v, score: e.target.value.replace(/[^\d.,]/g, "") } }))}
                            />
                            {canAbsent && (
                              <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input type="checkbox" className="h-3.5 w-3.5 accent-[#B91C1C]" disabled={notYet} checked={v.absent} onChange={(e) => setCells((m) => ({ ...m, [key]: { score: "", absent: e.target.checked } }))} />
                                Vắng
                              </label>
                            )}
                          </div>
                          {notYet && c.interview && <span className="mt-0.5 block text-[11px] text-gray-400">Lịch: {fmtDateTime(c.interview.scheduledAt)}</span>}
                          {notYet && !c.interview && <span className="mt-0.5 block text-[11px] text-gray-400">Chưa xếp lịch</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right text-base font-bold tabular-nums text-gray-900">{fmtScore(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!locked && (
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
          Tổng điểm = Σ (điểm × hệ số). Thí sinh vắng mặt ở phần phỏng vấn / trình bày nhận 0 điểm phần đó và không được xét trúng tuyển. Công bố điểm khi đã đủ điểm mọi thí sinh; sau đó thí sinh có {data.defaults.appealWindowDays} ngày để phúc khảo.
        </p>
      )}

      <Modal
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title="Công bố điểm cho thí sinh?"
        description={`${data.candidates.length} thí sinh ngành ${data.major.majorName} sẽ nhận điểm từng phần và tổng điểm qua thông báo + email, kèm hạn phúc khảo ${data.defaults.appealWindowDays} ngày. Sau khi công bố, điểm chỉ thay đổi qua phúc khảo.`}
        footer={
          <>
            <Btn onClick={() => setConfirmPublish(false)}>Hủy</Btn>
            <Btn variant="primary" loading={busy} onClick={publish}>
              Công bố điểm
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">Kiểm tra lại bảng điểm trước khi công bố.</p>
      </Modal>
    </Panel>
  );
}

function Inner() {
  return (
    <>
      <PageHeader
        title="Tổ chức xét tuyển"
        description="Theo từng ngành của đợt: lập tiểu ban, xếp lịch phỏng vấn (thạc sĩ) hoặc trình bày đề cương (tiến sĩ), nhập điểm các hình thức xét và công bố điểm để thí sinh phúc khảo. Chỉ hồ sơ đã “Đạt” thẩm định mới vào danh sách."
      />
      <MajorPicker summary={(m) => <MajorProgress m={m} />}>{(bm) => <MajorWork key={bm.batchMajorId} bm={bm} />}</MajorPicker>
    </>
  );
}

export default function ScoringPage() {
  return (
    <RequirePermission perm={["exam:manage", "score:enter"]}>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </RequirePermission>
  );
}
