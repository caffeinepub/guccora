export function GLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-gold flex items-center justify-center flex-shrink-0"
    >
      <span
        className="text-black font-black font-display"
        style={{ fontSize: size * 0.55, lineHeight: 1 }}
      >
        G
      </span>
    </div>
  );
}
