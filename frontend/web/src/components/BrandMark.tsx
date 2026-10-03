import { useId } from "react";

/**
 * Biểu trưng của Cổng Tuyển sinh Sau đại học: mũ tốt nghiệp trên quyển sách mở.
 * Cùng hình với favicon (src/app/icon.svg). Trên nền tối dùng bản nền trắng, mũ xanh navy cho nổi.
 */
export default function BrandMark({ size = 40, onDark = false, className = "" }: { size?: number; onDark?: boolean; className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Biểu trưng Tuyển sinh Sau đại học"
      className={`shrink-0 ${onDark ? "drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]" : ""} ${className}`}
    >
      <defs>
        <linearGradient id={`bg${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#21497D" />
          <stop offset="1" stopColor="#142B4D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={onDark ? "#FFFFFF" : `url(#bg${gid})`} />
      <path d="M11 39.5c7-2.6 14-1.9 20.2 2.2v13.1c-6.2-4-13.2-4.7-20.2-2.2z" fill="#E8734A" />
      <path d="M53 39.5c-7-2.6-14-1.9-20.2 2.2v13.1c6.2-4 13.2-4.7 20.2-2.2z" fill="#F4A07C" />
      <path d="M20 27.5v6.6c0 2.6 5.4 4.8 12 4.8s12-2.2 12-4.8v-6.6L32 33z" fill={onDark ? "#2C4F7E" : "#FFFFFF"} fillOpacity={onDark ? 1 : 0.82} />
      <path d="M32 11 56 21.5 32 32 8 21.5z" fill={onDark ? "#142B4D" : "#FFFFFF"} />
      <path d="M50.5 24v9.3" stroke={onDark ? "#E0A92E" : "#F4C35A"} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50.5" cy="35" r="2.4" fill={onDark ? "#E0A92E" : "#F4C35A"} />
    </svg>
  );
}
