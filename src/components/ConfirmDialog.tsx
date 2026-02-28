import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getIconClass = () => {
    switch (type) {
      case 'danger':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'espresso-btn-danger';
      case 'warning':
        return 'espresso-btn-primary';
      case 'info':
        return 'espresso-btn-primary';
      default:
        return 'espresso-btn-primary';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center espresso-overlay backdrop-blur-sm">
      <div className="espresso-card rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 ${getIconClass()}`} />
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg transition-colors espresso-btn-secondary"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-gray-300 mb-6">{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors espresso-btn-secondary"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${getButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const useConfirmDialog = () => {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    onCancel: () => {},
    type: 'warning'
  });

  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    }
  ) => {
    setDialog({
      isOpen: true,
      title,
      message,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      onConfirm: () => {
        onConfirm();
        hideConfirmDialog();
      },
      onCancel: hideConfirmDialog,
      type: options?.type || 'warning'
    });
  };

  const hideConfirmDialog = () => {
    setDialog((prev: typeof dialog) => ({ ...prev, isOpen: false }));
  };

  return { dialog, showConfirmDialog, hideConfirmDialog };
};
