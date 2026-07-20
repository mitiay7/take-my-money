"use client";

import { Download } from "lucide-react";

export function SystemJsonDownload({ data, filename }: { data: unknown; filename: string }) {
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="button button-quiet" type="button" onClick={download}>
      <Download size={16} aria-hidden="true" /> Download audit JSON
    </button>
  );
}
