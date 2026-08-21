import type { Database, MasteryLevel, ResourceType, TopicStatus, UnitType } from "./types";

const now = "2026-08-21T08:00:00.000Z";
const today = "2026-08-21";
const STUDENT_ID = "student-1";

function db(): Database {
  return {
    institutions: [], programmes: [], academic_periods: [], courses: [], course_offerings: [],
    topics: [], subtopics: [], skills: [], topic_skills: [], learning_units: [],
    content_resources: [], topic_resources: [], questions: [], question_options: [],
    practicals: [], practical_steps: [], student_profiles: [], enrolments: [],
    student_course_enrolments: [], study_sessions: [], learning_attempts: [],
    question_attempts: [], topic_mastery: [], skill_mastery: [], review_schedule: [],
    recommendations: [], study_plans: [], study_plan_items: [], uploaded_materials: [],
    ai_conversations: [], ai_messages: [],
  };
}

const data = db();
let topicSeq = 0;

type Q = { text: string; type?: "multiple_choice" | "true_false" | "short_answer" | "numeric"; options?: string[]; answer: string | number; explain: string; diff?: number; hint?: string };
type Unit = { title: string; type: UnitType; mins: number; body: string; diff?: number };
type Resource = { title: string; type: ResourceType; url?: string; provider?: string };
type SubtopicBP = { name: string; units: Unit[]; questions?: Q[]; practical?: { title: string; objective: string; steps: string[] } };
type CourseBlueprint = {
  slug: string; code: string; name: string; category: string; description: string; credits: number;
  lecturer?: string; build: (courseId: string) => void;
};

function addTopic(
  courseId: string, name: string, description: string, skillIds: string[],
  subtopics: SubtopicBP[], resources: Resource[] = [], status: TopicStatus = "confirmed"
): string {
  topicSeq++;
  const tid = `t-${topicSeq}`;
  data.topics.push({
    id: tid, course_id: courseId, name, description, sequence_number: topicSeq, status,
    source_type: status === "student_added" ? "student" : "curriculum", source_reference: null,
    estimated_minutes: 120,
  });
  skillIds.forEach((sid) => data.topic_skills.push({ topic_id: tid, skill_id: sid, importance: 1 }));

  subtopics.forEach((sub, si) => {
    const subId = `s-${tid}-${si + 1}`;
    data.subtopics.push({ id: subId, topic_id: tid, name: sub.name, description: null, sequence_number: si + 1, status: "active" });

    sub.units.forEach((u, ui) => {
      data.learning_units.push({
        id: `lu-${tid}-${si + 1}-${ui + 1}`, topic_id: tid, subtopic_id: subId, title: u.title,
        unit_type: u.type, sequence_number: ui + 1, description: u.body.slice(0, 120), body: u.body,
        estimated_minutes: u.mins, difficulty: u.diff ?? 2, status: "approved",
      });
    });

    sub.questions?.forEach((q, qi) => {
      const qid = `q-${tid}-${si + 1}-${qi + 1}`;
      const qType = q.type ?? (q.options ? "multiple_choice" : "short_answer");
      const correct =
        qType === "numeric" ? { number: q.answer as number }
        : qType === "multiple_choice" || qType === "true_false" ? { key: q.answer as string }
        : { value: String(q.answer) };
      data.questions.push({
        id: qid, topic_id: tid, subtopic_id: subId, question_type: qType, difficulty: q.diff ?? 2,
        question_text: q.text, explanation: q.explain, hint_1: q.hint ?? null, hint_2: null,
        correct_answer: correct, estimated_seconds: 90, status: "approved",
      });
      q.options?.forEach((otext, oi) => {
        data.question_options.push({
          id: `qo-${qid}-${oi + 1}`, question_id: qid,
          option_key: String.fromCharCode(65 + oi), option_text: otext, sequence_number: oi + 1,
        });
      });
    });

    if (sub.practical) {
      const pid = `p-${tid}`;
      data.practicals.push({
        id: pid, topic_id: tid, title: sub.practical.title, objective: sub.practical.objective,
        background: description, materials: ["Lab notebook", "Apparatus as listed", "PPE"],
        safety_notes: "Wear a lab coat and safety glasses. Follow demonstrator instructions.",
        expected_outcome: "Recorded observations consistent with the theory.",
        assessment_notes: "Submit a written report including data, analysis and conclusion.", status: "approved",
      });
      sub.practical.steps.forEach((instr, pi) =>
        data.practical_steps.push({
          id: `ps-${pid}-${pi + 1}`, practical_id: pid, step_number: pi + 1,
          instruction: instr, expected_action: null, observation_prompt: "Record your observation.",
        })
      );
    }
  });

  resources.forEach((r, ri) => {
    const rid = `r-${tid}-${ri + 1}`;
    data.content_resources.push({
      id: rid, title: r.title, description: null, resource_type: r.type, url: r.url ?? null,
      provider: r.provider ?? null, author: null,
      duration_seconds: r.type === "youtube" ? 720 : null, difficulty: 2, status: "active", source_type: "curated",
    });
    data.topic_resources.push({ topic_id: tid, resource_id: rid, relationship_type: "supports", sequence_number: ri + 1 });
  });

  return tid;
}

/* ---------------- Course blueprints (reusable across institutions/programmes) ---------------- */
const calcTopic = (cid: string) => {
  addTopic(cid, "Limits and Continuity", "Understanding the foundation of the derivative through limits.", ["sk-limits"], [
    { name: "Intuitive notion of a limit", units: [
      { title: "What is a limit?", type: "explanation", mins: 12, diff: 1, body: "A limit describes the value a function approaches as the input gets close to some point. We write lim x→a f(x) = L. Limits do not depend on the value of f at a — only on the behaviour near a. This distinction is what makes calculus possible." },
      { title: "Estimating limits from tables", type: "worked_example", mins: 10, diff: 2, body: "Evaluate f(x) for x approaching a from both sides. If both sides approach the same number, the limit exists. Example: for f(x)=(x²−1)/(x−1) near x=1, values approach 2, so the limit is 2 even though f(1) is undefined." },
      { title: "Limit laws", type: "explanation", mins: 14, diff: 2, body: "The limit of a sum, difference, product and quotient equals the same combination of individual limits, provided the denominator's limit is non-zero. These laws let us break complicated limits into simple pieces." },
    ], questions: [
      { text: "Evaluate lim x→2 (3x + 1).", type: "numeric", answer: 7, explain: "By direct substitution, 3(2)+1 = 7.", diff: 1 },
      { text: "The limit lim x→a f(x) requires f(a) to be defined.", type: "true_false", answer: "false", explain: "A limit depends only on behaviour near a, not on f(a).", diff: 1 },
      { text: "lim x→1 (x²−1)/(x−1) equals:", options: ["0", "1", "2", "undefined"], answer: "C", explain: "Factor as (x−1)(x+1)/(x−1) = x+1, which approaches 2.", diff: 2, hint: "Factor the numerator." },
    ]},
    { name: "Continuity", units: [
      { title: "Definition of continuity", type: "explanation", mins: 10, diff: 2, body: "A function is continuous at a if f(a) is defined, lim x→a f(x) exists, and the limit equals f(a). Polynomials, rationals on their domains, and trig functions are continuous where defined." },
    ], questions: [
      { text: "Which condition is NOT required for continuity at a?", options: ["f(a) is defined", "The limit exists", "f(a) equals the limit", "f is differentiable"], answer: "D", explain: "Differentiability is stronger than continuity; continuity does not require it.", diff: 2 },
    ]},
  ], [
    { title: "3Blue1Brown — The essence of calculus (Ep 1)", type: "youtube", url: "https://www.youtube.com/watch?v=WUvTyaaNkzM", provider: "3Blue1Brown" },
    { title: "Khan Academy — Limits and continuity", type: "website", url: "https://www.khanacademy.org/math/calculus-1/cs1-limits-and-continuity", provider: "Khan Academy" },
    { title: "Essence of Calculus (full playlist)", type: "youtube", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr", provider: "3Blue1Brown" },
  ]);

  addTopic(cid, "Derivatives", "Rates of change, differentiation rules and applications.", ["sk-diff"], [
    { name: "The derivative", units: [
      { title: "Definition of the derivative", type: "explanation", mins: 14, diff: 3, body: "f'(x) = lim h→0 [f(x+h) − f(x)]/h. This is the instantaneous rate of change and the slope of the tangent line. The whole of differential calculus builds on this single limit." },
      { title: "Power rule worked example", type: "worked_example", mins: 9, diff: 1, body: "d/dx xⁿ = n xⁿ⁻¹. So d/dx x³ = 3x² and d/dx x⁵ = 5x⁴. Constants multiply through, and the derivative of a constant is zero." },
      { title: "Product and quotient rules", type: "explanation", mins: 14, diff: 3, body: "Product rule: (fg)' = f'g + fg'. Quotient rule: (f/g)' = (f'g − fg')/g². Identify f and g before differentiating to avoid sign errors." },
    ], questions: [
      { text: "The derivative measures:", options: ["Area under a curve", "Instantaneous rate of change", "Average value", "The intercept"], answer: "B", explain: "The derivative is the instantaneous rate of change.", diff: 1 },
      { text: "If f(x)=3x²+2x, f'(x)=", options: ["6x+2", "3x+2", "6x²+2", "6x"], answer: "A", explain: "Differentiate term by term: 6x + 2.", diff: 2 },
    ], practical: { title: "Estimating a derivative numerically", objective: "Approximate the slope of a curve using secant lines with shrinking h.", steps: [
      "Choose f(x)=x² at x=1.", "Compute [f(1+h)−f(1)]/h for h=0.1, 0.01, 0.001.",
      "Record the values in a table.", "Observe that they approach 2, the exact derivative.",
    ]}},
  ], [
    { title: "Khan Academy — Derivatives introduction", type: "website", url: "https://www.khanacademy.org/math/differential-calculus/dc-diff-intro", provider: "Khan Academy" },
    { title: "3Blue1Brown — Derivative paradox", type: "youtube", url: "https://www.youtube.com/watch?v=9vKqVkMQHKk", provider: "3Blue1Brown" },
  ]);

  addTopic(cid, "L'Hôpital's Rule", "Using derivatives to evaluate indeterminate limits.", ["sk-limits", "sk-diff"], [
    { name: "Indeterminate forms", units: [
      { title: "When substitution gives 0/0", type: "explanation", mins: 10, diff: 3, body: "If lim f/g yields 0/0 or ∞/∞, l'Hôpital's rule lets us differentiate numerator and denominator and take the limit again. Verify the indeterminate form before applying it." },
    ], questions: [
      { text: "L'Hôpital's rule applies to 0/0 and ∞/∞ forms.", type: "true_false", answer: "true", explain: "These are the standard indeterminate forms it handles.", diff: 2 },
    ]},
  ], [
    { title: "3Blue1Brown — L'Hôpital's rule", type: "youtube", url: "https://www.youtube.com/watch?v=kfF4ryha0Vo", provider: "3Blue1Brown" },
  ], "student_added");
};

const statsTopic = (cid: string) => {
  addTopic(cid, "Probability Fundamentals", "Sample spaces, events and basic rules.", ["sk-prob"], [
    { name: "Probability rules", units: [
      { title: "Classical probability", type: "explanation", mins: 12, diff: 2, body: "P(A) = favourable outcomes / total outcomes. The complement rule: P(not A)=1−P(A). For disjoint events, P(A or B)=P(A)+P(B); for independent events, P(A and B)=P(A)P(B)." },
    ], questions: [
      { text: "A fair die rolls. P(even) =", options: ["1/6", "1/3", "1/2", "2/3"], answer: "C", explain: "Three even faces out of six = 1/2.", diff: 1 },
      { text: "Independent events affect each other's probability.", type: "true_false", answer: "false", explain: "Independence means one does not change the other's probability.", diff: 2 },
    ]},
  ], [
    { title: "Khan Academy — Probability", type: "website", url: "https://www.khanacademy.org/math/statistics-probability/probability-library", provider: "Khan Academy" },
  ]);
};

const mechanicsTopic = (cid: string) => {
  addTopic(cid, "Newton's Laws of Motion", "Forces, mass and the relationship between them.", ["sk-newton"], [
    { name: "The three laws", units: [
      { title: "First law — inertia", type: "explanation", mins: 9, diff: 1, body: "A body remains at rest or in uniform straight-line motion unless acted on by a net external force. This overturned the older idea that motion requires a continued cause." },
      { title: "Second law — F = ma", type: "explanation", mins: 14, diff: 2, body: "The net force on an object equals its mass times its acceleration: ΣF = ma. Force and acceleration are vectors and point the same way. Use a free-body diagram to identify all forces." },
      { title: "Third law — action & reaction", type: "explanation", mins: 9, diff: 2, body: "For every action there is an equal and opposite reaction. The two forces act on different bodies, so they never cancel each other on a single object." },
      { title: "Solving force problems", type: "worked_example", mins: 12, diff: 3, body: "A 5 kg box on a frictionless floor is pulled by a 20 N horizontal force. Acceleration a = F/m = 20/5 = 4 m/s². Always resolve forces along convenient axes and apply ΣF = ma separately." },
    ], questions: [
      { text: "A 5 kg object experiences a net force of 20 N. Its acceleration is:", options: ["0.25 m/s²", "4 m/s²", "25 m/s²", "100 m/s²"], answer: "B", explain: "a = F/m = 20/5 = 4 m/s².", diff: 1, hint: "Use F = ma and rearrange." },
      { text: "Newton's third law forces always act on the same object.", type: "true_false", answer: "false", explain: "Action–reaction pairs act on different bodies.", diff: 1 },
      { text: "Inertia is the tendency of an object to:", options: ["Accelerate", "Resist changes in motion", "Gain mass", "Exert gravity"], answer: "B", explain: "Inertia is resistance to changes in velocity, measured by mass.", diff: 2 },
    ], practical: { title: "Verifying F = ma with a dynamics cart", objective: "Show that acceleration is proportional to force for constant mass.", steps: [
      "Set up a track, cart and pulley.", "Keep cart mass constant; vary hanging mass to change force.",
      "Time the cart over a fixed distance for each force.", "Plot acceleration against force and confirm a straight line.",
    ]}},
  ], [
    { title: "CrashCourse Physics — Newton's Laws", type: "youtube", url: "https://www.youtube.com/watch?v=kKKM8Y-u7ds", provider: "CrashCourse" },
    { title: "Khan Academy — Forces and Newton's laws", type: "website", url: "https://www.khanacademy.org/science/physics/forces-newtons-laws", provider: "Khan Academy" },
  ]);

  addTopic(cid, "Work, Energy and Power", "Conservation of mechanical energy.", ["sk-energy"], [
    { name: "Energy conservation", units: [
      { title: "Kinetic and potential energy", type: "explanation", mins: 12, diff: 2, body: "Kinetic energy K = ½mv². Gravitational potential energy U = mgh. In the absence of non-conservative forces, K + U is conserved." },
      { title: "Worked energy problem", type: "worked_example", mins: 10, diff: 3, body: "A 2 kg ball dropped from 5 m converts potential energy mgh=98 J into kinetic energy at ground level. Its speed from ½mv²=98 is about 9.9 m/s." },
    ], questions: [
      { text: "Doubling an object's speed multiplies its kinetic energy by:", options: ["2", "4", "8", "1"], answer: "B", explain: "K depends on v², so doubling speed quadruples K.", diff: 2 },
      { text: "Mechanical energy is conserved when only conservative forces act.", type: "true_false", answer: "true", explain: "With no friction or drag, K + U stays constant.", diff: 1 },
    ]},
  ], [
    { title: "Khan Academy — Work and energy", type: "website", url: "https://www.khanacademy.org/science/physics/work-and-energy", provider: "Khan Academy" },
  ]);
};

const chemistryTopic = (cid: string) => {
  addTopic(cid, "Atomic Structure and Bonding", "Electrons, orbitals and how atoms combine.", ["sk-bonding"], [
    { name: "Atomic structure", units: [
      { title: "Subatomic particles", type: "explanation", mins: 10, diff: 1, body: "Atoms contain protons (positive), neutrons (neutral) in the nucleus, and electrons (negative) in orbitals. Atomic number = number of protons; mass number = protons + neutrons." },
      { title: "Electron configuration", type: "explanation", mins: 14, diff: 3, body: "Electrons fill orbitals in order 1s, 2s, 2p, 3s, 3p… with at most two electrons per orbital (opposite spins). Configuration explains periodic trends and bonding." },
    ], questions: [
      { text: "Which particle determines the element?", options: ["Neutron", "Electron", "Proton", "Ion"], answer: "C", explain: "Atomic number (proton count) defines the element.", diff: 1 },
      { text: "A covalent bond involves ______ of electrons.", type: "short_answer", answer: "sharing", explain: "Covalent bonds form when atoms share electron pairs.", diff: 1 },
    ]},
  ], [
    { title: "Khan Academy — Atoms, compounds, ions", type: "website", url: "https://www.khanacademy.org/science/chemistry/atomic-structure-and-properties", provider: "Khan Academy" },
    { title: "CrashCourse Chemistry — The Nucleus", type: "youtube", url: "https://www.youtube.com/watch?v=FSyAehMdpyI", provider: "CrashCourse" },
  ]);

  addTopic(cid, "Stoichiometry", "Quantitative relationships in chemical reactions.", ["sk-stoich"], [
    { name: "The mole", units: [
      { title: "Moles and molar mass", type: "explanation", mins: 12, diff: 2, body: "One mole contains 6.022×10²³ particles. Molar mass converts between grams and moles: n = m/M. Balanced equations give mole ratios between reactants and products." },
      { title: "Worked stoichiometry", type: "worked_example", mins: 12, diff: 3, body: "For 2H₂ + O₂ → 2H₂O, 2 moles of H₂ react with 1 mole of O₂. To make 4 moles of water you need 4 moles H₂ and 2 moles O₂." },
    ], questions: [
      { text: "How many moles of H₂O form from 4 mol H₂ in 2H₂+O₂→2H₂O?", type: "numeric", answer: 4, explain: "The ratio of H₂ to H₂O is 1:1, so 4 mol H₂ yields 4 mol H₂O.", diff: 2, hint: "Use the mole ratio from the balanced equation." },
    ]},
  ], [
    { title: "Khan Academy — Stoichiometry", type: "website", url: "https://www.khanacademy.org/science/chemistry/chemical-reactions-stoichiome", provider: "Khan Academy" },
  ]);
};

const biologyTopic = (cid: string) => {
  addTopic(cid, "Cell Structure and Function", "Prokaryotic versus eukaryotic cells and organelles.", ["sk-cell"], [
    { name: "The cell", units: [
      { title: "Cell theory", type: "explanation", mins: 8, diff: 1, body: "All organisms are made of cells; the cell is the basic unit of life; all cells arise from pre-existing cells. Cells are either prokaryotic (no nucleus) or eukaryotic (membrane-bound nucleus)." },
      { title: "Organelles", type: "explanation", mins: 14, diff: 2, body: "The nucleus stores DNA; mitochondria produce ATP; ribosomes build proteins; the ER and Golgi process and transport molecules; chloroplasts (in plants) perform photosynthesis." },
    ], questions: [
      { text: "Which organelle is the site of cellular respiration?", options: ["Nucleus", "Mitochondrion", "Ribosome", "Vacuole"], answer: "B", explain: "Mitochondria generate ATP through respiration.", diff: 1 },
      { text: "Prokaryotic cells have a membrane-bound nucleus.", type: "true_false", answer: "false", explain: "Prokaryotes lack a nucleus; their DNA is free in the cytoplasm.", diff: 1 },
    ]},
  ], [
    { title: "Amoeba Sisters — Introduction to Cells", type: "youtube", url: "https://www.youtube.com/watch?v=8IlzKri08kk", provider: "Amoeba Sisters" },
    { title: "Khan Academy — Cell structure", type: "website", url: "https://www.khanacademy.org/science/biology/structure-of-a-cell", provider: "Khan Academy" },
  ]);

  addTopic(cid, "Mendelian Genetics", "Inheritance, Punnett squares and probability.", ["sk-genetics"], [
    { name: "Monohybrid crosses", units: [
      { title: "Dominance and segregation", type: "explanation", mins: 12, diff: 2, body: "Alleles can be dominant or recessive. A monohybrid cross Aa × Aa produces a genotypic ratio 1:2:1 and phenotypic ratio 3:1. Punnett squares make the combinations explicit." },
    ], questions: [
      { text: "In Aa × Aa, what fraction show the dominant phenotype?", options: ["1/4", "1/2", "3/4", "1"], answer: "C", explain: "AA, Aa, Aa show dominant; aa is recessive = 3/4.", diff: 2 },
    ]},
  ], [
    { title: "Amoeba Sisters — Monohybrid crosses", type: "youtube", url: "https://www.youtube.com/watch?v=i-0rSv6oxqg", provider: "Amoeba Sisters" },
  ]);
};

const microbiologyTopic = (cid: string) => {
  addTopic(cid, "Microbial Growth and Control", "How microbes grow and how we control them.", ["sk-microbe", "sk-asex"], [
    { name: "Growth and sterilisation", units: [
      { title: "Bacterial growth curve", type: "explanation", mins: 12, diff: 2, body: "Populations show lag, log (exponential), stationary and death phases. Growth depends on temperature, pH, nutrients and oxygen." },
      { title: "Control methods", type: "explanation", mins: 10, diff: 2, body: "Sterilisation kills all microbes; disinfection reduces pathogens on surfaces; antisepsis treats living tissue. Autoclaving uses moist heat under pressure." },
    ], questions: [
      { text: "Which phase features exponential cell division?", options: ["Lag", "Log", "Stationary", "Death"], answer: "B", explain: "The log phase is exponential growth.", diff: 1 },
      { text: "Autoclaving kills all microbial life including endospores.", type: "true_false", answer: "true", explain: "Steam under pressure achieves sterilisation.", diff: 1 },
    ], practical: { title: "Aseptic technique and streak plating", objective: "Isolate a single bacterial colony using sterile technique.", steps: [
      "Sterilise the inoculating loop in a flame until red hot.", "Allow it to cool, then collect a small sample.",
      "Streak the first quadrant of an agar plate.", "Flame the loop again and streak the next quadrant from the edge of the first.",
      "Repeat, then incubate inverted at 37°C for 24–48 hours and observe isolated colonies.",
    ]}},
  ], [
    { title: "Khan Academy — Prokaryotes and bacteria", type: "website", url: "https://www.khanacademy.org/science/biology/bacteria-archaea", provider: "Khan Academy" },
  ]);
};

const compsTopic = (cid: string) => {
  addTopic(cid, "Number Systems and Data Representation", "Binary, hexadecimal and how computers store data.", ["sk-binary"], [
    { name: "Binary", units: [
      { title: "Binary and decimal", type: "explanation", mins: 12, diff: 2, body: "Binary uses base 2 with digits 0 and 1. Each position is a power of two. 1011₂ = 1×8 + 0×4 + 1×2 + 1×1 = 11₁₀. Hexadecimal (base 16) compactly represents groups of four bits." },
      { title: "Conversion practice", type: "worked_example", mins: 10, diff: 2, body: "Convert decimal 13 to binary: 13 = 8+4+1 = 1101₂. Convert back by summing powers of two from left to right." },
    ], questions: [
      { text: "What is 1010₂ in decimal?", options: ["8", "10", "12", "14"], answer: "B", explain: "8+2 = 10.", diff: 1, hint: "Sum the powers of two where bits are 1." },
      { text: "One byte contains 4 bits.", type: "true_false", answer: "false", explain: "One byte is 8 bits.", diff: 1 },
    ]},
  ], [
    { title: "CrashCourse Computer Science — Binary & Data", type: "youtube", url: "https://www.youtube.com/watch?v=1GSjbWt0d6c", provider: "CrashCourse" },
  ]);
};

const aiTopic = (cid: string) => {
  addTopic(cid, "Search and Problem Solving", "Uninformed and informed search algorithms.", ["sk-search"], [
    { name: "Search algorithms", units: [
      { title: "State-space search", type: "explanation", mins: 14, diff: 3, body: "A search problem has an initial state, actions, a transition model, a goal test and path cost. BFS explores level by level and finds shortest paths in unweighted graphs; DFS dives deep first and uses less memory." },
      { title: "A* search", type: "explanation", mins: 12, diff: 4, body: "A* uses f(n)=g(n)+h(n), combining cost-so-far with a heuristic estimate to the goal. With an admissible (never overestimating) heuristic, A* is optimal." },
    ], questions: [
      { text: "Which search guarantees the shortest path in an unweighted graph?", options: ["DFS", "BFS", "Greedy", "Hill climbing"], answer: "B", explain: "BFS expands by depth, finding shortest paths first.", diff: 2 },
      { text: "An admissible heuristic never overestimates true cost.", type: "true_false", answer: "true", explain: "Admissibility is required for A* optimality.", diff: 2 },
    ]},
  ], [
    { title: "MIT OpenCourseWare — Search", type: "youtube", url: "https://www.youtube.com/watch?v=D1hF9jLxTts", provider: "MIT OCW" },
    { title: "Sebastian Lague — A* pathfinding", type: "youtube", url: "https://www.youtube.com/watch?v=-L-WgKMFuhE", provider: "YouTube" },
  ]);

  addTopic(cid, "Machine Learning Foundations", "Supervised learning, features and models.", ["sk-ml"], [
    { name: "Learning from data", units: [
      { title: "What is machine learning?", type: "explanation", mins: 12, diff: 2, body: "ML systems learn patterns from examples instead of being explicitly programmed. Supervised learning maps inputs to labelled outputs; unsupervised learning finds structure; reinforcement learning learns by reward." },
      { title: "Overfitting", type: "explanation", mins: 10, diff: 3, body: "A model overfits when it memorises training data but fails on new examples. Use held-out test data, simpler models and regularisation to generalise better." },
    ], questions: [
      { text: "Training with labels is called:", options: ["Supervised", "Unsupervised", "Reinforcement", "Clustering"], answer: "A", explain: "Supervised learning uses labelled examples.", diff: 1 },
    ]},
  ], [
    { title: "3Blue1Brown — But what is a neural network?", type: "youtube", url: "https://www.youtube.com/watch?v=aircAruvnKk", provider: "3Blue1Brown" },
  ]);
};

const agEconTopic = (cid: string) => {
  addTopic(cid, "Supply and Demand", "How markets set prices and quantities.", ["sk-supply"], [
    { name: "Market equilibrium", units: [
      { title: "Demand and supply curves", type: "explanation", mins: 14, diff: 2, body: "Demand slopes downward (lower price → more demanded); supply slopes upward. Their intersection is the equilibrium price and quantity. Shifters such as income, input costs or policy move the curves." },
    ], questions: [
      { text: "At equilibrium:", options: ["Supply exceeds demand", "Demand exceeds supply", "Quantity supplied equals quantity demanded", "Price is zero"], answer: "C", explain: "Equilibrium is where the curves cross.", diff: 1 },
    ]},
  ], [
    { title: "Khan Academy — Supply, demand, and market equilibrium", type: "website", url: "https://www.khanacademy.org/economics-finance-domain/microeconomics/supply-demand-equilibrium", provider: "Khan Academy" },
  ]);
};

const soilTopic = (cid: string) => {
  addTopic(cid, "Soil pH and Fertility", "Measuring and managing soil acidity.", ["sk-soilph"], [
    { name: "Soil reaction", units: [
      { title: "What pH means for soil", type: "explanation", mins: 12, diff: 2, body: "pH measures hydrogen-ion activity. Most crops prefer pH 6.0–7.0 where nutrients are most available. Acidic soils are often limed; alkaline soils may need elemental sulphur or organic matter." },
    ], questions: [
      { text: "Most crops grow best in soil pH of approximately:", options: ["3.0–4.0", "6.0–7.0", "9.0–10.0", "11–12"], answer: "B", explain: "Near-neutral pH maximises nutrient availability.", diff: 1 },
    ], practical: { title: "Measuring soil pH with a pH meter", objective: "Determine the pH of three soil samples.", steps: [
      "Air-dry and sieve each soil sample.", "Mix 1 part soil with 2 parts distilled water and stir.",
      "Let the suspension stand for 30 minutes.", "Calibrate the pH meter with buffers.",
      "Insert the electrode into the supernatant and record pH for each sample.",
    ]}},
  ], [
    { title: "FAO — Soil fertility and management", type: "website", url: "https://www.fao.org/soils-portal/soil-management/", provider: "FAO" },
  ]);
};

const physicsTopic = (cid: string) => {
  addTopic(cid, "Heat and Temperature", "Thermal expansion and heat transfer.", ["sk-energy"], [
    { name: "Heat transfer", units: [
      { title: "Conduction, convection, radiation", type: "explanation", mins: 12, diff: 2, body: "Heat moves by direct contact (conduction), fluid flow (convection) and electromagnetic waves (radiation). Q = mcΔT relates heat transfer to temperature change." },
    ], questions: [
      { text: "Heat transfer through empty space occurs by:", options: ["Conduction", "Convection", "Radiation", "Insulation"], answer: "C", explain: "Radiation does not require a medium.", diff: 1 },
    ]},
  ], [
    { title: "Khan Academy — Thermodynamics", type: "website", url: "https://www.khanacademy.org/science/physics/thermodynamics", provider: "Khan Academy" },
  ]);
};

// Course-specific (single-offer) blueprints
const plantTopic = (cid: string) => {
  addTopic(cid, "Plant Tissues and Transport", "How plants are structured and move water and nutrients.", ["sk-cell"], [
    { name: "Plant anatomy", units: [
      { title: "Roots, stems and leaves", type: "explanation", mins: 12, diff: 2, body: "Roots anchor the plant and absorb water; stems support and transport through xylem (water) and phloem (sugars); leaves are the main site of photosynthesis through stomata and chloroplasts." },
    ], questions: [
      { text: "Which tissue transports water upward in a plant?", options: ["Phloem", "Xylem", "Stomata", "Cuticle"], answer: "B", explain: "Xylem carries water and minerals from roots to leaves.", diff: 1 },
    ]},
  ], [
    { title: "Amoeba Sisters — Plant structure", type: "youtube", url: "https://www.youtube.com/watch?v=6C9Y9b0jUqk", provider: "Amoeba Sisters" },
  ]);
};

const ecologyTopic = (cid: string) => {
  addTopic(cid, "Ecosystems and Energy Flow", "Food webs, trophic levels and nutrient cycling.", ["sk-cell"], [
    { name: "Energy flow", units: [
      { title: "Trophic levels", type: "explanation", mins: 12, diff: 2, body: "Energy flows from producers to primary consumers, secondary consumers and decomposers. Only about 10% transfers between levels, which limits food-chain length and shapes ecosystem structure." },
    ], questions: [
      { text: "Roughly what fraction of energy transfers between trophic levels?", options: ["1%", "10%", "50%", "90%"], answer: "B", explain: "The 10% rule describes typical energy transfer.", diff: 2 },
    ]},
  ], [
    { title: "CrashCourse Ecology — Ecosystem Ecology", type: "youtube", url: "https://www.youtube.com/watch?v=v6ubvEJ3KGM", provider: "CrashCourse" },
  ]);
};

const dataStructuresTopic = (cid: string) => {
  addTopic(cid, "Algorithms and Complexity", "Analysing algorithm efficiency with Big-O notation.", ["sk-search"], [
    { name: "Big-O notation", units: [
      { title: "Why complexity matters", type: "explanation", mins: 12, diff: 2, body: "Big-O describes how an algorithm's runtime grows with input size: O(1) constant, O(log n) logarithmic, O(n) linear, O(n log n) linearithmic, O(n²) quadratic. We keep the dominant term and drop constants." },
      { title: "Analysing loops", type: "worked_example", mins: 10, diff: 3, body: "A single loop over n items is O(n). Two nested loops over n give O(n²). Binary search halves the search space each step, so it is O(log n)." },
    ], questions: [
      { text: "Binary search over a sorted array runs in:", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], answer: "B", explain: "Halving the space each step gives O(log n).", diff: 2 },
      { text: "Two nested loops over n items give O(n²).", type: "true_false", answer: "true", explain: "Nested iterations multiply to n².", diff: 1 },
    ]},
  ], [
    { title: "Harvard CS50 — Algorithms", type: "youtube", url: "https://www.youtube.com/watch?v=ktgLw77I2Jo", provider: "CS50" },
    { title: "Khan Academy — Algorithms", type: "website", url: "https://www.khanacademy.org/computing/computer-science/algorithms", provider: "Khan Academy" },
  ]);
};

const BLUEPRINTS: CourseBlueprint[] = [
  { slug: "calc", code: "NMAT32122", name: "Calculus I", category: "Mathematics", description: "Limits, derivatives and introductory integration.", credits: 10, lecturer: "Dr. T. Banda", build: calcTopic },
  { slug: "stats", code: "NBAT32107", name: "Statistics I", category: "Mathematics", description: "Descriptive statistics, probability and distributions.", credits: 10, lecturer: "Mr. J. Phiri", build: statsTopic },
  { slug: "physics", code: "NPHY31105", name: "Physics I", category: "Physical Sciences", description: "Mechanics, heat and properties of matter.", credits: 10, lecturer: "Dr. L. Mhone", build: physicsTopic },
  { slug: "mech", code: "NPHY32104", name: "Mechanics I", category: "Physical Sciences", description: "Newtonian mechanics, forces, energy and momentum.", credits: 10, lecturer: "Dr. L. Mhone", build: mechanicsTopic },
  { slug: "chem1", code: "NCHE31104", name: "Introductory Chemistry I", category: "Chemistry", description: "Atomic structure, bonding and stoichiometry.", credits: 10, lecturer: "Prof. R. Chirwa", build: chemistryTopic },
  { slug: "chem3", code: "NCHE32103", name: "Introductory Chemistry III", category: "Chemistry", description: "Organic chemistry and functional groups.", credits: 10, lecturer: "Prof. R. Chirwa", build: chemistryTopic },
  { slug: "bio", code: "NBIO31101", name: "General Biology I", category: "Biology", description: "Cell biology, genetics and evolution.", credits: 10, lecturer: "Dr. E. Nkhoma", build: biologyTopic },
  { slug: "plant", code: "NBIO32103", name: "Plant Form and Function", category: "Biology", description: "Plant anatomy, physiology and reproduction.", credits: 10, lecturer: "Dr. E. Nkhoma", build: plantTopic },
  { slug: "micro", code: "NBMB32101", name: "Microbiology", category: "Biology", description: "Microbial structure, growth and control.", credits: 10, lecturer: "Dr. P. Tembo", build: microbiologyTopic },
  { slug: "eco", code: "NDEV23203", name: "Ecology", category: "Biology", description: "Ecosystems, populations and environmental interactions.", credits: 8, lecturer: "Dr. S. Gondwe", build: ecologyTopic },
  { slug: "soil", code: "NBAT32104", name: "Soil Science", category: "Agricultural Sciences", description: "Soil formation, properties and fertility.", credits: 10, lecturer: "Dr. K. Msiska", build: soilTopic },
  { slug: "comps", code: "NCOM31103", name: "Introduction to Computer Systems", category: "Technology", description: "Hardware, operating systems and networking fundamentals.", credits: 10, lecturer: "Eng. C. Zulu", build: compsTopic },
  { slug: "ai", code: "NNAS32101", name: "Introduction to Artificial Intelligence", category: "Technology", description: "Search, reasoning, learning and intelligent agents.", credits: 10, lecturer: "Eng. C. Zulu", build: aiTopic },
  { slug: "agecon", code: "NAAE32101", name: "Introduction to Agricultural Economics", category: "Agricultural Economics", description: "Scarcity, markets and farm decision-making.", credits: 10, lecturer: "Dr. A. Kamanga", build: agEconTopic },
  { slug: "ds", code: "NDSC2201", name: "Data Structures & Algorithms", category: "Technology", description: "Fundamental data structures and algorithm analysis.", credits: 12, lecturer: "Dr. T. Mwale", build: dataStructuresTopic },
];

function instantiateProgramme(programmeId: string, periodId: string, slugs: string[]) {
  slugs.forEach((slug) => {
    const bp = BLUEPRINTS.find((b) => b.slug === slug)!;
    const courseId = `${slug}-${programmeId}`;
    data.courses.push({
      id: courseId, programme_id: programmeId, code: bp.code, name: bp.name, category: bp.category,
      description: bp.description, credits: bp.credits, course_type: "Core", status: "confirmed", source_type: "official_timetable",
    });
    data.course_offerings.push({
      id: `off-${courseId}`, course_id: courseId, academic_period_id: periodId,
      lecturer_name: bp.lecturer ?? null, status: "active",
    });
    bp.build(courseId);
  });
}

/* ---------------- Institutions & programmes ---------------- */
data.institutions.push(
  { id: "inst-luanar", name: "Lilongwe University of Agriculture and Natural Resources", short_name: "LUANAR", country: "Malawi", website_url: "https://www.luanar.ac.mw", is_active: true },
  { id: "inst-must", name: "Malawi University of Science and Technology", short_name: "MUST", country: "Malawi", website_url: "https://www.must.ac.mw", is_active: true },
  { id: "inst-unima", name: "University of Malawi", short_name: "UNIMA", country: "Malawi", website_url: "https://www.unima.ac.mw", is_active: true },
);

data.programmes.push(
  { id: "prog-nas", institution_id: "inst-luanar", name: "BSc in Natural & Applied Science", code: "NAS", description: "Interdisciplinary science bridging mathematics, physical sciences, biology and technology.", duration_years: 4, is_active: true },
  { id: "prog-ds", institution_id: "inst-must", name: "BSc Data Science", code: "DS", description: "Statistics, computing and AI for data-driven problem solving.", duration_years: 4, is_active: true },
  { id: "prog-cs", institution_id: "inst-unima", name: "BSc Computer Science", code: "CS", description: "Software systems, algorithms and computing foundations.", duration_years: 4, is_active: true },
);

data.academic_periods.push(
  { id: "ap-nas-y2s1", programme_id: "prog-nas", academic_year: 2026, year_level: 2, semester: 1, name: "Year 2 Semester 1", start_date: "2026-08-03", end_date: "2026-12-12", status: "active" },
  { id: "ap-ds-y2s1", programme_id: "prog-ds", academic_year: 2026, year_level: 2, semester: 1, name: "Year 2 Semester 1", start_date: "2026-08-03", end_date: "2026-12-12", status: "active" },
  { id: "ap-cs-y1s1", programme_id: "prog-cs", academic_year: 2026, year_level: 1, semester: 1, name: "Year 1 Semester 1", start_date: "2026-08-03", end_date: "2026-12-12", status: "active" },
);

// Instantiate curricula — different institutions/programmes get different course sets.
instantiateProgramme("prog-nas", "ap-nas-y2s1", ["calc", "stats", "physics", "mech", "chem1", "chem3", "bio", "plant", "micro", "eco", "soil", "comps", "ai", "agecon"]);
instantiateProgramme("prog-ds", "ap-ds-y2s1", ["calc", "stats", "comps", "ai", "ds"]);
instantiateProgramme("prog-cs", "ap-cs-y1s1", ["calc", "comps", "ds"]);

/* ---------------- Skills ---------------- */
const skillDefs: [string, string, string][] = [
  ["sk-limits", "Evaluating limits", "procedural"], ["sk-diff", "Differentiation", "procedural"],
  ["sk-integral", "Integration", "procedural"], ["sk-newton", "Applying Newton's laws", "conceptual"],
  ["sk-energy", "Energy conservation", "conceptual"], ["sk-momentum", "Momentum & impulse", "procedural"],
  ["sk-stoich", "Stoichiometric calculation", "procedural"], ["sk-bonding", "Chemical bonding", "conceptual"],
  ["sk-cell", "Cell structure & function", "conceptual"], ["sk-genetics", "Genetic problem solving", "procedural"],
  ["sk-microbe", "Microbial identification", "conceptual"], ["sk-asex", "Aseptic technique", "practical"],
  ["sk-binary", "Binary & number systems", "procedural"], ["sk-search", "Search algorithms", "procedural"],
  ["sk-ml", "Machine learning basics", "conceptual"], ["sk-supply", "Supply & demand analysis", "conceptual"],
  ["sk-prob", "Probability reasoning", "procedural"], ["sk-soilph", "Soil pH measurement", "practical"],
];
skillDefs.forEach(([sid, name, st]) => data.skills.push({ id: sid, name, description: null, skill_type: st }));

/* ---------------- Student profile + provisioning ----------------
   provisionStudentProgramme() sets up enrolments, course enrolments,
   mastery, reviews, recommendations and a daily plan for a student in a
   given programme. It is used both for the initial seed and when a
   student switches institution/programme, so the app is fully
   multi-institution rather than hard-wired to LUANAR. */

export function provisionStudentProgramme(db: Database, studentId: string, programmeId: string, year = 2, semester: 1 | 2 = 1) {
  const period = db.academic_periods.find((p) => p.programme_id === programmeId && p.status === "active")
    ?? db.academic_periods.find((p) => p.programme_id === programmeId);
  if (!period) return;

  // Clear student-scoped data so the new programme starts clean.
  db.enrolments = db.enrolments.filter((e) => e.student_id !== studentId);
  db.student_course_enrolments = db.student_course_enrolments.filter((e) => e.student_id !== studentId);
  db.study_sessions = db.study_sessions.filter((e) => e.student_id !== studentId);
  db.topic_mastery = db.topic_mastery.filter((e) => e.student_id !== studentId);
  db.skill_mastery = db.skill_mastery.filter((e) => e.student_id !== studentId);
  db.review_schedule = db.review_schedule.filter((e) => e.student_id !== studentId);
  db.recommendations = db.recommendations.filter((e) => e.student_id !== studentId);
  db.study_plan_items = db.study_plan_items.filter((i) => i.study_plan_id !== "plan-today");

  // Programme + course enrolments.
  db.enrolments.push({ id: `enr-${programmeId}`, student_id: studentId, programme_id: programmeId, academic_period_id: period.id, status: "active", started_at: now, ended_at: null });
  db.course_offerings.filter((o) => o.academic_period_id === period.id).forEach((o) => {
    db.student_course_enrolments.push({ id: `sce-${o.id}`, student_id: studentId, course_offering_id: o.id, status: "active" });
  });

  // Mastery + reviews for the programme's topics.
  const courseIds = new Set(db.courses.filter((c) => c.programme_id === programmeId).map((c) => c.id));
  const topics = db.topics.filter((t) => courseIds.has(t.course_id));
  const bases = [42, 61, 55, 38, 67, 49, 72, 58, 45, 30, 52, 74, 48, 40, 60, 35, 50, 0];
  topics.forEach((t, i) => {
    const base = bases[i % bases.length];
    const level = base === 0 ? "not_started" : base < 35 ? "learning" : base < 55 ? "developing" : base < 70 ? "functional" : "strong";
    const next = new Date(Date.now() + (i % 5) * 86400000).toISOString();
    db.topic_mastery.push({
      id: `tm-${t.id}`, student_id: studentId, topic_id: t.id, mastery_score: base,
      mastery_level: level as MasteryLevel, confidence_score: Math.max(0, base - 8), attempt_count: Math.floor(base / 12),
      last_practiced_at: base ? now : null, last_assessed_at: base ? now : null, next_review_at: base ? next : null,
    });
    if (base > 0 && i % 2 === 0) {
      db.review_schedule.push({
        id: `rev-${t.id}`, student_id: studentId, topic_id: t.id, scheduled_for: next,
        interval_days: [1, 2, 4, 7, 14][i % 5], ease_factor: 2.5, status: "scheduled", last_result: null,
      });
    }
  });

  // Recommendations: a few high-priority activities drawn from this programme's topics.
  const priorityPicks = topics.slice(0, 5);
  const reasons = [
    "A short practice set will strengthen this topic.",
    "Continue where you left off in the learning units.",
    "A guided practical is ready for this topic.",
    "Upload lecture notes to build an AI learning pack.",
    "A quick review keeps retention strong.",
  ] as const;
  const types = ["practice", "continue_unit", "practical", "upload_material", "review"] as const;
  priorityPicks.forEach((t, i) => {
    db.recommendations.push({
      id: `rec-${i + 1}`, student_id: studentId, course_id: t.course_id, topic_id: t.id,
      recommendation_type: types[i], priority: 95 - i * 8, reason: reasons[i],
      minutes: [10, 12, 15, 8, 6][i], expires_at: null, status: "active",
    });
  });

  // Daily plan from the first four topics.
  const planItems = topics.slice(0, 4);
  planItems.forEach((t, i) => {
    const course = db.courses.find((c) => c.id === t.course_id)!;
    db.study_plan_items.push({
      id: `spi-${i + 1}`, study_plan_id: "plan-today", topic_id: t.id,
      title: `${t.name} — ${["quick revision", "practice set", "worked problems", "overview"][i]}`,
      scheduled_date: today, planned_minutes: [10, 15, 15, 5][i], sequence_number: i + 1, status: "planned",
    });
    if (i === 0) {
      db.study_sessions.push({
        id: "sess-yesterday", student_id: studentId, started_at: "2026-08-20T14:00:00.000Z",
        ended_at: "2026-08-20T14:42:00.000Z", duration_seconds: 2520, session_type: "practice",
        topic_id: t.id, note: `${course.code} — recent practice.`,
      });
    }
  });
}

data.student_profiles.push({
  id: STUDENT_ID, full_name: "Alex Gremu", institution_id: "inst-luanar", programme_id: "prog-nas",
  current_year: 2, current_semester: 1, timezone: "Africa/Blantyre",
  study_preferences: { daily_target_minutes: 60, prefers_practice: true },
});
data.study_plans.push({ id: "plan-today", student_id: STUDENT_ID, name: "Today's adaptive plan", start_date: today, end_date: today, target_minutes: 45, status: "active" });
provisionStudentProgramme(data, STUDENT_ID, "prog-nas", 2, 1);

data.uploaded_materials.push({
  id: "um-1", student_id: STUDENT_ID, course_id: "ai-prog-nas", topic_id: null,
  file_name: "AI-Week3-Search.pdf", storage_path: "student-1/AI-Week3-Search.pdf",
  mime_type: "application/pdf", file_size: 842310, processing_status: "ready",
  extracted_text: "These notes introduce state-space search, BFS, DFS and A* with examples...",
  ai_classification: { suggested_topic: "Search and Problem Solving", confidence: 0.92 },
  created_at: "2026-08-19T10:20:00.000Z",
});

export default data;
