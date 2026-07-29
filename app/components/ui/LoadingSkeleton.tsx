interface SkeletonProps {
  className?: string;
}

function SkeletonBlock({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-lg ${className}`}
    />
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <SkeletonBlock className="h-5 w-1/3" />
      <TextSkeleton lines={2} />
      <SkeletonBlock className="h-3 w-1/4" />
    </div>
  );
}

export function MeetingListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-3 w-1/4" />
          </div>
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
