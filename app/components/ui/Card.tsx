interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = "", padding = true }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-2xl border border-slate-200 shadow-sm
        ${padding ? "p-6" : ""}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  );
}
