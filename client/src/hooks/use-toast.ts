import * as React from "react";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

export type ToastVariant = "default" | "destructive";

export type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
};

interface State {
  toasts: ToasterToast[];
}

let count = 0;
const listeners: Array<(state: State) => void> = [];
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let memoryState: State = { toasts: [] };

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function emit() {
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function removeToast(id: string) {
  const timeout = toastTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(id);
  }

  memoryState = {
    toasts: memoryState.toasts.filter((toast) => toast.id !== id),
  };
  emit();
}

function toast({
  title,
  description,
  variant = "default",
}: Omit<ToasterToast, "id">) {
  const id = genId();
  const nextToast: ToasterToast = { id, title, description, variant };

  memoryState = {
    toasts: [nextToast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
  };
  emit();

  const timeout = setTimeout(() => {
    removeToast(id);
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(id, timeout);

  return {
    id,
    dismiss: () => removeToast(id),
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);

    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: removeToast,
  };
}

export { useToast, toast };
