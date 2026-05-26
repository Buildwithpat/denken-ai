import * as fs from 'fs';
import * as path from 'path';
import {
  ExamKey,
  CbseClassFilter,
  CbseSubject,
  JeeNeetSubject,
  TopicEntry,
} from '../types';

interface RawCbseFile {
  exam: string;
  class: string;
  subjects: { name: string; chapters: string[] }[];
}

interface RawJeeNeetFile {
  exam: string;
  subjects: { name: string; units: string[] }[];
}

let cbse11Cache: CbseSubject[] | null = null;
let cbse12Cache: CbseSubject[] | null = null;
const jeeNeetCache = new Map<Exclude<ExamKey, 'CBSE'>, JeeNeetSubject[]>();

const SYLLABUS_DIR = path.resolve(__dirname, '../data/syllabus');

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(SYLLABUS_DIR, filename), 'utf-8')) as T;
}

function loadCbse(classYear: '11' | '12'): CbseSubject[] {
  if (classYear === '11') {
    if (!cbse11Cache) cbse11Cache = readJson<RawCbseFile>('cbse-class11.json').subjects;
    return cbse11Cache;
  }
  if (!cbse12Cache) cbse12Cache = readJson<RawCbseFile>('cbse-class12.json').subjects;
  return cbse12Cache;
}

function loadJeeNeet(exam: Exclude<ExamKey, 'CBSE'>): JeeNeetSubject[] {
  if (jeeNeetCache.has(exam)) return jeeNeetCache.get(exam)!;
  const fileMap: Record<Exclude<ExamKey, 'CBSE'>, string> = {
    JEE_MAIN: 'jee-main.json',
    JEE_ADVANCED: 'jee-advanced.json',
    NEET: 'neet.json',
  };
  const data = readJson<RawJeeNeetFile>(fileMap[exam]).subjects;
  jeeNeetCache.set(exam, data);
  return data;
}

export function getCbseSyllabus(classFilter: CbseClassFilter = 'both'): CbseSubject[] {
  if (classFilter === '11') return loadCbse('11');
  if (classFilter === '12') return loadCbse('12');
  return [...loadCbse('11'), ...loadCbse('12')];
}

export function getJeeNeetSyllabus(exam: Exclude<ExamKey, 'CBSE'>): JeeNeetSubject[] {
  return loadJeeNeet(exam);
}

export function getSyllabus(
  exam: ExamKey,
  cbseClass: CbseClassFilter = 'both',
): CbseSubject[] | JeeNeetSubject[] {
  if (exam === 'CBSE') return getCbseSyllabus(cbseClass);
  return getJeeNeetSyllabus(exam);
}

export function getTopics(
  exam: ExamKey,
  subjects: string[],
  filter?: string[],
  cbseClass: CbseClassFilter = 'both',
): TopicEntry[] {
  const wantAll = subjects.length === 0;
  const wantedLower = subjects.map((s) => s.toLowerCase());

  function matches(name: string): boolean {
    return wantAll || wantedLower.includes(name.toLowerCase());
  }

  function applyFilter(topics: string[]): string[] {
    if (!filter || filter.length === 0) return topics;
    return topics.filter((t) =>
      filter.some((f) => t.toLowerCase().includes(f.toLowerCase())),
    );
  }

  const result: TopicEntry[] = [];

  if (exam === 'CBSE') {
    for (const subj of getCbseSyllabus(cbseClass)) {
      if (!matches(subj.name)) continue;
      for (const ch of applyFilter(subj.chapters)) {
        result.push({ subject: subj.name, topic: ch, topicKey: 'chapters' });
      }
    }
  } else {
    for (const subj of getJeeNeetSyllabus(exam)) {
      if (!matches(subj.name)) continue;
      for (const u of applyFilter(subj.units)) {
        result.push({ subject: subj.name, topic: u, topicKey: 'units' });
      }
    }
  }

  return result;
}
