import { useCallback, useRef, useState } from 'react';

/** Copy text to the clipboard and remember which button did it, for a 2s "Copied!" state. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    clearTimeout(timerRef.current);
    setCopied(key);
    timerRef.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  return { copied, copy };
}
