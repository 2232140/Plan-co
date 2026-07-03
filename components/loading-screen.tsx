"use client";

function SwingFigure() {
  return (
    <div className="animate-swing" style={{ transformOrigin: "top center" }}>
      <svg width="90" height="110" viewBox="0 0 90 110" fill="none">
        {/* ropes */}
        <line x1="22" y1="0" x2="22" y2="74" stroke="#FEC89A" strokeWidth="3" strokeLinecap="round" />
        <line x1="68" y1="0" x2="68" y2="74" stroke="#FEC89A" strokeWidth="3" strokeLinecap="round" />
        {/* seat */}
        <rect x="12" y="72" width="66" height="11" rx="5.5" fill="#FFB5A7" />
        {/* body */}
        <ellipse cx="45" cy="62" rx="9" ry="6" fill="#B5EAD7" />
        {/* head */}
        <circle cx="45" cy="48" r="13" fill="#FFDDE1" />
        {/* eyes */}
        <circle cx="40" cy="46" r="2.2" fill="#555" />
        <circle cx="50" cy="46" r="2.2" fill="#555" />
        {/* smile */}
        <path d="M 38 53 Q 45 59 52 53" stroke="#555" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* cheeks */}
        <circle cx="36" cy="51" r="3" fill="#FFB5A7" opacity="0.5" />
        <circle cx="54" cy="51" r="3" fill="#FFB5A7" opacity="0.5" />
      </svg>
    </div>
  );
}

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export default function LoadingScreen({ message, subMessage }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8"
      style={{ background: "linear-gradient(160deg, #FFB5A7 0%, #FEC89A 100%)" }}
    >
      {/* Swing top anchor */}
      <div className="flex flex-col items-center">
        <div className="w-16 h-1.5 rounded-full bg-white/60 mb-0" />
        <SwingFigure />
      </div>

      {/* Message */}
      <div className="text-center space-y-2">
        <p className="text-white font-extrabold text-xl tracking-wide text-balance max-w-xs mx-auto text-center">
          {message ?? "Plan-coが楽しい予定を考え中"}
        </p>
        <div className="dot-pulse flex justify-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-white" />
          <span className="inline-block w-2 h-2 rounded-full bg-white" />
          <span className="inline-block w-2 h-2 rounded-full bg-white" />
        </div>
        <p className="text-white/70 text-sm mt-1">
          {subMessage ?? "🎢 少々お待ちください"}
        </p>
      </div>
    </div>
  );
}
