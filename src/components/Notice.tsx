interface NoticeProps {
  children: React.ReactNode;
  tone?: 'plain' | 'error';
}

export default function Notice({ children, tone = 'plain' }: NoticeProps) {
  const cls =
    tone === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-white/[0.03] text-white/70';
  return <p className={`rounded-2xl border p-4 text-sm ${cls}`}>{children}</p>;
}
