import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";

/**
 * Chính sách bảo vệ dữ liệu cá nhân của Cổng tuyển sinh sau đại học.
 * Soạn theo Nghị định 13/2023/NĐ-CP. Nhà trường rà soát, điều chỉnh trước khi áp dụng chính thức.
 */
const SECTIONS: { title: string; body: (string | string[])[] }[] = [
  {
    title: "1. Đơn vị xử lý dữ liệu",
    body: ["Trường Đại học An Giang, Đại học Quốc gia TP. Hồ Chí Minh (đơn vị trực tiếp: Phòng Đào tạo Sau đại học) là bên kiểm soát và xử lý dữ liệu cá nhân thí sinh cung cấp trên Cổng tuyển sinh sau đại học."],
  },
  {
    title: "2. Dữ liệu được thu thập",
    body: [
      [
        "Tài khoản: email, số điện thoại, mật khẩu (chỉ lưu bản mã hóa một chiều, không ai đọc được mật khẩu gốc).",
        "Thông tin cá nhân: họ tên, ngày sinh, giới tính, số căn cước công dân, quốc tịch, địa chỉ liên hệ.",
        "Quá trình đào tạo và minh chứng: văn bằng, bảng điểm, chứng chỉ ngoại ngữ, ảnh, bản chụp căn cước, lý lịch, đề cương nghiên cứu và các tệp thí sinh tải lên.",
        "Thông tin lệ phí: số tiền, thời điểm nộp, số biên lai, mã giao dịch (không lưu số thẻ, mật khẩu hay thông tin đăng nhập ngân hàng).",
        "Kết quả xét tuyển: kết quả thẩm định, lịch phỏng vấn, điểm, phúc khảo, kết quả trúng tuyển, xác nhận nhập học.",
        "Nhật ký thao tác trên hệ thống phục vụ an toàn thông tin và giải quyết khiếu nại.",
      ],
    ],
  },
  {
    title: "3. Mục đích xử lý",
    body: [
      [
        "Tiếp nhận, thẩm định hồ sơ và tổ chức xét tuyển trình độ thạc sĩ, tiến sĩ.",
        "Liên hệ, gửi thông báo về hồ sơ, lịch thi, lịch phỏng vấn, kết quả qua cổng thông tin và email.",
        "Thu lệ phí và đối chiếu thanh toán.",
        "Công bố kết quả, ban hành quyết định trúng tuyển, làm thủ tục nhập học và chuyển dữ liệu học viên trúng tuyển sang bộ phận quản lý đào tạo.",
        "Giải quyết phúc khảo, khiếu nại; thống kê, báo cáo cơ quan quản lý theo quy định.",
      ],
      "Dữ liệu không được bán, không dùng cho quảng cáo và không dùng cho mục đích khác ngoài các mục đích trên.",
    ],
  },
  {
    title: "4. Ai được tiếp cận dữ liệu",
    body: [
      "Chỉ cán bộ được phân công (cán bộ tuyển sinh, hội đồng, tiểu ban xét tuyển, lãnh đạo) được xem phần dữ liệu cần cho nhiệm vụ của mình; mọi thao tác đều được ghi nhật ký. Dữ liệu chỉ được cung cấp cho cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.",
      "Khi bạn chọn đăng nhập bằng Google, hệ thống chỉ nhận họ tên và địa chỉ email từ Google. Email thông báo được gửi qua dịch vụ thư điện tử do Nhà trường sử dụng.",
    ],
  },
  {
    title: "5. Thời gian lưu trữ",
    body: ["Dữ liệu được lưu trong thời gian xét tuyển và sau đó theo thời hạn lưu trữ hồ sơ tuyển sinh của Nhà trường và quy định pháp luật về lưu trữ. Hết thời hạn, dữ liệu được hủy hoặc ẩn danh."],
  },
  {
    title: "6. Biện pháp bảo vệ",
    body: [
      "Mật khẩu được mã hóa một chiều; truy cập phân quyền theo vai trò; tài khoản bị khóa tạm thời khi đăng nhập sai nhiều lần; mã xác thực một lần có thời hạn; nhật ký thao tác không thể sửa từ giao diện; kết nối được mã hóa (HTTPS) khi vận hành chính thức; dữ liệu được sao lưu định kỳ.",
    ],
  },
  {
    title: "7. Quyền của thí sinh",
    body: [
      "Theo Nghị định 13/2023/NĐ-CP, bạn có quyền được biết về việc xử lý dữ liệu; đồng ý hoặc rút lại sự đồng ý; truy cập, chỉnh sửa dữ liệu; yêu cầu xóa hoặc hạn chế xử lý dữ liệu; phản đối việc xử lý; khiếu nại, tố cáo và yêu cầu bồi thường theo quy định.",
      [
        "Xem và sửa thông tin cá nhân tại trang Hồ sơ cá nhân (trừ thông tin đã khóa sau khi nộp hồ sơ).",
        "Gửi yêu cầu khác (truy cập, xóa, rút lại đồng ý...) tại mục Khiếu nại hoặc trực tiếp tại Phòng Đào tạo Sau đại học.",
      ],
      "Lưu ý: nếu rút lại sự đồng ý hoặc yêu cầu xóa dữ liệu khi đang xét tuyển, Nhà trường không thể tiếp tục xử lý hồ sơ của bạn. Dữ liệu mà pháp luật buộc phải lưu trữ (ví dụ hồ sơ trúng tuyển) được giữ theo thời hạn quy định.",
    ],
  },
  {
    title: "8. Liên hệ",
    body: ["Phòng Đào tạo Sau đại học, Trường Đại học An Giang, 18 Ung Văn Khiêm, Long Xuyên, An Giang — hoặc gửi yêu cầu tại mục Khiếu nại trên cổng thí sinh."],
  },
];

export default function PrivacyPage() {
  return (
    <AppLayout allowGuest>
      <div className="mx-auto max-w-[820px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Chính sách bảo vệ dữ liệu cá nhân</h1>
        <p className="mt-1 text-sm text-gray-500">Áp dụng cho Cổng tuyển sinh sau đại học — Trường Đại học An Giang, ĐHQG-HCM. Căn cứ Nghị định 13/2023/NĐ-CP ngày 17/4/2023 của Chính phủ về bảo vệ dữ liệu cá nhân.</p>
        <Card className="mt-6 space-y-6 p-6 sm:p-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-gray-900">{s.title}</h2>
              {s.body.map((b, i) =>
                Array.isArray(b) ? (
                  <ul key={i} className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700">
                    {b.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-gray-700">
                    {b}
                  </p>
                ),
              )}
            </section>
          ))}
          <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            Bằng việc tạo tài khoản (hoặc tiếp tục bằng Google), bạn xác nhận đã đọc và đồng ý với chính sách này. Thời điểm đồng ý được ghi nhận cùng tài khoản. Xem thêm{" "}
            <Link href="/announcements?category=QUY_DINH" className="font-semibold text-accent hover:underline">
              quy định tuyển sinh
            </Link>
            .
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
