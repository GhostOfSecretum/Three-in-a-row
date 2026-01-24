'use client';

type LoadingOverlayProps = {
  progress: number;
};

export default function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const percent = Math.round(progress * 100);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black text-white">
      <div className="text-2xl font-semibold">Loading Doom Core</div>
      <div className="w-64 h-3 rounded-full bg-gray-700 overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="text-xs text-gray-400">{percent}%</div>
    </div>
  );
}
