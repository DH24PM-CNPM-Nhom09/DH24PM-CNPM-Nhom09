import { HTMLAttributes, ReactNode } from "react";

export default function Card({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`rounded-card border border-gray-200 bg-white ${className}`} {...rest}>
      {children}
    </div>
  );
}
