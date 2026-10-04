/* eslint-disable no-console */
// Thông báo mẫu cho cổng Thí sinh: lấy thông tin thật từ các đợt tuyển sinh trong CSDL
// (tên đợt, thời gian, ngành, chỉ tiêu, căn cứ pháp lý) để nội dung khớp với dữ liệu.
import type { PrismaClient } from "@prisma/client";

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }) : "(sẽ thông báo sau)";
const fmtTime = (d: Date) =>
  d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function seedAnnouncements(prisma: PrismaClient): Promise<number> {
  if ((await prisma.announcement.count()) > 0) return 0;

  const author = await prisma.staff_account.findFirst({
    where: { status: "ACTIVE", staff_role: { some: { role: { role_code: "CAN_BO_TUYEN_SINH" } } } },
    orderBy: { staff_account_id: "asc" },
  });
  const cfg = Object.fromEntries((await prisma.system_config.findMany()).map((c) => [c.config_key, c.config_value]));
  const maxFileMb = Math.round(Number(cfg.MAX_FILE_KB ?? 5120) / 1024);
  const maxTotalMb = Math.round(Number(cfg.MAX_APPLICATION_FILES_KB ?? 30720) / 1024);
  const supplementDays = Number(cfg.SUPPLEMENT_DEFAULT_DAYS ?? 7);

  const batches = await prisma.admission_batch.findMany({
    where: { deleted_at: null },
    include: { admission_batch_major: { include: { admission_major: true }, orderBy: { batch_major_id: "asc" } } },
    orderBy: { registration_start_at: "desc" },
  });
  const openMaster = batches.find((b) => b.status === "OPEN" && b.degree_level === "THAC_SI");
  const openDoctor = batches.find((b) => b.status === "OPEN" && b.degree_level === "TIEN_SI");
  const reviewing = batches.find((b) => b.status === "IN_REVIEW");
  const draft = batches.find((b) => b.status === "DRAFT");

  type Item = { title: string; content: string; category: string; pinned?: boolean; batchId?: bigint; publishedAt: Date | null; status?: string };
  const items: Item[] = [];

  const majorsText = (b: (typeof batches)[number]) =>
    b.admission_batch_major.length
      ? b.admission_batch_major
          .map((m) => `- ${m.admission_major.major_name} (mã ${m.admission_major.major_code}${m.admission_major.faculty_name ? `, ${m.admission_major.faculty_name}` : ""}): ${m.quota} chỉ tiêu`)
          .join("\n")
      : "- Danh sách ngành sẽ được cập nhật trên cổng thông tin.";

  for (const b of [openMaster, openDoctor]) {
    if (!b) continue;
    const level = b.degree_level === "TIEN_SI" ? "tiến sĩ" : "thạc sĩ";
    items.push({
      title: `Thông báo ${b.batch_name.charAt(0).toLowerCase()}${b.batch_name.slice(1)}`,
      category: "TUYEN_SINH",
      pinned: true,
      batchId: b.batch_id,
      publishedAt: new Date(Math.min(Date.now(), b.registration_start_at.getTime() - 3 * 86_400_000)),
      content: `Trường Đại học An Giang thông báo ${b.batch_name.charAt(0).toLowerCase()}${b.batch_name.slice(1)} (mã đợt ${b.batch_code})${b.legal_basis ? `, căn cứ ${b.legal_basis}` : ""}.

1. Ngành và chỉ tiêu
${majorsText(b)}

2. Thời gian nhận hồ sơ
Từ ${fmtTime(b.registration_start_at)} đến ${fmtTime(b.registration_end_at)}. Hệ thống tự đóng cổng nộp hồ sơ khi hết hạn.
${b.exam_start_at ? `Thời gian thi tuyển/phỏng vấn dự kiến: từ ${fmt(b.exam_start_at)} đến ${fmt(b.exam_end_at)}.\n` : ""}
3. Hình thức nộp hồ sơ
Thí sinh đăng ký tài khoản trên Cổng thông tin tuyển sinh, khai thông tin cá nhân và quá trình đào tạo, tải lên bản scan minh chứng và nộp lệ phí xét tuyển trực tuyến. Nhà trường không nhận hồ sơ giấy ở giai đoạn này; bản chính được đối chiếu khi thí sinh trúng tuyển và nhập học.

4. Hồ sơ minh chứng gồm
- Văn bằng tốt nghiệp ${b.degree_level === "TIEN_SI" ? "thạc sĩ (hoặc đại học loại giỏi trở lên nếu xét chuyển tiếp)" : "đại học"} và bảng điểm
- Chứng chỉ hoặc minh chứng năng lực ngoại ngữ theo quy định
${b.degree_level === "TIEN_SI" ? "- Đề cương nghiên cứu (đề xuất nghiên cứu)\n- Thư giới thiệu của nhà khoa học\n- Danh mục công bố khoa học (nếu có)\n" : ""}- Giấy tờ khác theo yêu cầu của từng ngành (xem điều kiện chi tiết ở mục "Đợt đang mở đăng ký")

Mọi thắc mắc về tuyển sinh trình độ ${level}, thí sinh gửi qua mục Khiếu nại / Phúc khảo trên cổng hoặc liên hệ Phòng Đào tạo Sau đại học.`,
    });
  }

  items.push({
    title: "Quy định về tệp minh chứng nộp trực tuyến",
    category: "QUY_DINH",
    pinned: true,
    publishedAt: daysAgo(40),
    content: `Để hồ sơ được thẩm định nhanh, thí sinh lưu ý các quy định sau khi tải minh chứng lên hệ thống:

- Chỉ nhận tệp PDF, JPG hoặc PNG. Hệ thống kiểm tra nội dung tệp, đổi đuôi tệp sẽ bị từ chối.
- Mỗi tệp tối đa ${maxFileMb} MB; tổng dung lượng minh chứng của một hồ sơ tối đa ${maxTotalMb} MB.
- Bản scan phải rõ nét, đủ các trang, không bị cắt góc, không chỉnh sửa. Văn bằng nước ngoài cần kèm bản dịch công chứng và văn bản công nhận theo quy định.
- Mỗi loại minh chứng đặt đúng mục (Văn bằng, Bảng điểm, Chứng chỉ ngoại ngữ, ...). Tệp đặt sai mục có thể bị đánh dấu không hợp lệ.
- Thí sinh chịu trách nhiệm về tính trung thực của minh chứng. Hồ sơ phát hiện gian lận sẽ bị hủy kết quả xét tuyển ở bất kỳ giai đoạn nào.

Khi cán bộ đánh dấu một minh chứng không hợp lệ, thí sinh nhận thông báo kèm lý do trên cổng và qua email đã đăng ký.`,
  });

  items.push({
    title: "Hướng dẫn đăng ký tài khoản và nộp hồ sơ trực tuyến",
    category: "HUONG_DAN",
    publishedAt: daysAgo(38),
    content: `Bước 1. Đăng ký tài khoản
Vào trang Đăng ký, khai họ tên, ngày sinh, email (nên dùng Gmail), số điện thoại và đặt mật khẩu. Hệ thống gửi mã xác thực 6 số về email; nhập mã để kích hoạt tài khoản. Mã có hiệu lực trong vài phút, có thể bấm "Gửi lại mã" nếu chưa nhận được (kiểm tra cả thư mục Spam/Quảng cáo).

Bước 2. Hoàn thiện hồ sơ cá nhân
Vào mục Hồ sơ cá nhân, bổ sung số CCCD, giới tính, địa chỉ liên hệ. Thông tin phải khớp với giấy tờ tùy thân.

Bước 3. Tạo hồ sơ xét tuyển
Chọn đợt tuyển sinh đang mở và ngành đăng ký, khai quá trình đào tạo, tải minh chứng theo hướng dẫn rồi bấm Nộp hồ sơ.

Bước 4. Nộp lệ phí và theo dõi
Nộp lệ phí xét tuyển theo hướng dẫn trên cổng. Sau khi nộp, theo dõi trạng thái hồ sơ ở trang Tổng quan và mục Thông báo. Khi được yêu cầu bổ sung, thí sinh tải minh chứng thay thế và bấm "Nộp bổ sung" trước hạn.`,
  });

  items.push({
    title: "Quy định về yêu cầu bổ sung hồ sơ và phúc khảo",
    category: "QUY_DINH",
    publishedAt: daysAgo(35),
    content: `1. Bổ sung hồ sơ
Khi minh chứng chưa đạt yêu cầu, cán bộ tuyển sinh gửi yêu cầu bổ sung nêu rõ nội dung cần nộp và hạn chót (mặc định ${supplementDays} ngày kể từ ngày gửi yêu cầu). Quá hạn mà thí sinh chưa nộp bổ sung, hồ sơ có thể bị từ chối.

2. Phúc khảo điểm thi
Thí sinh có quyền đề nghị phúc khảo điểm thi trong thời hạn quy định sau khi công bố điểm. Đơn phúc khảo gửi trực tuyến tại mục Khiếu nại / Phúc khảo. Hội đồng tuyển sinh xem xét và trả lời kết quả trên cổng; điểm sau phúc khảo được dùng để xét tuyển.

3. Khiếu nại khác
Các khiếu nại về hồ sơ, kết quả xét tuyển gửi qua cùng mục, ghi rõ mã hồ sơ và nội dung. Nhà trường không giải quyết khiếu nại gửi sau thời hạn hoặc không có thông tin người gửi.`,
  });

  items.push({
    title: "Hướng dẫn nộp lệ phí xét tuyển trực tuyến",
    category: "HUONG_DAN",
    publishedAt: daysAgo(30),
    content: `Lệ phí xét tuyển được nộp sau khi thí sinh nộp hồ sơ trên cổng. Mức lệ phí áp dụng theo thông báo của từng đợt tuyển sinh.

- Hồ sơ chỉ được chuyển sang bước thẩm định khi lệ phí ở trạng thái "Đã thanh toán".
- Ghi đúng nội dung chuyển khoản theo hướng dẫn hiển thị trên cổng (gồm mã hồ sơ) để nhà trường đối soát.
- Lệ phí đã nộp không được hoàn lại, trừ trường hợp đợt tuyển sinh bị hủy.
- Nếu đã thanh toán nhưng trạng thái chưa cập nhật sau 1 ngày làm việc, thí sinh gửi khiếu nại kèm ảnh chụp biên lai.`,
  });

  if (reviewing) {
    items.push({
      title: `Thông báo tiến độ xét duyệt hồ sơ ${reviewing.batch_name.charAt(0).toLowerCase()}${reviewing.batch_name.slice(1)}`,
      category: "KET_QUA",
      batchId: reviewing.batch_id,
      publishedAt: daysAgo(6),
      content: `Đợt ${reviewing.batch_name} (mã ${reviewing.batch_code}) đã đóng cổng nhận hồ sơ ngày ${fmt(reviewing.registration_end_at)} và đang trong giai đoạn thẩm định, xét kết quả.

- Thí sinh theo dõi trạng thái hồ sơ tại trang Tổng quan. Hồ sơ cần bổ sung sẽ có thông báo riêng kèm hạn nộp.
- Kết quả xét tuyển được công bố trên cổng sau khi Hội đồng tuyển sinh và Lãnh đạo phê duyệt.
- Thí sinh trúng tuyển xác nhận nhập học trực tuyến và nộp bản chính minh chứng theo lịch được thông báo.`,
    });
  }

  if (draft) {
    items.push({
      title: `Dự kiến ${draft.batch_name.charAt(0).toLowerCase()}${draft.batch_name.slice(1)}`,
      category: "TUYEN_SINH",
      batchId: draft.batch_id,
      status: "DRAFT",
      publishedAt: null,
      content: `Bản nháp: Nhà trường dự kiến tổ chức ${draft.batch_name.charAt(0).toLowerCase()}${draft.batch_name.slice(1)}, nhận hồ sơ từ ${fmt(draft.registration_start_at)} đến ${fmt(draft.registration_end_at)}. Chỉ tiêu từng ngành sẽ công bố sau khi được Lãnh đạo phê duyệt.`,
    });
  }

  for (const it of items) {
    await prisma.announcement.create({
      data: {
        title: it.title.slice(0, 255),
        content: it.content,
        category: it.category,
        is_pinned: Boolean(it.pinned),
        batch_id: it.batchId ?? null,
        status: it.status ?? "PUBLISHED",
        published_at: it.publishedAt,
        created_by_staff_id: author?.staff_account_id ?? null,
        created_at: it.publishedAt ?? new Date(),
      },
    });
  }
  return items.length;
}
