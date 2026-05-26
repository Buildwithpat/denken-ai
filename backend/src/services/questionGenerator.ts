import * as crypto from 'crypto';
import { Question, ResolvedDifficulty } from '../types';
import { simpleHash } from '../utils/hash';
import { OPTION_LABELS, DIFFICULTY_CYCLE } from '../constants';

type McqTemplate = (topic: string) => {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
};

type NumericalTemplate = (topic: string) => {
  question: string;
  answer: number;
};

// ── MCQ templates ─────────────────────────────────────────────────────────────

const mcqEasy: McqTemplate[] = [
  (topic) => ({
    question: `Which of the following best defines "${topic}"?`,
    options: [
      `The fundamental principle governing ${topic}`,
      `A secondary effect observed in ${topic}`,
      `An experimental method used to study ${topic}`,
      `A mathematical model unrelated to ${topic}`,
    ],
    correctIndex: 0,
  }),
  (topic) => ({
    question: `"${topic}" is primarily concerned with which of the following?`,
    options: [
      'Unrelated classical phenomena',
      `Core principles and definitions of ${topic}`,
      'Quantum field interactions only',
      'Macroscopic fluid behaviour',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `Which statement about "${topic}" is correct?`,
    options: [
      `${topic} has no practical applications`,
      `${topic} cannot be measured experimentally`,
      `${topic} follows well-established scientific laws`,
      `${topic} was disproved in the 20th century`,
    ],
    correctIndex: 2,
  }),
  (topic) => ({
    question: `The SI unit associated with the primary quantity in "${topic}" is:`,
    options: ['Candela (cd)', 'Mole (mol)', 'Standard SI unit for this quantity', 'Steradian (sr)'],
    correctIndex: 2,
  }),
  (topic) => ({
    question: `An introductory concept in "${topic}" involves:`,
    options: [
      'Quantum tunnelling at macroscopic scales',
      'Relativistic corrections at low speeds',
      'Basic definitions and foundational principles',
      'Non-linear chaotic dynamics',
    ],
    correctIndex: 2,
  }),
  (topic) => ({
    question: `Which of the following is a prerequisite for studying "${topic}"?`,
    options: [
      'Advanced topology',
      'Knowledge of foundational mathematics and basic science',
      'Quantum chromodynamics',
      'String theory',
    ],
    correctIndex: 1,
  }),
];

const mcqMedium: McqTemplate[] = [
  (topic) => ({
    question: `In the context of "${topic}", which of the following represents a correct application?`,
    options: [
      `Using ${topic} to violate conservation laws`,
      `Applying ${topic} only in vacuum conditions`,
      `Solving real-world problems using the principles of ${topic}`,
      `Ignoring boundary conditions in ${topic}`,
    ],
    correctIndex: 2,
  }),
  (topic) => ({
    question: `Compare "${topic}" with a related concept — which distinction is most significant?`,
    options: [
      'They are identical in every respect',
      `${topic} operates at a scale or regime distinct from its counterpart`,
      'Neither has been experimentally verified',
      'Both require relativistic treatment at all times',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `When applying the principles of "${topic}" to a two-body system, what must be conserved?`,
    options: [
      'Only linear momentum',
      'Only kinetic energy',
      'Momentum and energy, depending on the nature of interaction',
      'Neither, as quantum effects dominate',
    ],
    correctIndex: 2,
  }),
  (topic) => ({
    question: `A key mathematical tool used to analyse "${topic}" is:`,
    options: [
      'Boolean algebra',
      'Differential equations or Fourier analysis',
      'Graph theory exclusively',
      'Set theory without calculus',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `Which experimental observation most strongly supports the theory of "${topic}"?`,
    options: [
      'Random scatter with no discernible pattern',
      'Consistent reproducible results confirming theoretical predictions',
      'Only anecdotal qualitative evidence',
      'Results valid only at cryogenic temperatures',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `In "${topic}", an increase in the primary variable typically leads to:`,
    options: [
      'No change in the system',
      'A proportional or predictable change in the dependent variable',
      'Complete system collapse',
      'A decrease in all related quantities simultaneously',
    ],
    correctIndex: 1,
  }),
];

const mcqHard: McqTemplate[] = [
  (topic) => ({
    question: `Under extreme conditions, "${topic}" deviates from classical predictions because:`,
    options: [
      'Classical mechanics is always sufficient',
      'Quantum fluctuations and non-linear coupling become significant',
      'Only gravitational corrections matter at high energy',
      'The speed of light is irrelevant to the analysis',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `A critical analysis of "${topic}" reveals which of the following inherent limitations?`,
    options: [
      `${topic} is universally valid without exception`,
      `${topic} breaks down in strongly coupled or degenerate regimes`,
      `${topic} was never experimentally confirmed`,
      `${topic} applies only to massless particles`,
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `The variational principle applied to the system described by "${topic}" yields:`,
    options: [
      'A trivial identity with no physical content',
      'Euler–Lagrange equations governing the system dynamics',
      'Only approximate numerical solutions with no analytic form',
      'Solutions valid solely in one spatial dimension',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `Which advanced formalism extends the treatment of "${topic}" to relativistic regimes?`,
    options: [
      'Newtonian absolute-time framework',
      'Special or general relativistic formulation of the governing equations',
      'Classical thermodynamics in isolation',
      'Boolean circuit theory',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `The perturbation expansion used in "${topic}" converges reliably only when:`,
    options: [
      'The coupling constant exceeds unity',
      'The perturbation is small relative to the unperturbed Hamiltonian',
      'Temperature approaches absolute zero in all cases',
      'The system is in a fully chaotic regime',
    ],
    correctIndex: 1,
  }),
  (topic) => ({
    question: `In a rigorous derivation involving "${topic}", the boundary conditions impose which constraint?`,
    options: [
      'No constraint — boundary conditions are irrelevant',
      'The solution must satisfy continuity and smoothness at all interfaces',
      'Only Dirichlet conditions are ever applicable',
      'Boundary conditions apply only to electromagnetic problems',
    ],
    correctIndex: 1,
  }),
];

// ── Numerical templates ───────────────────────────────────────────────────────

const numericalEasy: NumericalTemplate[] = [
  (topic) => ({
    question: `A system described by "${topic}" has an initial value of 5 units. After one standard time interval the value doubles. What is the final value?`,
    answer: 10,
  }),
  (topic) => ({
    question: `In a basic experiment on "${topic}", three identical measurements yield 4, 6, and 8 units. What is the mean value?`,
    answer: 6,
  }),
  (topic) => ({
    question: `The ratio of two quantities in "${topic}" is 3 : 1. If the larger quantity is 9 units, what is the smaller quantity?`,
    answer: 3,
  }),
  (topic) => ({
    question: `A fundamental quantity in "${topic}" is divided by 4 and then multiplied by 8. Starting from 2, what is the result?`,
    answer: 4,
  }),
  (topic) => ({
    question: `Two objects studied in "${topic}" have masses 2 kg and 3 kg. What is their combined mass in kg?`,
    answer: 5,
  }),
];

const numericalMedium: NumericalTemplate[] = [
  (topic) => ({
    question: `In "${topic}", a particle starts from rest and accelerates uniformly at 2 m/s² for 5 s. What is its final speed in m/s?`,
    answer: 10,
  }),
  (topic) => ({
    question: `Applying conservation laws in "${topic}": a 3 kg object moving at 4 m/s collides and sticks to a stationary 1 kg object. Find the final speed in m/s.`,
    answer: 3,
  }),
  (topic) => ({
    question: `A wave described by "${topic}" has frequency 50 Hz and wavelength 0.4 m. What is the wave speed in m/s?`,
    answer: 20,
  }),
  (topic) => ({
    question: `In "${topic}", the work done on a system is 60 J and the heat released is 20 J. What is the change in internal energy in J?`,
    answer: 40,
  }),
  (topic) => ({
    question: `A resistor in the circuit analysed under "${topic}" has a current of 3 A and resistance 5 Ω. What is the voltage drop in V?`,
    answer: 15,
  }),
];

const numericalHard: NumericalTemplate[] = [
  (topic) => ({
    question: `In "${topic}", a system undergoes a cyclic process with efficiency 40 %. If the input heat is 500 J, what is the net work output in J?`,
    answer: 200,
  }),
  (topic) => ({
    question: `Applying the virial theorem to "${topic}": if the potential energy is −120 J, what is the total mechanical energy in J?`,
    answer: -60,
  }),
  (topic) => ({
    question: `In a two-level system described by "${topic}", the excitation probability is sin²(Ωt/2). At Ωt = π, what is this probability?`,
    answer: 1,
  }),
  (topic) => ({
    question: `The degeneracy of energy level n in the system modelled by "${topic}" is n². For n = 4, what is the degeneracy?`,
    answer: 16,
  }),
  (topic) => ({
    question: `In "${topic}", a projectile is launched at 45° with initial speed 20 m/s. What is the maximum height in m? (g = 10 m/s²)`,
    answer: 10,
  }),
];

// ── Template maps ─────────────────────────────────────────────────────────────

const MCQ_TEMPLATES: Record<ResolvedDifficulty, McqTemplate[]> = {
  easy: mcqEasy,
  medium: mcqMedium,
  hard: mcqHard,
};

const NUM_TEMPLATES: Record<ResolvedDifficulty, NumericalTemplate[]> = {
  easy: numericalEasy,
  medium: numericalMedium,
  hard: numericalHard,
};

// ── Difficulty resolver ───────────────────────────────────────────────────────

function resolveDifficulty(
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  index: number,
  seed: number,
): ResolvedDifficulty {
  if (difficulty !== 'mixed') return difficulty;
  return DIFFICULTY_CYCLE[(seed + index) % 3];
}

// ── Question builders ─────────────────────────────────────────────────────────

function buildMcq(
  subject: string,
  topic: string,
  topicType: 'chapter' | 'unit',
  difficulty: ResolvedDifficulty,
  index: number,
  correctMarks: number,
): Question {
  const templates = MCQ_TEMPLATES[difficulty];
  const seed = simpleHash(`${topic}${subject}${index}`);
  const raw = templates[seed % templates.length](topic);

  const shift = simpleHash(`${topic}${subject}opt${index}`) % 4;
  const rotatedOptions = [0, 1, 2, 3].map(
    (i) => raw.options[(i - shift + 4) % 4],
  ) as [string, string, string, string];
  const correctOption = OPTION_LABELS[(raw.correctIndex + shift) % 4];

  return {
    id: crypto.randomUUID(),
    subject,
    topic,
    topicType,
    difficulty,
    type: 'mcq',
    question: raw.question,
    options: rotatedOptions,
    correctOption,
    marks: correctMarks,
  };
}

function buildNumerical(
  subject: string,
  topic: string,
  topicType: 'chapter' | 'unit',
  difficulty: ResolvedDifficulty,
  index: number,
  correctMarks: number,
): Question {
  const templates = NUM_TEMPLATES[difficulty];
  const seed = simpleHash(`${topic}${subject}num${index}`);
  const raw = templates[seed % templates.length](topic);

  return {
    id: crypto.randomUUID(),
    subject,
    topic,
    topicType,
    difficulty,
    type: 'numerical',
    question: raw.question,
    answer: raw.answer,
    marks: correctMarks,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateQuestions(
  subject: string,
  topic: string,
  topicType: 'chapter' | 'unit',
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  type: 'mcq' | 'numerical',
  count: number,
  correctMarks: number,
): Question[] {
  const seed = simpleHash(`${topic}${subject}`);
  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    const resolved = resolveDifficulty(difficulty, i, seed);
    questions.push(
      type === 'mcq'
        ? buildMcq(subject, topic, topicType, resolved, i, correctMarks)
        : buildNumerical(subject, topic, topicType, resolved, i, correctMarks),
    );
  }

  return questions;
}
