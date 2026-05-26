'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, XCircle, MinusCircle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, BarChart3, BookOpen, Brain,
} from 'lucide-react';
import { useTestConfig, type BackendSubjectSummary } from '@/context/TestContext';
import {
  fetchTestMistakeAnalysis,
  type TestMistakeSummary,
  type MistakeType,
} from '@/lib/mistakeApi';
import ExplanationPanel from '@/components/ExplanationPanel';
import ConceptBreakdown from '@/components/ConceptBreakdown';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Verdict = 'correct' | 'partial' | 'incorrect';

interface ResultQ {
  id:            number;
  subject:       string;
  text:          string;
  type:          'mcq' | 'numerical' | 'subjective';
  options:       string[];
  correctOption?: number;
  modelAnswer:   string;
}

interface StructuredAnswer {
  definition?:  string;
  explanation?: string;
  keyPoints:    string[];
  examples?:    string[];
  notes?:       string;
}

interface SubjectiveQ {
  id:     number;
  text:   string;
  marks:  number;
  answer: StructuredAnswer;
}

type Rating = 'full' | 'mostly' | 'partial' | 'incorrect';

/* ─── Objective scoring helpers ──────────────────────────────────────────── */

/*
 * In mock questions option index 2 (C) is always the correct MCQ answer.
 * Any numerical entry is treated as correct since we cannot verify the value.
 */
const MOCK_CORRECT_OPTION = 2;

interface OverallStats {
  score: number; maxScore: number;
  correct: number; incorrect: number; unattempted: number;
  total: number; accuracy: number; marksGained: number; penalty: number;
}

interface SubjectStat {
  name: string; score: number; maxScore: number;
  correct: number; incorrect: number; unattempted: number;
}

function computeOverall(
  questions: { type: string }[],
  answers: Record<number, number>,
  numericalAnswers: Record<number, string>,
): OverallStats {
  let correct = 0, incorrect = 0, unattempted = 0;
  questions.forEach((q, idx) => {
    if (q.type === 'numerical') {
      numericalAnswers[idx] ? correct++ : unattempted++;
    } else {
      if (answers[idx] === undefined)              unattempted++;
      else if (answers[idx] === MOCK_CORRECT_OPTION) correct++;
      else                                           incorrect++;
    }
  });
  const total       = questions.length;
  const marksGained = correct * 4;
  const penalty     = incorrect;
  const score       = Math.max(0, marksGained - penalty);
  const maxScore    = total * 4;
  const accuracy    = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { score, maxScore, correct, incorrect, unattempted, total, accuracy, marksGained, penalty };
}

function computeSubjects(
  subjectNames: string[],
  questions: { subject: string; type: string }[],
  answers: Record<number, number>,
  numericalAnswers: Record<number, string>,
): SubjectStat[] {
  return subjectNames.map(name => {
    let correct = 0, incorrect = 0, unattempted = 0;
    questions.forEach((q, idx) => {
      if (q.subject !== name) return;
      if (q.type === 'numerical') {
        numericalAnswers[idx] ? correct++ : unattempted++;
      } else {
        if (answers[idx] === undefined)              unattempted++;
        else if (answers[idx] === MOCK_CORRECT_OPTION) correct++;
        else                                           incorrect++;
      }
    });
    const maxScore = questions.filter(q => q.subject === name).length * 4;
    const score    = Math.max(0, correct * 4 - incorrect);
    return { name, score, maxScore, correct, incorrect, unattempted };
  });
}

/* ─── Fallback mock data (used when navigating directly to the page) ─────── */

const FALLBACK_OVERALL: OverallStats = {
  score: 72, maxScore: 120, correct: 18, incorrect: 7, unattempted: 5,
  total: 30, accuracy: 60, marksGained: 72, penalty: 7,
};

const FALLBACK_JEE: SubjectStat[] = [
  { name: 'Physics',     score: 28, maxScore: 40, correct: 7, incorrect: 1, unattempted: 2 },
  { name: 'Chemistry',   score: 22, maxScore: 40, correct: 6, incorrect: 2, unattempted: 2 },
  { name: 'Mathematics', score: 22, maxScore: 40, correct: 6, incorrect: 4, unattempted: 0 },
];

const FALLBACK_NEET: SubjectStat[] = [
  { name: 'Physics',   score: 28, maxScore: 45, correct: 7, incorrect: 1, unattempted: 2 },
  { name: 'Chemistry', score: 24, maxScore: 45, correct: 6, incorrect: 2, unattempted: 2 },
  { name: 'Biology',   score: 20, maxScore: 45, correct: 5, incorrect: 0, unattempted: 5 },
  { name: 'Zoology',   score: 16, maxScore: 45, correct: 4, incorrect: 0, unattempted: 6 },
];

/* ─── Subjective mock data ───────────────────────────────────────────────── */

const MARKS_PER_Q = 5;

const RATING_OPTIONS: { value: Rating; label: string; range: string; mult: number }[] = [
  { value: 'full',      label: 'Fully correct',  range: '100%',   mult: 1.00 },
  { value: 'mostly',    label: 'Mostly correct', range: '70–80%', mult: 0.75 },
  { value: 'partial',   label: 'Partial',        range: '40–60%', mult: 0.50 },
  { value: 'incorrect', label: 'Incorrect',      range: '0–20%',  mult: 0.00 },
];

const RATING_COLORS: Record<Rating, { radio: string; row: string; text: string }> = {
  full:      { radio: 'border-[#22c55e] bg-[#22c55e]', row: 'border-[#22c55e]/35 bg-[#22c55e]/[0.06]', text: 'text-[#22c55e]' },
  mostly:    { radio: 'border-[#14b8a6] bg-[#14b8a6]', row: 'border-[#14b8a6]/35 bg-[#14b8a6]/[0.06]', text: 'text-[#14b8a6]' },
  partial:   { radio: 'border-[#f59e0b] bg-[#f59e0b]', row: 'border-[#f59e0b]/35 bg-[#f59e0b]/[0.06]', text: 'text-[#f59e0b]' },
  incorrect: { radio: 'border-[#ef4444] bg-[#ef4444]', row: 'border-[#ef4444]/35 bg-[#ef4444]/[0.06]', text: 'text-[#ef4444]' },
};

const GRID_COLORS: Record<Rating, { idle: string; active: string }> = {
  full:      { idle: 'border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e]',   active: 'border-[#22c55e] bg-[#22c55e]/20 text-[#22c55e] font-semibold'   },
  mostly:    { idle: 'border-[#14b8a6]/35 bg-[#14b8a6]/10 text-[#14b8a6]',   active: 'border-[#14b8a6] bg-[#14b8a6]/20 text-[#14b8a6] font-semibold'   },
  partial:   { idle: 'border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#f59e0b]',   active: 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b] font-semibold'   },
  incorrect: { idle: 'border-[#ef4444]/35 bg-[#ef4444]/10 text-[#ef4444]',   active: 'border-[#ef4444] bg-[#ef4444]/20 text-[#ef4444] font-semibold'   },
};

const SUBJECTIVE_BANK: SubjectiveQ[] = [
  {
    id: 1, marks: MARKS_PER_Q,
    text: "State and explain Newton's First Law of Motion with two real-life examples.",
    answer: {
      definition: "A body remains at rest or continues moving in a straight line at constant velocity unless acted upon by a net external force. This is also called the Law of Inertia.",
      explanation: "This law introduces the concept of inertia — the resistance of any object to a change in its state of motion. Mass is the quantitative measure of inertia: a greater mass means a greater resistance to change. When the net force on an object is zero, its acceleration is zero, so its velocity (speed and direction) remains constant.",
      keyPoints: [
        "State the law precisely: zero net force means no change in state of motion",
        "Define inertia: the tendency of a body to resist any change in its state of rest or uniform motion",
        "Mass is the measure of inertia (not weight); greater mass → greater inertia",
        "Distinguish static inertia (resists start of motion) from dynamic inertia (resists stopping)",
        "This is a special case of Newton's Second Law (F = ma) when F_net = 0",
      ],
      examples: [
        "A passenger jerks backward when a stationary bus suddenly accelerates — the body's inertia keeps it momentarily at rest while the bus moves forward",
        "A book resting on a table stays at rest because the normal force exactly balances gravity (net force = 0)",
        "A coin placed on a cardboard card falls straight into a glass when the card is pulled rapidly — the coin's inertia keeps it in place",
      ],
      notes: "Newton's First Law also defines inertial frames of reference — frames in which the law holds. It is not derived from the Second Law; it independently asserts the existence of a special class of reference frames.",
    },
  },
  {
    id: 2, marks: MARKS_PER_Q,
    text: "Derive the expression for kinetic energy of a particle from the work-energy theorem.",
    answer: {
      definition: "Kinetic energy is the energy possessed by an object due to its motion. For a particle of mass m moving at speed v: KE = ½mv².",
      explanation: "Derived from the work-energy theorem: the net work done on a particle equals the change in its kinetic energy. Starting from F = ma and the kinematic identity v² = u² + 2as, we calculate the work done accelerating the object from rest to speed v, which yields ½mv².",
      keyPoints: [
        "State the work-energy theorem: W_net = ΔKE",
        "Apply F = ma; work done over displacement s: W = F·s = mas",
        "Use kinematic identity: v² = u² + 2as → as = (v² − u²)/2",
        "Substitute: W = m(v² − u²)/2; for u = 0, KE = ½mv²",
        "SI unit: Joule (J = kg·m²·s⁻²); KE is always a non-negative scalar",
      ],
      examples: [
        "A 2 kg ball moving at 3 m/s has KE = ½ × 2 × 9 = 9 J",
        "Brakes bring a car to rest by converting its kinetic energy entirely into thermal energy (heat)",
        "Doubling speed quadruples KE (KE ∝ v²) — a key reason high-speed collisions are far more destructive",
      ],
      notes: "KE depends on the square of speed, so doubling velocity quadruples kinetic energy. Unlike velocity, KE is frame-dependent but always non-negative.",
    },
  },
  {
    id: 3, marks: MARKS_PER_Q,
    text: "Explain Ohm's Law and state the conditions under which it holds.",
    answer: {
      definition: "Ohm's Law states that the potential difference V across a conductor is directly proportional to the current I flowing through it at constant temperature: V = IR, where R is the resistance of the conductor.",
      explanation: "For ohmic conductors, a V–I graph is a straight line through the origin; the slope equals resistance R. Resistance depends on the material (resistivity ρ), length L, cross-sectional area A (R = ρL/A), and temperature of the conductor.",
      keyPoints: [
        "State Ohm's Law: V = IR (V in volts, I in amperes, R in ohms Ω)",
        "R = V/I; resistance is the opposition offered to current flow",
        "V–I graph for an ohmic conductor: straight line through the origin, slope = R",
        "Conditions: constant temperature and constant physical state of the conductor",
        "Non-ohmic conductors (diodes, thermistors) have non-linear V–I characteristics",
      ],
      examples: [
        "A 10 Ω resistor with 2 A flowing through it has a voltage drop: V = IR = 10 × 2 = 20 V",
        "A tungsten filament bulb becomes non-ohmic at high temperatures as its resistance increases significantly with temperature",
      ],
      notes: "Ohm's Law is an empirical observation, not a fundamental law of nature. It holds only for metallic conductors at constant temperature within normal ranges of current density.",
    },
  },
  {
    id: 4, marks: MARKS_PER_Q,
    text: "Write a short note on photosynthesis covering reactants, products, and significance.",
    answer: {
      definition: "Photosynthesis is the biochemical process by which green plants, algae, and some bacteria use sunlight, water, and carbon dioxide to produce glucose and oxygen. Overall equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.",
      explanation: "Photosynthesis occurs in two linked stages. The light-dependent reactions in the thylakoid membranes split water (photolysis), produce ATP and NADPH, and release O₂. The Calvin cycle in the stroma then uses that ATP and NADPH to fix CO₂ into glucose via the enzyme RuBisCO.",
      keyPoints: [
        "Light reactions (thylakoid): water photolysis → O₂ released; ATP + NADPH produced",
        "Calvin cycle (stroma): CO₂ fixation by RuBisCO; glucose synthesised using ATP and NADPH",
        "Chlorophyll is the primary photosynthetic pigment (absorbs red and blue light strongly)",
        "Ecological role: primary source of atmospheric O₂; base of all food chains (primary production)",
        "Limiting factors: light intensity, CO₂ concentration, temperature, and water availability",
      ],
      examples: [
        "In bright sunlight a leaf produces up to 12× more O₂ than in shade — light intensity directly limits the rate",
        "C4 plants (maize, sugarcane) have a specialised Kranz anatomy that concentrates CO₂ around RuBisCO, minimising photorespiration",
      ],
      notes: "The O₂ released comes from water, not CO₂ — confirmed by isotopic labelling (¹⁸O) experiments. The overall equation is a simplification of over 50 enzymatic steps.",
    },
  },
  {
    id: 5, marks: MARKS_PER_Q,
    text: "Explain the Watson–Crick double helix model of DNA.",
    answer: {
      definition: "The Watson–Crick model (1953) describes DNA as two antiparallel polynucleotide strands wound together in a right-handed double helix, held by complementary base pairing between the strands.",
      explanation: "Each nucleotide consists of a phosphate group, a deoxyribose sugar, and one of four nitrogenous bases (Adenine, Thymine, Guanine, Cytosine). The two strands run antiparallel (one 5'→3', the other 3'→5'). Bases pair across the helix interior via hydrogen bonds: A with T (2 H-bonds) and G with C (3 H-bonds), following Chargaff's rules.",
      keyPoints: [
        "Nucleotide: phosphate group + deoxyribose sugar + nitrogenous base (A, T, G, or C)",
        "Chargaff's rules: A=T (2 H-bonds), G≡C (3 H-bonds); %A = %T and %G = %C in any DNA",
        "Two antiparallel strands coil in a right-handed double helix",
        "Structural dimensions: diameter ≈ 2 nm, pitch ≈ 3.4 nm, 10 base pairs per complete turn",
        "Sugar-phosphate backbone on the outside; stacked bases in the hydrophobic interior",
      ],
      examples: [
        "If one strand is 5'-ATGCTA-3', the complementary strand must be 3'-TACGAT-5'",
        "Higher GC content increases thermal stability (3 H-bonds vs 2 for AT) — thermophilic bacteria have GC-rich DNA",
      ],
      notes: "The model was informed by Rosalind Franklin's X-ray diffraction image (Photo 51) and Chargaff's base-ratio data. The antiparallel orientation is essential for semi-conservative replication — each strand acts as a template.",
    },
  },
  {
    id: 6, marks: MARKS_PER_Q,
    text: "Derive the integrated rate law for a first-order reaction and define its half-life.",
    answer: {
      definition: "A first-order reaction has a rate proportional to the concentration of one reactant: rate = k[A]. The integrated rate law is [A] = [A]₀e^(−kt), and the half-life is t₁/₂ = 0.693/k — independent of initial concentration.",
      explanation: "Integrating the differential rate law −d[A]/dt = k[A] by separating variables gives ln[A] = −kt + ln[A]₀. This linear form means a plot of ln[A] vs time is a straight line with slope −k and y-intercept ln[A]₀. Setting [A] = [A]₀/2 and solving gives the constant half-life formula.",
      keyPoints: [
        "Rate law: −d[A]/dt = k[A]; first-order in reactant A",
        "Integrate by separating variables: ∫d[A]/[A] = −k∫dt → ln[A] = −kt + ln[A]₀",
        "Linear form: ln([A]₀/[A]) = kt; plot of ln[A] vs t has slope = −k",
        "Half-life: set [A] = [A]₀/2 → ln2 = kt₁/₂ → t₁/₂ = 0.693/k (constant, independent of [A]₀)",
        "Units of k: s⁻¹; a constant half-life is the diagnostic signature of first-order kinetics",
      ],
      examples: [
        "Radioactive decay is always first-order; ¹⁴C has t₁/₂ ≈ 5730 years, giving k = 0.693/5730 yr",
        "Decomposition of N₂O₅ in the gas phase follows first-order kinetics with t₁/₂ independent of initial pressure",
      ],
      notes: "A second-order reaction has a half-life that depends on initial concentration (t₁/₂ = 1/k[A]₀) — this distinction is used experimentally to determine reaction order.",
    },
  },
  {
    id: 7, marks: MARKS_PER_Q,
    text: "State and prove the parallel axes theorem for moment of inertia.",
    answer: {
      definition: "The parallel axes theorem: I = I_cm + Md², where I is the moment of inertia about any axis, I_cm is the moment of inertia about a parallel axis through the centre of mass, M is the total mass, and d is the perpendicular distance between the two parallel axes.",
      explanation: "Place the centre of mass at the origin. The displaced axis is at distance d from the CM axis. Expanding the moment sum Σmᵢ[(xᵢ − d)² + yᵢ²] yields three terms: I_cm, −2dΣmᵢxᵢ, and Md². The cross-term vanishes because Σmᵢxᵢ = 0 by the definition of the centre of mass.",
      keyPoints: [
        "Statement: I = I_cm + Md²; the two axes must be parallel",
        "Proof step 1: expand Σmᵢ[(xᵢ − d)² + yᵢ²] = Σmᵢ(xᵢ² + yᵢ²) − 2dΣmᵢxᵢ + Md²",
        "Proof step 2: Σmᵢxᵢ = 0 by definition of CM → cross-term vanishes",
        "Result: I = I_cm + Md²; moment is always greater about a non-CM parallel axis",
        "Cannot be applied between two non-CM parallel axes directly — must go via the CM axis",
      ],
      examples: [
        "Uniform rod about one end: I = ML²/12 + M(L/2)² = ML²/12 + ML²/4 = ML²/3",
        "Solid disk about a tangential axis: I = MR²/2 + MR² = 3MR²/2",
      ],
      notes: "The theorem only works in one direction: from the CM axis to any parallel axis. To shift between two non-CM parallel axes, first shift back to the CM axis using the theorem, then apply it again.",
    },
  },
  {
    id: 8, marks: MARKS_PER_Q,
    text: "Explain coordination number and packing efficiency in close-packed crystal structures.",
    answer: {
      definition: "Coordination number (CN) is the number of nearest-neighbour particles directly touching a given particle in a crystal. Packing efficiency is the percentage of a unit cell's volume occupied by atoms.",
      explanation: "Different crystal structures achieve different CN and packing efficiencies. The FCC and HCP structures achieve the theoretical maximum packing efficiency of 74.05% (Kepler conjecture, confirmed 1998). The formula is: Packing efficiency = (Z × (4/3)πr³ / a³) × 100%, where Z is atoms per unit cell and a is the lattice parameter.",
      keyPoints: [
        "Simple Cubic (SC): CN = 6, packing efficiency = 52.4%, 1 atom per unit cell",
        "Body-centred Cubic (BCC): CN = 8, packing efficiency = 68%, 2 atoms per unit cell",
        "Face-centred Cubic (FCC/CCP): CN = 12, packing efficiency = 74%, 4 atoms per unit cell",
        "HCP structure also achieves CN = 12 and 74% packing efficiency",
        "FCC has tetrahedral voids (2N per N atoms) and octahedral voids (N per N atoms)",
      ],
      examples: [
        "Iron is BCC at room temperature (CN = 8); transforms to FCC (γ-iron, CN = 12) above 912 °C",
        "NaCl structure: each Na⁺ surrounded by 6 Cl⁻ and each Cl⁻ by 6 Na⁺ — coordination number 6:6",
      ],
      notes: "Higher CN generally means denser packing and stronger metallic bonding. FCC metals (Al, Cu, Au) are typically more ductile than BCC metals (Fe, W) because FCC has more slip planes for plastic deformation.",
    },
  },
  {
    id: 9, marks: MARKS_PER_Q,
    text: "Describe the mechanism and products of electrolysis of dilute sulphuric acid.",
    answer: {
      definition: "Electrolysis of dilute H₂SO₄ decomposes water into hydrogen gas at the cathode and oxygen gas at the anode using an electric current. Net reaction: 2H₂O → 2H₂(g) + O₂(g).",
      explanation: "H₂SO₄ dissociates to provide H⁺ and SO₄²⁻ ions, increasing conductivity. At the cathode, H⁺ ions are reduced to H₂. At the anode, OH⁻ ions (from the ionisation of water) are preferentially discharged over SO₄²⁻ (which has a higher discharge potential in dilute solution), producing O₂.",
      keyPoints: [
        "Cathode (reduction): 2H⁺ + 2e⁻ → H₂(g) — hydrogen collected at the cathode",
        "Anode (oxidation): 4OH⁻ → 2H₂O + O₂ + 4e⁻ — oxygen collected at the anode",
        "Net: 2H₂O → 2H₂ + O₂; volume ratio H₂:O₂ = 2:1 (confirmed in Hoffmann's voltameter)",
        "SO₄²⁻ is not discharged in dilute acid (higher discharge potential than OH⁻)",
        "Faraday's first law: mass of product ∝ charge passed (Q = It); 2F of charge → 1 mol H₂",
      ],
      examples: [
        "In Hoffmann's voltameter: collecting 20 mL H₂ at cathode and 10 mL O₂ at anode confirms the 2:1 ratio",
        "Passing 96,500 C (1 Faraday) deposits 1 g of H₂ (1 mol of H⁺ ions discharged)",
      ],
      notes: "In concentrated H₂SO₄, SO₄²⁻ can be discharged at the anode, producing SO₂ or persulphate — so 'dilute' is critical. H₂SO₄ acts only as electrolyte; water is the substance electrolysed and consumed.",
    },
  },
  {
    id: 10, marks: MARKS_PER_Q,
    text: "Explain genetic drift and its significance in evolution.",
    answer: {
      definition: "Genetic drift is the random change in allele frequencies in a population caused by chance sampling events during reproduction, not by natural selection. Its effect is most pronounced in small populations.",
      explanation: "In every generation, only a subset of individuals reproduce. By random chance, certain alleles may be over- or under-represented in the offspring — independent of whether those alleles are beneficial. Over many generations, drift can fix alleles (frequency → 100%) or eliminate them (frequency → 0%), reducing genetic diversity and potentially causing speciation.",
      keyPoints: [
        "Drift is random and non-directional — unlike natural selection, which is deterministic",
        "Bottleneck effect: a sudden drastic reduction in population size causes random allele loss",
        "Founder effect: a small group colonising a new area carries an unrepresentative gene sample",
        "Effect is inversely proportional to effective population size (Ne): smaller Ne → stronger drift",
        "Can fix neutral or even mildly deleterious alleles that selection alone would eliminate",
      ],
      examples: [
        "Cheetahs show extremely low genetic diversity — evidence of a severe historical population bottleneck (possibly ~10,000 years ago)",
        "High incidence of Ellis-van Creveld syndrome among the Amish — founder effect from a small 18th-century founding community",
      ],
      notes: "Drift and selection act simultaneously in real populations. Their relative importance depends on Ne and the selection coefficient s. When Ne is very small, drift can overpower even strong positive selection, explaining why harmful alleles sometimes become fixed in isolated populations.",
    },
  },
];

function buildSubjectiveQuestions(count: number): SubjectiveQ[] {
  return SUBJECTIVE_BANK.slice(0, Math.min(count, SUBJECTIVE_BANK.length));
}

/* ─── Objective mock builder ─────────────────────────────────────────────── */

function buildObjectiveResults(subject: string, count: number): ResultQ[] {
  return Array.from({ length: count }, (_, i) => {
    const isNum  = i % 5 === 4;
    const thirds = Math.ceil(count / 3);
    const subj   = i < thirds ? subject : i < thirds * 2 ? 'Chemistry' : 'Mathematics';
    return {
      id:            i + 1,
      subject:       subj,
      type:          isNum ? 'numerical' : 'mcq',
      text:          isNum
        ? `Question ${i + 1}: Find the numerical value of the expression. Enter your answer to two decimal places.`
        : `Question ${i + 1}: Consider the following and select the most appropriate option.`,
      options:       isNum ? [] : [
        'First option — a plausible but incorrect statement',
        'Second option — another incorrect interpretation',
        'Third option — the correct answer with proper justification',
        'Fourth option — a common misconception',
      ],
      correctOption: isNum ? undefined : 2,
      modelAnswer:   isNum
        ? `Correct value: ${((i + 1) * 2.718).toFixed(2)}. Apply the governing equation step-by-step with correct sign conventions.`
        : 'Option C is correct. This option accurately describes the phenomenon using the governing principle. Options A and B are common misconceptions; option D is a frequent error.',
    };
  });
}

/* ─── Shared helpers ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {children}
    </p>
  );
}

function VerdictBtn({
  kind, active, onClick,
}: {
  kind: Verdict; active: boolean; onClick: () => void;
}) {
  const map = {
    correct:   { label: 'Correct',   Icon: CheckCircle2, on: 'border-[#22c55e]/50 bg-[#22c55e]/15 text-[#22c55e]' },
    partial:   { label: 'Partial',   Icon: MinusCircle,  on: 'border-[#f59e0b]/50 bg-[#f59e0b]/15 text-[#f59e0b]' },
    incorrect: { label: 'Incorrect', Icon: XCircle,      on: 'border-[#ef4444]/50 bg-[#ef4444]/15 text-[#ef4444]' },
  }[kind];
  return (
    <button
      onClick={onClick}
      className={[
        'flex cursor-pointer items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors duration-100',
        active ? map.on : 'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/70',
      ].join(' ')}
    >
      <map.Icon size={12} />
      {map.label}
    </button>
  );
}

/* ─── Objective sub-components ───────────────────────────────────────────── */

function ScoreHero({ score, maxScore, modeLabel, subject }: {
  score: number; maxScore: number; modeLabel: string; subject: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#8762F7]/20 bg-gradient-to-br from-[#8762F7]/[0.10] to-transparent px-8 py-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#8762F7]/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-end gap-2">
          <span className="text-5xl font-bold tabular-nums text-white">{score}</span>
          <span className="mb-1.5 text-2xl font-semibold text-white/30">/ {maxScore}</span>
        </div>
        <p className="mt-2 text-sm text-white/45">
          {modeLabel}
          {subject && <span className="text-white/25"> — {subject}</span>}
        </p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8762F7] to-[#a78bfa] transition-all duration-700"
            style={{ width: `${(score / maxScore) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-white/25">
          {Math.round((score / maxScore) * 100)}% of maximum marks
        </p>
      </div>
    </div>
  );
}

function StatsCards({ m }: { m: OverallStats }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Accuracy</p>
        <span className="text-3xl font-bold tabular-nums text-white">{m.accuracy}%</span>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={['h-full rounded-full', m.accuracy >= 70 ? 'bg-[#22c55e]' : m.accuracy >= 50 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'].join(' ')}
            style={{ width: `${m.accuracy}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-white/35">{m.correct} correct out of {m.total} questions</p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Question Breakdown</p>
        <div className="space-y-2.5">
          {[
            { label: 'Correct',     value: m.correct,     color: 'text-[#22c55e]', bar: 'bg-[#22c55e]' },
            { label: 'Incorrect',   value: m.incorrect,   color: 'text-[#ef4444]', bar: 'bg-[#ef4444]' },
            { label: 'Unattempted', value: m.unattempted, color: 'text-white/35',  bar: 'bg-white/20'  },
          ].map(({ label, value, color, bar }) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] text-white/45">{label}</span>
                <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${(value / m.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Marks Breakdown</p>
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded border border-[#22c55e]/25 bg-[#22c55e]/10 px-2 py-1 text-[11px] font-semibold text-[#22c55e]">+4 correct</span>
          <span className="rounded border border-[#ef4444]/25 bg-[#ef4444]/10 px-2 py-1 text-[11px] font-semibold text-[#ef4444]">−1 incorrect</span>
        </div>
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Marks Gained</span>
            <span className="text-xs font-semibold text-[#22c55e]">+{m.marksGained}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Penalty</span>
            <span className="text-xs font-semibold text-[#ef4444]">−{m.penalty}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            <span className="text-xs font-semibold text-white/65">Net Score</span>
            <span className="text-sm font-bold text-white">{m.score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectBreakdown({ subjects }: { subjects: SubjectStat[] }) {
  return (
    <div>
      <SectionLabel>Subject-wise Performance</SectionLabel>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {subjects.map(({ name, score, maxScore, correct, incorrect, unattempted }) => {
          const pct = Math.round((score / maxScore) * 100);
          return (
            <div key={name} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white/80">{name}</p>
                <span className="text-sm font-bold tabular-nums text-white">
                  {score}<span className="text-xs font-normal text-white/30"> / {maxScore}</span>
                </span>
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={['h-full rounded-full transition-all duration-500', pct >= 70 ? 'bg-[#22c55e]' : pct >= 50 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'].join(' ')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-[#22c55e]">{correct}C</span>
                <span className="text-[#ef4444]">{incorrect}W</span>
                <span className="text-white/25">{unattempted}U</span>
                <span className="ml-auto text-white/30">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionReview({ questions }: { questions: ResultQ[] }) {
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const total     = questions.length;
  const evaluated = Object.keys(verdicts).length;
  const correct   = Object.values(verdicts).filter(v => v === 'correct').length;
  const incorrect = Object.values(verdicts).filter(v => v === 'incorrect').length;

  return (
    <div>
      <SectionLabel>Review Questions</SectionLabel>
      <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-white/40">{evaluated} / {total} rated</span>
          {evaluated > 0 && (
            <span className="text-xs text-white/50">{correct} correct · {incorrect} incorrect</span>
          )}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#8762F7] transition-all duration-500"
            style={{ width: `${(evaluated / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {questions.map(q => {
          const v    = verdicts[q.id];
          const open = expanded === q.id;
          return (
            <div
              key={q.id}
              className={[
                'overflow-hidden rounded-lg border transition-colors duration-150',
                v === 'correct'   ? 'border-[#22c55e]/20 bg-[#22c55e]/[0.03]'
                : v === 'incorrect' ? 'border-[#ef4444]/20 bg-[#ef4444]/[0.03]'
                : 'border-white/[0.07] bg-white/[0.02]',
              ].join(' ')}
            >
              <button
                onClick={() => setExpanded(open ? null : q.id)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
              >
                <span className="w-6 shrink-0 text-[10px] font-semibold tabular-nums text-white/25">Q{q.id}</span>
                <span className="flex-1 truncate text-xs text-white/65">{q.text}</span>
                {v && (
                  <span className={['shrink-0 text-[10px] font-bold', v === 'correct' ? 'text-[#22c55e]' : 'text-[#ef4444]'].join(' ')}>
                    {v === 'correct' ? '✓' : '✗'}
                  </span>
                )}
                {open ? <ChevronUp size={12} className="shrink-0 text-white/25" /> : <ChevronDown size={12} className="shrink-0 text-white/25" />}
              </button>

              {open && (
                <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
                  <p className="text-sm leading-relaxed text-white/80">{q.text}</p>
                  {q.type === 'mcq' && q.options.length > 0 && (
                    <ul className="space-y-1">
                      {q.options.map((opt, i) => (
                        <li
                          key={i}
                          className={[
                            'flex items-start gap-2.5 rounded px-3 py-2 text-xs',
                            i === q.correctOption ? 'bg-[#22c55e]/08 text-[#22c55e]/85' : 'text-white/35',
                          ].join(' ')}
                        >
                          <span className={['mt-[1px] shrink-0 font-semibold', i === q.correctOption ? 'text-[#22c55e]' : 'text-white/25'].join(' ')}>
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="rounded border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#8762F7]/60">Explanation</p>
                    <p className="text-xs leading-relaxed text-white/50">{q.modelAnswer}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">Did you get it right?</span>
                    <VerdictBtn kind="correct"   active={v === 'correct'}   onClick={() => setVerdicts(p => ({ ...p, [q.id]: 'correct' }))} />
                    <VerdictBtn kind="incorrect" active={v === 'incorrect'} onClick={() => setVerdicts(p => ({ ...p, [q.id]: 'incorrect' }))} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Mistake analysis panel ─────────────────────────────────────────────── */

const MISTAKE_META: Record<MistakeType, { label: string; color: string; bg: string; border: string }> = {
  conceptual:       { label: 'Conceptual',     color: 'text-[#a78bfa]', bg: 'bg-[#8762F7]/10', border: 'border-[#8762F7]/25' },
  careless:         { label: 'Careless',       color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/25' },
  formula:          { label: 'Formula',        color: 'text-[#38bdf8]', bg: 'bg-[#38bdf8]/10', border: 'border-[#38bdf8]/25' },
  'time-pressure':  { label: 'Time Pressure',  color: 'text-[#fb923c]', bg: 'bg-[#fb923c]/10', border: 'border-[#fb923c]/25' },
  'weak-retention': { label: 'Weak Retention', color: 'text-[#f472b6]', bg: 'bg-[#f472b6]/10', border: 'border-[#f472b6]/25' },
  guessing:         { label: 'Guessing',       color: 'text-[#facc15]', bg: 'bg-[#facc15]/10', border: 'border-[#facc15]/25' },
  repeated:         { label: 'Repeated',       color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/25' },
};

function MistakeAnalysisPanel({ resultId }: { resultId: string }) {
  const [analysis, setAnalysis] = useState<TestMistakeSummary | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetchTestMistakeAnalysis(resultId)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false));
  }, [resultId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div className="h-3 w-36 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/[0.04]" />
      </div>
    );
  }

  if (!analysis || analysis.totalWrong === 0) {
    return (
      <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/[0.04] px-5 py-4">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[#22c55e]" />
          <p className="text-xs font-semibold text-[#22c55e]">Mistake Analysis</p>
        </div>
        <p className="mt-2 text-sm text-white/55">No wrong answers — excellent performance! Keep it up.</p>
      </div>
    );
  }

  const dom = analysis.dominantType;
  const domMeta = dom ? MISTAKE_META[dom] : null;
  const byTypeEntries = Object.entries(analysis.byType).filter(([, v]) => v > 0) as [MistakeType, number][];

  // Top affected topics (dedupe by topic)
  const topicsSeen = new Set<string>();
  const topTopics = analysis.items.filter(item => {
    if (topicsSeen.has(item.topic)) return false;
    topicsSeen.add(item.topic);
    return true;
  }).slice(0, 5);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Brain size={14} className="text-[#8762F7]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Mistake Intelligence</p>
      </div>

      {/* Dominant type + insight */}
      {domMeta && dom && (
        <div className={`mb-4 rounded-lg border ${domMeta.border} ${domMeta.bg} px-4 py-3.5`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${domMeta.color}`}>Primary: {domMeta.label}</span>
            <span className="text-[10px] text-white/30">{analysis.totalWrong} mistake{analysis.totalWrong !== 1 ? 's' : ''}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/55">{analysis.insight}</p>
        </div>
      )}

      {/* Breakdown pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {byTypeEntries.map(([type, count]) => {
          const m = MISTAKE_META[type];
          return (
            <span
              key={type}
              className={`flex items-center gap-1.5 rounded border ${m.border} ${m.bg} px-2.5 py-1 text-[11px] font-medium ${m.color}`}
            >
              {m.label}
              <span className="opacity-70">×{count}</span>
            </span>
          );
        })}
      </div>

      {/* Affected topics */}
      {topTopics.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] text-white/25">Affected topics</p>
          <div className="space-y-1.5">
            {topTopics.map(item => {
              const m = MISTAKE_META[item.type];
              return (
                <div key={item.topic} className="flex items-center justify-between rounded bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-white/75">{item.topic}</p>
                    <p className="text-[10px] text-white/30">{item.subject}</p>
                  </div>
                  <span className={`rounded border ${m.border} ${m.bg} px-2 py-0.5 text-[10px] font-medium ${m.color}`}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Objective result ───────────────────────────────────────────────────── */

function ObjectiveResult({
  exam, subject, modeLabel, questions, overall, subjectStats, resultId,
  bloomBreakdown, skillBreakdown, weakConcepts, formulaLinks, bankQuestions,
}: {
  exam:             string;
  subject:          string;
  modeLabel:        string;
  questions:        ResultQ[];
  overall:          OverallStats;
  subjectStats:     SubjectStat[];
  resultId:         string | null;
  bloomBreakdown:   Record<string, { correct: number; total: number }>;
  skillBreakdown:   Record<string, { correct: number; total: number }>;
  weakConcepts:     string[];
  formulaLinks:     string[];
  bankQuestions:    import('@/context/TestContext').BackendQuestion[];
}) {
  const [showReview,    setShowReview]    = useState(false);
  const [showInsights,  setShowInsights]  = useState(false);
  const router = useRouter();

  const hasInsights = Object.keys(bloomBreakdown).length > 0 || weakConcepts.length > 0;

  return (
    <div className="space-y-6">
      <ScoreHero score={overall.score} maxScore={overall.maxScore} modeLabel={modeLabel} subject={subject} />
      <StatsCards m={overall} />
      <SubjectBreakdown subjects={subjectStats} />
      {resultId && <MistakeAnalysisPanel resultId={resultId} />}

      {/* Concept Intelligence breakdown */}
      {hasInsights && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <button
            onClick={() => setShowInsights(v => !v)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <Brain size={15} />
              Concept Insights
            </span>
            {showInsights ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
          </button>
          {showInsights && (
            <div className="mt-4">
              <ConceptBreakdown
                bloomBreakdown={bloomBreakdown}
                skillBreakdown={skillBreakdown}
                weakConcepts={weakConcepts}
                formulaLinks={formulaLinks}
              />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowReview(v => !v)}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/65 transition-colors hover:border-white/20 hover:text-white/90"
        >
          <BookOpen size={13} />
          {showReview ? 'Hide Questions' : 'Review Questions'}
        </button>
        <button
          onClick={() => router.push('/analysis')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-4 py-2.5 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
        >
          <BarChart3 size={13} />
          Analyze Performance
        </button>
      </div>
      {showReview && (
        <>
          <QuestionReview questions={questions} />
          {/* AI explanations for bank-sourced questions */}
          {bankQuestions.filter(q => q.bankQuestionId).length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/25">AI Explanations (Bank Questions)</p>
              {bankQuestions.filter(q => q.bankQuestionId).map(q => (
                <div key={q.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <p className="mb-1 text-xs text-white/50 truncate">{q.question}</p>
                  <ExplanationPanel stableId={q.bankQuestionId!} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Manual evaluation (CBSE / CUSTOM) ─────────────────────────────────── */

function SubjectiveResult({ questions }: { questions: SubjectiveQ[] }) {
  const router = useRouter();

  const [active,  setActive]  = useState(0);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});

  const total    = questions.length;
  const rated    = Object.keys(ratings).length;
  const maxTotal = questions.reduce((s, q) => s + q.marks, 0);

  const yourScore = Object.entries(ratings).reduce((sum, [idStr, r]) => {
    const q   = questions.find(q => q.id === Number(idStr));
    const opt = RATING_OPTIONS.find(o => o.value === r);
    return sum + (q && opt ? Math.round(q.marks * opt.mult) : 0);
  }, 0);

  const current = questions[active];

  function setRating(rating: Rating) {
    setRatings(prev => ({ ...prev, [current.id]: rating }));
  }

  function gridClass(q: SubjectiveQ, idx: number) {
    const r       = ratings[q.id];
    const isHere  = idx === active;
    if (r) {
      const c = GRID_COLORS[r];
      return isHere ? c.active : c.idle;
    }
    return isHere
      ? 'border-[#8762F7]/60 bg-[#8762F7]/20 text-[#8762F7] font-semibold'
      : 'border-white/[0.09] bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/80';
  }

  const currentRating = ratings[current.id] ?? null;
  const earnedMarks   = currentRating
    ? Math.round(current.marks * (RATING_OPTIONS.find(o => o.value === currentRating)?.mult ?? 0))
    : null;

  return (
    <div className="space-y-6">

      {/* ── Two-col layout ── */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

        {/* Left — Question grid + score */}
        <div className="space-y-4">

          {/* Grid */}
          <div>
            <SectionLabel>Questions</SectionLabel>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setActive(idx)}
                  className={[
                    'cursor-pointer rounded border py-2 text-[11px] font-medium transition-colors duration-100',
                    gridClass(q, idx),
                  ].join(' ')}
                >
                  Q{q.id}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {[
                { label: 'Full',      cls: 'bg-[#22c55e]'  },
                { label: 'Mostly',    cls: 'bg-[#14b8a6]'  },
                { label: 'Partial',   cls: 'bg-[#f59e0b]'  },
                { label: 'Incorrect', cls: 'bg-[#ef4444]'  },
                { label: 'Pending',   cls: 'bg-white/20'   },
              ].map(({ label, cls }) => (
                <span key={label} className="flex items-center gap-1 text-[9px] text-white/25">
                  <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Score widget */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">Your Score</p>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-bold tabular-nums text-white">{yourScore}</span>
              <span className="mb-1 text-base text-white/30">/ {maxTotal}</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#8762F7] transition-all duration-500"
                style={{ width: maxTotal > 0 ? `${(yourScore / maxTotal) * 100}%` : '0%' }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/30">{rated} of {total} evaluated</p>
          </div>
        </div>

        {/* Right — Answer panel */}
        <div className="space-y-4">

          {/* Question text */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Question {current.id} of {total}
            </p>
            <p className="text-sm leading-7 text-white/85">{current.text}</p>
          </div>

          {/* Suggested answer */}
          <div className="rounded-xl border border-[#8762F7]/25 bg-[#8762F7]/[0.06] px-7 py-6">
            <p className="mb-6 text-[11px] font-bold uppercase tracking-widest text-[#8762F7]/80">
              Suggested Answer
            </p>

            {/* Definition */}
            {current.answer.definition && (
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Definition
                </p>
                <p className="text-sm leading-7 text-white/80">{current.answer.definition}</p>
              </div>
            )}

            {/* Explanation */}
            {current.answer.explanation && (
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Explanation
                </p>
                <p className="text-sm leading-7 text-white/70">{current.answer.explanation}</p>
              </div>
            )}

            {/* Key Points */}
            {current.answer.keyPoints.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Key Points
                </p>
                <ul className="space-y-3">
                  {current.answer.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8762F7]/60" />
                      <span className="text-sm leading-7 text-white/65">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Examples */}
            {current.answer.examples && current.answer.examples.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Examples
                </p>
                <ul className="space-y-3">
                  {current.answer.examples.map((ex, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#14b8a6]/60" />
                      <span className="text-sm leading-7 text-white/60">{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {current.answer.notes && (
              <div className="rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/[0.05] px-4 py-3.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#f59e0b]/70">
                  Important Note
                </p>
                <p className="text-sm leading-7 text-white/60">{current.answer.notes}</p>
              </div>
            )}
          </div>

          {/* Marking scheme */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Marking Scheme
            </p>
            <div className="space-y-3">
              {RATING_OPTIONS.map(opt => {
                const selected  = currentRating === opt.value;
                const optMarks  = Math.round(current.marks * opt.mult);
                const colors    = RATING_COLORS[opt.value];
                return (
                  <label
                    key={opt.value}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3.5 transition-colors duration-100',
                      selected ? colors.row : 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    {/* Visual radio */}
                    <span className={[
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                      selected ? colors.radio : 'border-white/25 bg-transparent',
                    ].join(' ')}>
                      {selected && <span className="h-[5px] w-[5px] rounded-full bg-white" />}
                    </span>
                    {/* Hidden native radio for a11y */}
                    <input
                      type="radio"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setRating(opt.value)}
                    />
                    <span className={['flex-1 text-sm font-medium', selected ? 'text-white/90' : 'text-white/50'].join(' ')}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-white/25">{opt.range}</span>
                    <span className={['tabular-nums text-xs font-semibold', selected ? colors.text : 'text-white/20'].join(' ')}>
                      {optMarks}/{current.marks}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Marks display */}
            <div className="mt-5 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
              <p className="text-xs text-white/40">
                Marks for this question: <span className="font-semibold text-white/75">{current.marks}</span>
              </p>
              {earnedMarks !== null && (
                <p className="text-xs text-white/40">
                  You scored:{' '}
                  <span className={['font-semibold', RATING_COLORS[currentRating!].text].join(' ')}>
                    {earnedMarks} / {current.marks}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Prev / Next nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActive(i => Math.max(0, i - 1))}
              disabled={active === 0}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-white/[0.09] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronLeft size={12} /> Previous
            </button>
            <span className="text-[11px] text-white/25">{active + 1} / {total}</span>
            <button
              onClick={() => setActive(i => Math.min(total - 1, i + 1))}
              disabled={active === total - 1}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-white/[0.09] px-3 py-1.5 text-xs text-white/40 transition-colors hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-25"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-6">
        <button
          disabled={rated < total}
          className="cursor-pointer rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-5 py-2.5 text-xs font-semibold text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit Evaluation
          {rated < total && (
            <span className="ml-2 text-[10px] font-normal opacity-60">
              ({total - rated} remaining)
            </span>
          )}
        </button>
        <button
          onClick={() => router.push('/analysis')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/12 px-5 py-2.5 text-xs font-semibold text-[#8762F7] transition-colors hover:bg-[#8762F7]/22"
        >
          <BarChart3 size={13} />
          Analyze Performance
        </button>
      </div>
    </div>
  );
}

/* ─── Backend → local converters ─────────────────────────────────────────── */

function backendToOverall(
  r: { totalScore: number; correctCount: number; wrongCount: number; unattemptedCount: number; accuracy: number },
  exam: string,
): OverallStats {
  const total          = r.correctCount + r.wrongCount + r.unattemptedCount;
  const markPerCorrect = exam === 'cbse' ? 1 : 4;
  const markPerWrong   = exam === 'cbse' ? 0 : 1;
  return {
    score:       r.totalScore,
    maxScore:    total * markPerCorrect,
    correct:     r.correctCount,
    incorrect:   r.wrongCount,
    unattempted: r.unattemptedCount,
    total,
    accuracy:    r.accuracy,
    marksGained: r.correctCount * markPerCorrect,
    penalty:     r.wrongCount   * markPerWrong,
  };
}

function backendToSubjects(subjectWise: BackendSubjectSummary[], exam: string): SubjectStat[] {
  const markPerCorrect = exam === 'cbse' ? 1 : 4;
  return subjectWise.map(s => ({
    name:        s.subject,
    score:       s.score,
    maxScore:    (s.correct + s.wrong + s.unattempted) * markPerCorrect,
    correct:     s.correct,
    incorrect:   s.wrong,
    unattempted: s.unattempted,
  }));
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function TestResultPage() {
  const { testConfig, testResult, backendResult, backendQuestions } = useTestConfig();
  const router                     = useRouter();

  /* Prefer data from the submitted test; fall back to testConfig for direct nav */
  const exam        = (testResult?.exam ?? testConfig.exam).toLowerCase();
  const isObjective = exam === 'jee' || exam === 'neet';
  const subject     = testResult?.subject || testConfig.subject || 'Physics';
  const mode        = testResult?.mode    || testConfig.mode;
  const count = backendResult
    ? backendResult.correctCount + backendResult.wrongCount + backendResult.unattemptedCount
    : testConfig.questions > 0 ? testConfig.questions : isObjective ? 30 : 10;

  const modeMap: Record<string, string> = {
    rapid:   'Rapid Drill',
    pyq:     'PYQ Mode',
    mistake: 'Mistake Revision',
    normal:  'Standard Test',
  };
  const modeLabel = modeMap[mode] ?? 'Standard Test';
  const subtitle  = isObjective ? 'Your performance summary' : 'Rate each question to calculate your score';

  /* ── Objective stats — backend result takes priority over local compute ── */
  const submittedQs       = testResult?.questions        ?? [];
  const submittedAnswers  = testResult?.answers          ?? {};
  const submittedNumerics = testResult?.numericalAnswers ?? {};

  const overall = backendResult
    ? backendToOverall(backendResult, exam)
    : submittedQs.length > 0
      ? computeOverall(submittedQs, submittedAnswers, submittedNumerics)
      : FALLBACK_OVERALL;

  const subjectNames = exam === 'neet'
    ? ['Physics', 'Chemistry', 'Biology', 'Zoology']
    : ['Physics', 'Chemistry', 'Mathematics'];

  const subjectStats = backendResult
    ? backendToSubjects(backendResult.subjectWise, exam)
    : submittedQs.length > 0
      ? computeSubjects(subjectNames, submittedQs, submittedAnswers, submittedNumerics)
      : exam === 'neet' ? FALLBACK_NEET : FALLBACK_JEE;

  /* ── Concept breakdown from bank questions ── */
  const bloomBreakdown: Record<string, { correct: number; total: number }> = {};
  const skillBreakdown: Record<string, { correct: number; total: number }> = {};
  const weakConceptSet  = new Set<string>();
  const formulaLinkSet  = new Set<string>();

  if (backendQuestions && backendResult) {
    const answerMap = new Map(
      (backendResult as unknown as { answers?: { questionId: string; isCorrect: boolean }[] })
        .answers?.map(a => [a.questionId, a.isCorrect]) ?? [],
    );
    for (const q of backendQuestions) {
      const isCorrect = answerMap.get(q.id) ?? false;
      if (q.bloomLevel) {
        if (!bloomBreakdown[q.bloomLevel]) bloomBreakdown[q.bloomLevel] = { correct: 0, total: 0 };
        bloomBreakdown[q.bloomLevel].total++;
        if (isCorrect) bloomBreakdown[q.bloomLevel].correct++;
      }
      if (q.skillCategory) {
        if (!skillBreakdown[q.skillCategory]) skillBreakdown[q.skillCategory] = { correct: 0, total: 0 };
        skillBreakdown[q.skillCategory].total++;
        if (isCorrect) skillBreakdown[q.skillCategory].correct++;
      }
      if (!isCorrect) {
        q.conceptTags?.forEach(t => weakConceptSet.add(t));
        q.formulaTags?.forEach(t => formulaLinkSet.add(t));
      }
    }
  }

  const weakConcepts = [...weakConceptSet].slice(0, 12);
  const formulaLinks = [...formulaLinkSet].slice(0, 10);

  /* ── Question list for review panel ── */
  const objectiveQs  = isObjective ? buildObjectiveResults(subject, submittedQs.length || count) : [];
  const subjectiveQs = !isObjective ? buildSubjectiveQuestions(count) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-7">
        <button
          onClick={() => router.push('/tests')}
          className="mb-4 flex cursor-pointer items-center gap-1.5 text-white/40 transition-colors hover:text-white/75"
        >
          <ArrowLeft size={13} />
          <span className="text-xs">Back to Tests</span>
        </button>
        <h1 className="text-xl font-semibold text-white">Test Result</h1>
        <p className="mt-1 text-sm text-white/40">{subtitle}</p>
      </div>

      {isObjective
        ? (
          <ObjectiveResult
            exam={exam}
            subject={subject}
            modeLabel={modeLabel}
            questions={objectiveQs}
            overall={overall}
            subjectStats={subjectStats}
            resultId={backendResult?.id ?? null}
            bloomBreakdown={bloomBreakdown}
            skillBreakdown={skillBreakdown}
            weakConcepts={weakConcepts}
            formulaLinks={formulaLinks}
            bankQuestions={backendQuestions ?? []}
          />
        )
        : <SubjectiveResult questions={subjectiveQs} />
      }
    </div>
  );
}
