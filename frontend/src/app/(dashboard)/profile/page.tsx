'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, ShieldCheck, Lock, KeyRound,
  BookOpen, BarChart2, Flame, Bookmark, X,
  ChevronRight, CheckCircle, Play, Eye,
} from 'lucide-react';
import { useOnboarding } from '@/context/OnboardingContext';
import BillingCard from '@/components/billing/BillingCard';

/* ─── Avatar list ────────────────────────────────────────────────────────── */

const AVATARS = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6'];

/* ─── Mock performance data ──────────────────────────────────────────────── */

const PERF = { testsTaken: 12, avgScore: 68, streak: 5 };

/* ─── Saved questions mock ───────────────────────────────────────────────── */

interface SavedQ {
  id:      number;
  subject: string;
  type:    'mcq' | 'numerical';
  text:    string;
  saved:   boolean;
}

const MOCK_SAVED: SavedQ[] = [
  { id: 1, subject: 'Physics',     type: 'mcq',       saved: true, text: 'A block of mass 2 kg is placed on a frictionless surface. A horizontal force of 10 N acts on it. Find the acceleration of the block.' },
  { id: 2, subject: 'Physics',     type: 'numerical', saved: true, text: 'The wavelength of light in vacuum is 600 nm. Find its wavelength in glass of refractive index 1.5.' },
  { id: 3, subject: 'Chemistry',   type: 'mcq',       saved: true, text: 'Which of the following is the correct IUPAC name for CH₃-CH(OH)-CH₂-COOH?' },
  { id: 4, subject: 'Chemistry',   type: 'mcq',       saved: true, text: 'The hybridisation of carbon in CO₂ is:' },
  { id: 5, subject: 'Mathematics', type: 'mcq',       saved: true, text: 'If f(x) = x² + 3x + 2, find the roots of f(x) = 0.' },
  { id: 6, subject: 'Mathematics', type: 'numerical', saved: true, text: 'Find the sum of the first 20 terms of the AP: 3, 7, 11, …' },
  { id: 7, subject: 'Biology',     type: 'mcq',       saved: true, text: 'Which organelle is known as the powerhouse of the cell?' },
  { id: 8, subject: 'Biology',     type: 'mcq',       saved: true, text: 'The process of replication in prokaryotes starts at:' },
];

function subjectsForExam(exam: string | null): string[] {
  switch (exam) {
    case 'neet':   return ['Physics', 'Chemistry', 'Biology'];
    case 'cbse':   return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English'];
    case 'custom': return ['Unit 1', 'Unit 2', 'Unit 3'];
    default:       return ['Physics', 'Chemistry', 'Mathematics'];
  }
}

/* ─── Saved Questions Modal ──────────────────────────────────────────────── */

function SavedQModal({ exam, onClose }: { exam: string | null; onClose: () => void }) {
  const router    = useRouter();
  const subjects  = subjectsForExam(exam);
  const [filter, setFilter] = useState('All');
  const [saved, setSaved]   = useState<Set<number>>(new Set(MOCK_SAVED.map(q => q.id)));

  const filtered = filter === 'All'
    ? MOCK_SAVED
    : MOCK_SAVED.filter(q => q.subject === filter);

  function toggleSave(id: number) {
    setSaved(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d1018]"
        style={{ maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Saved Questions</h3>
            <p className="text-[11px] text-white/35">{saved.size} bookmarked</p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70">
            <X size={15} />
          </button>
        </div>

        {/* Subject filter */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/[0.06] px-6 py-3 [&::-webkit-scrollbar]:hidden">
          {['All', ...subjects].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={[
                'shrink-0 cursor-pointer rounded-full border px-3.5 py-1 text-xs font-medium transition-all duration-150',
                filter === s
                  ? 'border-[#8762F7]/45 bg-[#8762F7]/18 text-white'
                  : 'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/65',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Bookmark size={24} className="mb-3 text-white/15" />
              <p className="text-sm text-white/30">No saved questions for this subject.</p>
            </div>
          ) : (
            filtered.map(q => (
              <div key={q.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
                      {q.subject}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-white/25">{q.type}</span>
                  </div>
                  <button
                    onClick={() => toggleSave(q.id)}
                    className="cursor-pointer rounded p-0.5 transition-colors hover:bg-white/[0.05]"
                  >
                    <Bookmark
                      size={13}
                      className={saved.has(q.id) ? 'fill-[#8762F7] stroke-[#8762F7]' : 'stroke-white/25'}
                    />
                  </button>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-white/65">{q.text}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onClose(); router.push('/tests'); }}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8762F7]/25 bg-[#8762F7]/08 px-3 py-1.5 text-[11px] font-medium text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/15 hover:text-white"
                  >
                    <Play size={10} />
                    Practice
                  </button>
                  <button
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                  >
                    <Eye size={10} />
                    View Solution
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Reusable section card ──────────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
      <p className="mb-5 text-[10px] font-semibold uppercase tracking-widest text-white/30">{title}</p>
      {children}
    </div>
  );
}

/* ─── Inline editable field ──────────────────────────────────────────────── */

function EditField({
  label, value, onChange, type = 'text', placeholder, readOnly = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/25">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={[
          'w-full rounded-xl border bg-[#0B0E14] px-4 py-2.5 text-sm text-white outline-none transition-colors',
          readOnly
            ? 'cursor-default border-white/[0.05] text-white/40'
            : 'border-white/[0.09] placeholder-white/20 focus:border-[#8762F7]/40 focus:ring-1 focus:ring-[#8762F7]/15',
        ].join(' ')}
      />
    </div>
  );
}

/* ─── Avatar picker modal ────────────────────────────────────────────────── */

function AvatarPicker({ current, onSelect, onClose }: {
  current: string; onSelect: (a: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#0d1018] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Choose Avatar</p>
          <button onClick={onClose} className="cursor-pointer text-white/30 hover:text-white/70"><X size={15} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map(av => (
            <button
              key={av}
              onClick={() => { onSelect(av); onClose(); }}
              className={[
                'relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border transition-all duration-150',
                current === av
                  ? 'border-[#8762F7]/60 shadow-[0_0_16px_rgba(135,98,247,0.25)]'
                  : 'border-white/[0.07] hover:border-[#8762F7]/30',
              ].join(' ')}
            >
              <Image src={`/avatars/${av}.svg`} alt={av} fill className="object-cover p-2" />
              {current === av && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#8762F7]">
                  <CheckCircle size={10} className="text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { data, set, loaded } = useOnboarding();

  const [editName,      setEditName]      = useState('');
  const [editMobile,    setEditMobile]    = useState('');
  const [newPassword,   setNewPassword]   = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [passError,     setPassError]     = useState('');
  const [passSaved,     setPassSaved]     = useState(false);
  const [nameSaved,     setNameSaved]     = useState(false);
  const [mobileSaved,   setMobileSaved]   = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showSavedQ,    setShowSavedQ]    = useState(false);

  if (!loaded) return null;

  /* Derive display values — use saved data as fallback */
  const displayName   = editName   || data.name   || '';
  const displayMobile = editMobile || data.mobile || '';

  function handleSaveName() {
    if (!editName.trim()) return;
    set('name', editName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  function handleSaveMobile() {
    if (editMobile && !/^\d{10}$/.test(editMobile.trim())) return;
    set('mobile', editMobile.trim());
    setMobileSaved(true);
    setTimeout(() => setMobileSaved(false), 2000);
  }

  function handleChangePassword() {
    setPassError('');
    if (!newPassword)              return setPassError('Enter a new password.');
    if (newPassword.length < 6)    return setPassError('Minimum 6 characters.');
    if (newPassword !== confirmPass) return setPassError('Passwords do not match.');
    setNewPassword('');
    setConfirmPass('');
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2500);
  }

  const examLabel = (data.examType ?? 'jee').toUpperCase();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-sm text-white/35">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ── LEFT COLUMN (spans 2) ── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Profile card */}
          <Card title="Profile">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
                  {data.avatar ? (
                    <Image src={`/avatars/${data.avatar}.svg`} alt="avatar" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User size={22} className="text-white/25" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAvatarPicker(true)}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-white/[0.08] py-1 text-[10px] font-medium text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                >
                  Change
                </button>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <User size={13} className="shrink-0 text-white/25" />
                  <div>
                    <p className="text-[10px] text-white/25">Name</p>
                    <p className="text-sm font-medium text-white">{data.name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail size={13} className="shrink-0 text-white/25" />
                  <div>
                    <p className="text-[10px] text-white/25">Email</p>
                    <p className="text-sm text-white/70">{data.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#8762F7]/25 bg-[#8762F7]/10 px-2 py-0.5 text-[10px] font-semibold text-[#8762F7]">
                      {examLabel}
                    </span>
                  </div>
                  {data.targetYear && (
                    <span className="text-xs text-white/35">Target: {data.targetYear}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Billing */}
          <BillingCard />

          {/* Account Settings */}
          <Card title="Account Settings">
            <div className="space-y-4">
              {/* Edit Name */}
              <div>
                <EditField
                  label="Display Name"
                  value={editName}
                  onChange={setEditName}
                  placeholder={data.name || 'Enter your name'}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={handleSaveName}
                    className="cursor-pointer rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-1.5 text-xs font-medium text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/20 hover:text-white"
                  >
                    Save Name
                  </button>
                  {nameSaved && (
                    <span className="flex items-center gap-1 text-[11px] text-[#22c55e]">
                      <CheckCircle size={11} /> Saved
                    </span>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/[0.05]" />

              {/* Change Password */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Lock size={13} className="text-white/30" />
                  <p className="text-xs font-medium text-white/55">Change Password</p>
                </div>
                <div className="space-y-3">
                  <EditField
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Min. 6 characters"
                  />
                  <EditField
                    label="Confirm Password"
                    type="password"
                    value={confirmPass}
                    onChange={setConfirmPass}
                    placeholder="Repeat password"
                  />
                  {passError && <p className="text-[11px] text-rose-400">{passError}</p>}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleChangePassword}
                      className="cursor-pointer rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-1.5 text-xs font-medium text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/20 hover:text-white"
                    >
                      Update Password
                    </button>
{passSaved && (
                      <span className="flex items-center gap-1 text-[11px] text-[#22c55e]">
                        <CheckCircle size={11} /> Updated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Mobile number */}
          <Card title="Mobile Number">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone size={13} className="shrink-0 text-white/25" />
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/70">{data.mobile || 'Not added'}</p>
                  {data.mobile && (
                    <span className="flex items-center gap-1 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5 text-[9px] font-semibold text-[#22c55e]">
                      <ShieldCheck size={9} />
                      Verified
                    </span>
                  )}
                </div>
              </div>
              <EditField
                label="Update Mobile"
                type="tel"
                value={editMobile}
                onChange={setEditMobile}
                placeholder="10-digit number"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveMobile}
                  className="cursor-pointer rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-1.5 text-xs font-medium text-[#8762F7]/80 transition-colors hover:bg-[#8762F7]/20 hover:text-white"
                >
                  Save
                </button>
                {mobileSaved && (
                  <span className="flex items-center gap-1 text-[11px] text-[#22c55e]">
                    <CheckCircle size={11} /> Saved
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Performance Snapshot */}
          <Card title="Performance Snapshot">
            <div className="space-y-3">
              {[
                { icon: BookOpen, label: 'Tests Taken', value: PERF.testsTaken, color: 'text-[#8762F7]', bg: 'bg-[#8762F7]/10 border-[#8762F7]/20' },
                { icon: BarChart2, label: 'Avg Score',  value: `${PERF.avgScore}%`, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10 border-[#22c55e]/20' },
                { icon: Flame,    label: 'Day Streak',  value: PERF.streak,     color: 'text-[#f97316]', bg: 'bg-[#f97316]/10 border-[#f97316]/20' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={['flex h-8 w-8 items-center justify-center rounded-lg border', bg].join(' ')}>
                      <Icon size={14} className={color} />
                    </div>
                    <span className="text-xs text-white/50">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Saved Questions */}
          <button
            onClick={() => setShowSavedQ(true)}
            className="w-full cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-left transition-all duration-150 hover:border-[#8762F7]/25 hover:bg-[#8762F7]/[0.04]"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Saved Questions</p>
              <ChevronRight size={14} className="text-white/25" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#8762F7]/25 bg-[#8762F7]/10">
                <Bookmark size={16} className="fill-[#8762F7] stroke-[#8762F7]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">View Saved Questions</p>
                <p className="text-[11px] text-white/35">{MOCK_SAVED.length} questions bookmarked</p>
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* Avatar picker modal */}
      {showAvatarPicker && (
        <AvatarPicker
          current={data.avatar}
          onSelect={a => set('avatar', a)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {/* Saved questions modal */}
      {showSavedQ && (
        <SavedQModal
          exam={data.examType}
          onClose={() => setShowSavedQ(false)}
        />
      )}

    </div>
  );
}
