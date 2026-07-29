"use client";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "danger" | "ghost" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200",
  secondary:
    "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
  danger:
    "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200",
  ghost:
    "bg-transparent hover:bg-slate-100 text-slate-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3.5 text-base rounded-xl gap-2.5",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        font-bold transition flex items-center justify-center
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `.trim()}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
