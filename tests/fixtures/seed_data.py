"""
Deterministic seed data for repeatable local testing.

Content maps use real-ish educational text so that the embedding model
produces meaningful similarity scores during retrieval-quality evaluation.
"""
from __future__ import annotations
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Test user credentials
# ---------------------------------------------------------------------------

TEST_USER = {
    "name":               "DenkenCI User",
    "email":              "test-ci@denken.local",
    "password":           "CiTestPass#99",
    "mobileNumber":       "9000000001",
    "targetExam":         "jee",
    "targetYear":         2026,
    "selectedSubjects":   ["Physics", "Chemistry", "Mathematics"],
    "onboardingComplete": True,
}

TEST_LOGIN = {
    "email":    TEST_USER["email"],
    "password": TEST_USER["password"],
}

# ---------------------------------------------------------------------------
# Seed content maps  (3 chapters, rich topic text for semantic retrieval)
# ---------------------------------------------------------------------------

SEED_CONTENT_MAPS: list[dict] = [
    {
        "exam":    "JEE_MAIN",
        "subject": "Physics",
        "unit":    "Mechanics",
        "chapter": "Laws of Motion",
        "source":  "textbook",
        "topics": {
            "Newton's First Law": (
                "Newton's First Law of Motion states that every object continues in its state of rest "
                "or uniform motion in a straight line unless acted upon by an external unbalanced force. "
                "This property of matter to resist change in its state of motion is called inertia. "
                "A heavier body has greater inertia than a lighter body. The law implies that if the net "
                "force on a body is zero, its acceleration is zero and it moves with constant velocity or "
                "remains at rest. This is also known as the law of inertia."
            ),
            "Newton's Second Law": (
                "Newton's Second Law of Motion states that the rate of change of linear momentum of a body "
                "is directly proportional to the external force applied on it and takes place in the "
                "direction of the force. Mathematically F = ma, where F is the net force in Newtons, "
                "m is the mass in kilograms, and a is the acceleration in m/s². For constant mass, "
                "force equals mass times acceleration. The SI unit of force is Newton (N). One Newton is "
                "the force that gives a 1 kg mass an acceleration of 1 m/s²."
            ),
            "Newton's Third Law": (
                "Newton's Third Law of Motion states that for every action there is an equal and opposite "
                "reaction. If body A exerts force F on body B, then body B exerts an equal force −F on "
                "body A. Action and reaction forces always act on different bodies and can never cancel "
                "each other. Examples: rocket propulsion (exhaust gases expelled backward, rocket moves "
                "forward), swimming (push water backward, body moves forward), recoil of a gun when fired."
            ),
            "Friction": (
                "Friction is a contact force that opposes relative motion or tendency of motion between "
                "two surfaces in contact. Static friction prevents relative motion and adjusts up to a "
                "maximum value μₛN where μₛ is the coefficient of static friction and N is the normal "
                "force. Kinetic friction during sliding is μₖN. Rolling friction is much smaller than "
                "sliding friction. Friction depends on the nature of surfaces and normal force, not on "
                "area of contact or speed."
            ),
        },
    },
    {
        "exam":    "JEE_MAIN",
        "subject": "Physics",
        "unit":    "Mechanics",
        "chapter": "Work Energy Power",
        "source":  "textbook",
        "topics": {
            "Work Done by a Force": (
                "Work done by a force is the scalar product of force and displacement vectors. "
                "W = F · d = Fd cos θ, where θ is the angle between the force and displacement. "
                "Work is a scalar quantity with SI unit Joule (J). One Joule equals the work done "
                "when a 1 N force moves a body through 1 metre in its direction. Work is positive "
                "when force and displacement are in the same direction, negative when opposite, and "
                "zero when force is perpendicular to displacement (e.g., centripetal force)."
            ),
            "Kinetic Energy": (
                "Kinetic energy is the energy possessed by a body by virtue of its motion. It equals "
                "KE = ½mv², where m is mass in kg and v is speed in m/s. The SI unit is Joule. "
                "Kinetic energy is always non-negative. The work-energy theorem states that the net "
                "work done on a body equals the change in its kinetic energy: W_net = ΔKE = ½mv² − ½mu². "
                "This theorem applies whether forces are constant or variable."
            ),
            "Potential Energy": (
                "Potential energy is energy stored in a body due to its position or configuration. "
                "Gravitational potential energy PE = mgh, where m is mass, g is acceleration due to "
                "gravity, and h is height above a reference level. Elastic potential energy stored in "
                "a spring is PE = ½kx², where k is the spring constant and x is the compression or "
                "extension. Potential energy is a scalar measured in Joules. Changes in PE are "
                "independent of the reference point chosen."
            ),
            "Conservation of Energy": (
                "The law of conservation of mechanical energy states that in a conservative force field "
                "the total mechanical energy E = KE + PE remains constant. When kinetic energy increases, "
                "potential energy decreases by the same amount and vice versa. In the presence of "
                "non-conservative forces such as friction, mechanical energy decreases and converts to "
                "heat. The total energy of an isolated system is always conserved regardless of internal "
                "processes."
            ),
        },
    },
    {
        "exam":    "JEE_MAIN",
        "subject": "Chemistry",
        "unit":    "Organic Chemistry",
        "chapter": "Hydrocarbons",
        "source":  "textbook",
        "topics": {
            "Alkanes": (
                "Alkanes are saturated hydrocarbons with general molecular formula CₙH₂ₙ₊₂. They "
                "contain only carbon–carbon single bonds and carbon–hydrogen bonds. Methane CH₄ is the "
                "simplest alkane. Alkanes undergo free-radical substitution reactions with halogens in "
                "the presence of UV light. They are relatively unreactive but combust in oxygen to yield "
                "CO₂ and H₂O. Alkanes are named by IUPAC nomenclature with the suffix '-ane' and are "
                "widely used as fuels (LPG, petrol)."
            ),
            "Alkenes": (
                "Alkenes are unsaturated hydrocarbons containing one or more carbon–carbon double bonds "
                "C=C with general formula CₙH₂ₙ. Ethene CH₂=CH₂ is the simplest alkene. They undergo "
                "electrophilic addition reactions including halogenation, hydrohalogenation, hydration, "
                "and catalytic hydrogenation. Markovnikov's rule governs the orientation of addition of "
                "unsymmetric reagents to asymmetric alkenes. The restricted rotation about the double "
                "bond makes cis–trans isomerism possible. Alkenes are more reactive than alkanes due to "
                "the presence of the π bond."
            ),
            "Alkynes": (
                "Alkynes contain a carbon–carbon triple bond C≡C and have general formula CₙH₂ₙ₋₂. "
                "Ethyne (acetylene) HC≡CH is the simplest alkyne. Alkynes undergo electrophilic addition "
                "reactions similar to alkenes and also show acidic character due to the terminal C–H "
                "bond. Terminal alkynes are weakly acidic and react with strong bases and heavy metal "
                "salts to form metal acetylides. They are used in oxy-acetylene welding. Alkynes are "
                "more reactive and more acidic than alkenes."
            ),
        },
    },
]

# ---------------------------------------------------------------------------
# Retrieval evaluation cases
# ---------------------------------------------------------------------------

@dataclass
class EvalCase:
    """One retrieval test: a query and the expected topics that should appear in top_k results."""
    query:            str
    expected_topics:  list[str]
    exam:             str         = "JEE_MAIN"
    subject:          str | None  = None
    chapter:          str | None  = None
    top_k:            int         = 5
    min_score:        float       = 0.15   # minimum acceptable cosine similarity for a hit

RETRIEVAL_EVAL_CASES: list[EvalCase] = [
    EvalCase(
        query="formula for force equals mass times acceleration",
        expected_topics=["Newton's Second Law"],
        subject="Physics",
    ),
    EvalCase(
        query="every action has an equal and opposite reaction",
        expected_topics=["Newton's Third Law"],
        subject="Physics",
    ),
    EvalCase(
        query="energy of a moving object formula",
        expected_topics=["Kinetic Energy"],
        subject="Physics",
    ),
    EvalCase(
        query="work done force displacement angle scalar product",
        expected_topics=["Work Done by a Force"],
        subject="Physics",
    ),
    EvalCase(
        query="total mechanical energy constant conservation law",
        expected_topics=["Conservation of Energy"],
        subject="Physics",
    ),
    EvalCase(
        query="gravitational potential energy height mass gravity",
        expected_topics=["Potential Energy"],
        subject="Physics",
    ),
    EvalCase(
        query="carbon double bond addition reactions organic",
        expected_topics=["Alkenes"],
        subject="Chemistry",
    ),
    EvalCase(
        query="saturated hydrocarbons substitution halogenation",
        expected_topics=["Alkanes"],
        subject="Chemistry",
    ),
]

# Evaluation thresholds
EVAL_MIN_HIT_RATE = 0.60    # ≥60% of cases must hit in top_k
EVAL_MIN_MRR      = 0.35    # mean reciprocal rank ≥ 0.35

# ---------------------------------------------------------------------------
# Demo test generation requests (for backend smoke tests)
# ---------------------------------------------------------------------------

DEMO_GENERATE_REQUESTS: list[dict] = [
    {
        "exam":          "JEE_MAIN",
        "subjects":      ["Physics"],
        "difficulty":    "mixed",
        "questionCount": 10,
        "mode":          "normal",
    },
    {
        "exam":          "NEET",
        "subjects":      ["Biology", "Chemistry"],
        "difficulty":    "easy",
        "questionCount": 15,
        "mode":          "normal",
    },
    {
        "exam":          "CBSE",
        "subjects":      ["Physics"],
        "cbseClass":     "11",
        "questionCount": 10,
        "mode":          "normal",
    },
]
