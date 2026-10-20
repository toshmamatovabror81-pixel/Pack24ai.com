export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`text-2xl font-black tracking-tight ${className}`}>
      PACK<span className="text-accent-500">24</span>
    </span>
  );
}
