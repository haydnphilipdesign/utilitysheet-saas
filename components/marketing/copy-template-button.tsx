"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyTemplateButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} aria-label={`Copy ${label}`}>
      {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span aria-live="polite">
        {status === "copied" ? "Copied" : status === "failed" ? "Select and copy" : "Copy"}
      </span>
    </Button>
  );
}
