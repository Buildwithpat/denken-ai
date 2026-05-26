'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, ImageIcon, Trash2, UploadCloud } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FileEntry {
  file:    File;
  preview: string | null; // object URL for images, null for PDF
}

interface Props {
  onClose:  () => void;
  onSubmit: (files: File[]) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const ACCEPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/* ─── UploadModal ────────────────────────────────────────────────────────── */

export default function UploadModal({ onClose, onSubmit }: Props) {
  const [entries,   setEntries]   = useState<FileEntry[]>([]);
  const [dragging,  setDragging]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Revoke object URLs on unmount to avoid memory leaks */
  useEffect(() => {
    return () => entries.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(raw: FileList | File[]) {
    const next: FileEntry[] = [];
    Array.from(raw).forEach(file => {
      if (!ACCEPT_TYPES.includes(file.type)) return;
      /* avoid duplicates by name+size */
      const dup = entries.some(e => e.file.name === file.name && e.file.size === file.size);
      if (dup) return;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      next.push({ file, preview });
    });
    setEntries(prev => [...prev, ...next]);
  }

  function removeEntry(idx: number) {
    setEntries(prev => {
      const entry = prev[idx];
      if (entry.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  /* Drag handlers */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      {/* Card */}
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-white/[0.09] bg-[#0d1019]"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Upload your answer sheet</p>
            <p className="mt-0.5 text-xs text-white/35">PDF, JPG, or PNG · multiple files allowed</p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded p-1.5 text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={[
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded border-2 border-dashed py-10 transition-colors duration-150',
              dragging
                ? 'border-white/30 bg-white/[0.04]'
                : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]',
            ].join(' ')}
          >
            <UploadCloud
              size={28}
              className={dragging ? 'text-white/60' : 'text-white/20'}
            />
            <div className="text-center">
              <p className="text-xs font-medium text-white/55">
                {dragging ? 'Release to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="mt-0.5 text-[10px] text-white/25">PDF · JPG · PNG</p>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />

          {/* File list */}
          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                >
                  {/* Thumbnail / icon */}
                  {entry.preview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={entry.preview}
                      alt={entry.file.name}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/[0.04]">
                      <FileText size={18} className="text-white/30" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">
                      {entry.file.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {entry.preview ? (
                        <><ImageIcon size={9} className="mr-1 inline" />Image</>
                      ) : (
                        <><FileText size={9} className="mr-1 inline" />PDF</>
                      )}
                      {' · '}{formatBytes(entry.file.size)}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeEntry(i)}
                    className="cursor-pointer shrink-0 rounded p-1.5 text-white/20 transition-colors hover:bg-white/[0.05] hover:text-white/60"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.07] px-5 py-4">
          <span className="text-[11px] text-white/25">
            {entries.length > 0
              ? `${entries.length} file${entries.length !== 1 ? 's' : ''} selected`
              : 'No files selected'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer rounded border border-white/[0.09] px-4 py-2 text-xs text-white/45 transition-colors hover:border-white/20 hover:text-white/75"
            >
              Cancel
            </button>
            <button
              onClick={() => { onSubmit(entries.map(e => e.file)); onClose(); }}
              disabled={entries.length === 0}
              className="cursor-pointer rounded border border-[#16a34a]/30 bg-[#16a34a]/12 px-5 py-2 text-xs font-semibold text-[#22c55e] transition-colors hover:bg-[#16a34a]/22 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Submit for Evaluation
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
