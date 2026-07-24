'use client';

import { Button } from '@procureflow/ui';
import { FileText, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';

/**
 * Drag-and-drop upload zone matching the vendor-portal design system. Purely a
 * client-side file picker (the existing submit flow references files by key; no
 * upload API is added here) — it surfaces the selected files for the invoice.
 */
export function FileDrop({
  label,
  accept = 'application/pdf',
  multiple = false,
  files,
  onChange,
}: {
  label: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (list: FileList | null): void => {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  };

  const remove = (name: string): void => onChange(files.filter((f) => f.name !== name));

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={
          'flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors ' +
          (dragging ? 'border-accent bg-accent-wash' : 'border-line bg-canvas')
        }
      >
        <div className="flex items-center gap-2">
          <UploadCloud className="text-muted h-4 w-4" />
          <span className="text-muted text-[12px]">
            Drag &amp; drop {label.toLowerCase()} here to upload
          </span>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          aria-label={label}
          className="hidden"
          onChange={(e) => take(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.name}
              className="border-line bg-panel flex items-center justify-between rounded-sm border px-2.5 py-1.5 text-[12px]"
            >
              <span className="text-text flex items-center gap-1.5 truncate">
                <FileText className="text-accent-2 h-3.5 w-3.5 shrink-0" />
                {f.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => remove(f.name)}
                className="text-muted hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
