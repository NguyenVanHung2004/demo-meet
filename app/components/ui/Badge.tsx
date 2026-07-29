import { MeetingStatus, MEETING_STATUS, MEETING_STATUS_LABELS } from "@/app/lib/constants";

const statusStyles: Record<MeetingStatus, string> = {
  [MEETING_STATUS.DRAFT]: "bg-slate-100 text-slate-600 border-slate-200",
  [MEETING_STATUS.TRANSCRIBING]: "bg-blue-50 text-blue-700 border-blue-200",
  [MEETING_STATUS.TRANSCRIBED]: "bg-indigo-50 text-indigo-700 border-indigo-200",
  [MEETING_STATUS.SUMMARIZING]: "bg-amber-50 text-amber-700 border-amber-200",
  [MEETING_STATUS.COMPLETED]: "bg-green-50 text-green-700 border-green-200",
  [MEETING_STATUS.FAILED]: "bg-red-50 text-red-700 border-red-200",
};

interface BadgeProps {
  status: MeetingStatus;
  className?: string;
}

export default function Badge({ status, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border
        ${statusStyles[status] || statusStyles[MEETING_STATUS.DRAFT]}
        ${className}
      `.trim()}
    >
      {MEETING_STATUS_LABELS[status] || status}
    </span>
  );
}
