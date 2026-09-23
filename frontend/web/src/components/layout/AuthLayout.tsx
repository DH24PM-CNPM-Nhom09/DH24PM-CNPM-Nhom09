import { ReactNode } from "react";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* Left panel - branding */}
      <div className="relative flex min-h-[200px] w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 px-8 py-10 text-white md:min-h-screen md:w-[42%] md:px-14 md:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-extrabold">
            TS
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Tuyển Sinh Sau Đại Học</p>
            <p className="text-xs text-white/60">Trường Đại học An Giang</p>
          </div>
        </div>

        <div className="relative hidden md:block">
          <h1 className="text-[32px] font-extrabold leading-tight">
            Cổng thông tin
            <br />
            dành cho Thí sinh
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Nộp hồ sơ, theo dõi trạng thái xét tuyển, xác nhận nhập học và trao đổi với giảng viên
            hướng dẫn — tất cả trong một hệ thống duy nhất.
          </p>
        </div>

        <p className="relative hidden text-xs text-white/50 md:block">
          © {new Date().getFullYear()} Trường Đại học An Giang. Đã đăng ký bản quyền.
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full flex-1 items-center justify-center bg-white px-6 py-10 md:px-10">
        <div className="w-full max-w-[400px]">
          <h2 className="text-[26px] font-extrabold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
