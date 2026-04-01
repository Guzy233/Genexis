import React from "react";
import { topLayer } from "../Globals";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type DeleteChoiceOptions = {
  title: string;
  message: string;
};

export type DeleteChoiceResult = {
  action: "trash" | "permanent" | "cancel";
  dontAskAgain: boolean;
};

type DialogState = {
  confirmVisible: boolean;
  confirmOptions: ConfirmOptions | null;
  confirmResolve: ((confirmed: boolean) => void) | null;
  deleteVisible: boolean;
  deleteOptions: DeleteChoiceOptions | null;
  deleteResolve: ((result: DeleteChoiceResult) => void) | null;
};

const state: DialogState = {
  confirmVisible: false,
  confirmOptions: null,
  confirmResolve: null,
  deleteVisible: false,
  deleteOptions: null,
  deleteResolve: null,
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const showConfirmDialog = (options: ConfirmOptions): Promise<boolean> => {
  if (state.confirmResolve) {
    state.confirmResolve(false);
  }
  if (state.deleteResolve) {
    state.deleteResolve({ action: "cancel", dontAskAgain: false });
  }
  state.deleteVisible = false;
  state.deleteOptions = null;
  state.deleteResolve = null;

  state.confirmVisible = true;
  state.confirmOptions = options;
  notify();

  return new Promise<boolean>((resolve) => {
    state.confirmResolve = resolve;
  });
};

export const showDeleteChoiceDialog = (
  options: DeleteChoiceOptions
): Promise<DeleteChoiceResult> => {
  if (state.confirmResolve) {
    state.confirmResolve(false);
  }
  if (state.deleteResolve) {
    state.deleteResolve({ action: "cancel", dontAskAgain: false });
  }
  state.confirmVisible = false;
  state.confirmOptions = null;
  state.confirmResolve = null;

  state.deleteVisible = true;
  state.deleteOptions = options;
  notify();
  return new Promise<DeleteChoiceResult>((resolve) => {
    state.deleteResolve = resolve;
  });
};

const closeConfirmDialog = (confirmed: boolean) => {
  const resolve = state.confirmResolve;
  state.confirmVisible = false;
  state.confirmOptions = null;
  state.confirmResolve = null;
  notify();
  if (resolve) resolve(confirmed);
};

const closeDeleteDialog = (result: DeleteChoiceResult) => {
  const resolve = state.deleteResolve;
  state.deleteVisible = false;
  state.deleteOptions = null;
  state.deleteResolve = null;
  notify();
  if (resolve) resolve(result);
};

topLayer.push(() => {
  const [, forceUpdate] = React.useState(0);
  const [dontAskAgain, setDontAskAgain] = React.useState(false);

  React.useEffect(() => {
    const listener = () => forceUpdate((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  React.useEffect(() => {
    if (state.deleteVisible) setDontAskAgain(false);
  }, [state.deleteVisible]);

  if (state.confirmVisible && state.confirmOptions) {
    const {
      title,
      message,
      confirmText = "确定",
      cancelText = "取消",
      danger,
    } = state.confirmOptions;

    return (
      <div className="confirm-dialog-backdrop">
        <div className="confirm-dialog">
          <div className="confirm-dialog-title">{title}</div>
          <div className="confirm-dialog-message">{message}</div>
          <div className="confirm-dialog-actions">
            <button
              className="confirm-dialog-btn secondary"
              onClick={() => closeConfirmDialog(false)}
            >
              {cancelText}
            </button>
            <button
              className={`confirm-dialog-btn primary ${danger ? "danger" : ""}`}
              onClick={() => closeConfirmDialog(true)}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.deleteVisible || !state.deleteOptions) return null;

  const { title, message } = state.deleteOptions;

  return (
    <div className="confirm-dialog-backdrop">
      <div className="confirm-dialog">
        <div className="confirm-dialog-title">{title}</div>
        <div className="confirm-dialog-message">{message}</div>
        <label className="confirm-dialog-check-row">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          <span>不再弹出，记住我的选择</span>
        </label>
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn secondary"
            onClick={() =>
              closeDeleteDialog({ action: "cancel", dontAskAgain: false })
            }
          >
            取消
          </button>
          <button
            className="confirm-dialog-btn primary"
            onClick={() =>
              closeDeleteDialog({ action: "trash", dontAskAgain })
            }
          >
            放入回收站
          </button>
          <button
            className="confirm-dialog-btn primary danger"
            onClick={() =>
              closeDeleteDialog({ action: "permanent", dontAskAgain })
            }
          >
            永久删除
          </button>
        </div>
      </div>
    </div>
  );
});
