import { useEffect } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-zinc-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal({ isOpen, onClose, message, type = "error" }) {
  if (!isOpen) return null;

  const bgColor = type === "success" ? "bg-green-900/90" : "bg-red-900/90";
  const Icon = type === "success" ? CheckCircle : AlertCircle;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`${bgColor} rounded-xl max-w-sm w-full p-5 border ${type === "success" ? "border-green-600/50" : "border-red-600/50"} text-white text-center`}
      >
        <Icon className="w-10 h-10 mx-auto mb-3" />
        <p className="text-sm">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
