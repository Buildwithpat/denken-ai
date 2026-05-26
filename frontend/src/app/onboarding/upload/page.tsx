'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Upload, FileCheck } from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import OnboardingShell from '@/components/onboarding/OnboardingShell';

function UploadBox({
  label,
  hint,
  file,
  onFile,
  required,
}: {
  label: string;
  hint: string;
  file: string;
  onFile: (names: string[]) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-white/50">
        {label}
        {!required && <span className="ml-1 text-white/30">(mandatory)</span>}
      </p>
      <label className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 transition-all duration-200 hover:border-[#8762F7]/40 hover:bg-white/5">
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files;
            if (!files) return;

            const fileNames = Array.from(files).map((f) => f.name);
            onFile(fileNames);
          }}
        />
        {file ? (
          <>
            <FileCheck size={18} className="text-[#8762F7]" />
            <p className="text-xs font-medium text-[#8762F7]">{file}</p>
            <p className="text-[11px] text-white/40">Click to replace</p>
          </>
        ) : (
          <>
            <Upload
              size={18}
              className="text-white/30 transition-colors group-hover:text-[#8762F7]"
            />
            <p className="text-xs text-white/50">{hint}</p>
            <p className="text-[11px] text-white/30">PDF, DOCX, or TXT</p>
          </>
        )}
      </label>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { data, set } = useOnboarding();
  const [syllabusFile, setSyllabusFile] = useState('');
  const [pyqFiles, setPyqFiles] = useState<string[]>([]);

  const isReady =
  data.examName.trim() &&
  syllabusFile &&
  pyqFiles.length >= 3;

  return (
    <OnboardingShell
      title="Let's build your custom exam"
      subtitle="Add your exam name and upload your study materials."
      backHref="/onboarding/exam"
    >
      <div className="mt-6 flex flex-col gap-4">
        {/* Exam name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">Exam Name</label>
          <input
            type="text"
            placeholder="e.g. My Physics Mock 1"
            value={data.examName}
            onChange={(e) => set("examName", e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-all duration-150 focus:border-[#8762F7] focus:ring-1 focus:ring-[#8762F7]/40"
          />
        </div>

        <UploadBox
          label="Upload Syllabus"
          hint="Click to upload your syllabus"
          file={syllabusFile}
          onFile={(names) => setSyllabusFile(names[0] || "")}
          required
        />

        <UploadBox
          label="Upload Previous Year Questions"
          hint="Click to upload PYQs"
          file=""
          onFile={(names) => {
            setPyqFiles((prev) => {
              const updated = [...prev, ...names].slice(0, 5);
              return updated;
            });
          }}
        />

        <p className="text-[11px] text-white/30 mt-1">
          Upload 3–5 previous year papers
        </p>

        {pyqFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {pyqFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-white/10 rounded"
              >
                <span>{file}</span>

                <button
                  onClick={() =>
                    setPyqFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="ml-1 text-white/40 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <motion.button
          onClick={() => isReady && router.push("/onboarding/loading")}
          whileTap={{ scale: 0.97 }}
          disabled={!isReady}
          className={[
            "mt-2 w-full rounded-md py-2.5 text-sm font-medium text-white transition-all duration-200",
            isReady
              ? "cursor-pointer bg-gradient-to-r from-[#8762F7] to-[#6D4AFF] hover:brightness-110 hover:shadow-[0_0_20px_rgba(135,98,247,0.45)]"
              : "cursor-not-allowed bg-white/10 text-white/30",
          ].join(" ")}
        >
          Finish Setup
        </motion.button>
      </div>
    </OnboardingShell>
  );
}
