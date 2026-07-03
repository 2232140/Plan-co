"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, RotateCcw, Shuffle, Wallet, MessageCircle, Lightbulb } from "lucide-react";
import { Suggestion } from "@/types/planco";

interface ResultModalProps {
  suggestion: Suggestion | null;
  location: string;
  onClose: () => void;
  onReSpin: () => void;
  onDecide?: () => void;
  reSpinLabel?: string;
  hideMap?: boolean;
}

export default function ResultModal({ suggestion, location, onClose, onReSpin, onDecide, reSpinLabel, hideMap = false }: ResultModalProps) {
  const reSpinText = reSpinLabel ?? "もう一度ルーレットを回す";
  const ReSpinIcon = reSpinLabel ? Shuffle : RotateCcw;
  const mapsUrl = suggestion
    ? `https://www.google.com/maps/search/${encodeURIComponent(suggestion.name + " " + location)}`
    : "#";

  return (
    <AnimatePresence>
      {suggestion && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="bg-white rounded-t-3xl p-6 shadow-2xl">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>

              {/* Spot name */}
              <div className="text-center mb-5">
                <p className="text-xs font-bold text-orange-400 tracking-widest uppercase mb-1">
                  決定スポット 🎉
                </p>
                <h2 className="text-3xl font-extrabold text-gray-800">{suggestion.name}</h2>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3 bg-yellow-50 rounded-2xl p-3">
                  <Wallet size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-yellow-600">想定予算</p>
                    <p className="text-gray-700 font-bold">{suggestion.budget}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-purple-50 rounded-2xl p-3">
                  <MessageCircle size={18} className="text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-purple-500">スポットについて</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{suggestion.description}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-mint-50 rounded-2xl p-3" style={{ backgroundColor: "#f0fdf4" }}>
                  <Lightbulb size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-emerald-500">選ばれた理由</p>
                    <p className="text-gray-700 text-sm leading-relaxed">{suggestion.reason}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {!hideMap && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onDecide}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-base shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ background: "linear-gradient(135deg, #FFB5A7 0%, #FEC89A 100%)" }}
                  >
                    <MapPin size={20} />
                    ここに決定！マップで開く
                  </a>
                )}
                <button
                  onClick={onReSpin}
                  className="w-full py-3.5 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all text-sm flex items-center justify-center gap-2 active:scale-95"
                >
                  <ReSpinIcon size={16} />
                  {reSpinText}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
