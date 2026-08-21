import type { Database } from "./types";

// Fixed id prefixes keep joins stable across reloads.
const id = (p: string, n: string | number) => `${p}-${n}`;

const now = "2026-08-21T08:00:00.000Z";
const today = "2026-08-21";

const db: Database = {
  institutions: [
    {
      id: "inst-luanar",
      name: "Lilongwe University of Agriculture and Natural Resources",
      short_name: "LUANAR",
      country: "Malawi",
      website_url: "https://www.luanar.ac.mw",
      is_active: true,
    },
  ],

  programmes: [
    {
      id: "prog-nas",
      institution_id: "inst-luanar",
      name: "BSc in Natural & Applied Science",
      code: "NAS",
      description:
        "Interdisciplinary science programme bridging mathematics, physical sciences, biology and technology.",
      duration_years: 4,
      is_active: true,
    },
  ],

  academic_periods: [
    {
      id: "ap-y2s1",
      programme_id: "prog-nas",
      academic_year: 2026,
      year_level: 2,
      semester: 1,
      name: "Year 2 Semester 1",
      start_date: "2026-08-03",
      end_date: "2026-12-12",
      status: "active",
    },
  ],

  courses: [
    { id: "c-calc", programme_id: "prog-nas", code: "NMAT32122", name: "Calculus I", category: "Mathematics", description: "Limits, derivatives and introductory integration.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-stats", programme_id: "prog-nas", code: "NBAT32107", name: "Statistics I", category: "Mathematics", description: "Descriptive statistics, probability and distributions.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-phys", programme_id: "prog-nas", code: "NPHY31105", name: "Physics I", category: "Physical Sciences", description: "Mechanics, heat and properties of matter.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-mech", programme_id: "prog-nas", code: "NPHY32104", name: "Mechanics I", category: "Physical Sciences", description: "Newtonian mechanics, forces, energy and momentum.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-chem1", programme_id: "prog-nas", code: "NCHE31104", name: "Introductory Chemistry I", category: "Chemistry", description: "Atomic structure, bonding and stoichiometry.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-chem3", programme_id: "prog-nas", code: "NCHE32103", name: "Introductory Chemistry III", category: "Chemistry", description: "Organic chemistry and functional groups.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-bio", programme_id: "prog-nas", code: "NBIO31101", name: "General Biology I", category: "Biology", description: "Cell biology, genetics and evolution.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-plant", programme_id: "prog-nas", code: "NBIO32103", name: "Plant Form and Function", category: "Biology", description: "Plant anatomy, physiology and reproduction.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-micro", programme_id: "prog-nas", code: "NBMB32101", name: "Microbiology", category: "Biology", description: "Microbial structure, growth and control.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-eco", programme_id: "prog-nas", code: "NDEV23203", name: "Ecology", category: "Biology", description: "Ecosystems, populations and environmental interactions.", credits: 8, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-soil", programme_id: "prog-nas", code: "NBAT32104", name: "Soil Science", category: "Agricultural Sciences", description: "Soil formation, properties and fertility.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-comps", programme_id: "prog-nas", code: "NCOM31103", name: "Introduction to Computer Systems", category: "Technology", description: "Hardware, operating systems and networking fundamentals.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-ai", programme_id: "prog-nas", code: "NNAS32101", name: "Introduction to Artificial Intelligence", category: "Technology", description: "Search, reasoning, learning and intelligent agents.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
    { id: "c-agecon", programme_id: "prog-nas", code: "NAAE32101", name: "Introduction to Agricultural Economics", category: "Agricultural Economics", description: "Scarcity, markets and farm decision-making.", credits: 10, course_type: "Core", status: "confirmed", source_type: "official_timetable" },
  ],

  course_offerings: [],
  topics: [],
  subtopics: [],
  skills: [],
  topic_skills: [],
  learning_units: [],
  content_resources: [],
  topic_resources: [],
  questions: [],
  question_options: [],
  practicals: [],
  practical_steps: [],
  student_profiles: [
    {
      id: "student-1",
      full_name: "Alex Gremu",
      institution_id: "inst-luanar",
      programme_id: "prog-nas",
      current_year: 2,
      current_semester: 1,
      timezone: "Africa/Blantyre",
      study_preferences: { daily_target_minutes: 60, prefers_practice: true },
    },
  ],
  enrolments: [
    { id: "enr-1", student_id: "student-1", programme_id: "prog-nas", academic_period_id: "ap-y2s1", status: "active", started_at: now, ended_at: null },
  ],
  student_course_enrolments: [],
  study_sessions: [],
  learning_attempts: [],
  question_attempts: [],
  topic_mastery: [],
  skill_mastery: [],
  review_schedule: [],
  recommendations: [],
  study_plans: [
    { id: "plan-today", student_id: "student-1", name: "Today's adaptive plan", start_date: today, end_date: today, target_minutes: 45, status: "active" },
  ],
  study_plan_items: [],
  uploaded_materials: [],
  ai_conversations: [],
  ai_messages: [],
};

// ---- offerings for every course in current period ----
db.courses.forEach((c) => {
  const lecturers: Record<string, string> = {
    "c-calc": "Dr. T. Banda", "c-stats": "Mr. J. Phiri", "c-phys": "Dr. L. Mhone",
    "c-mech": "Dr. L. Mhone", "c-chem1": "Prof. R. Chirwa", "c-chem3": "Prof. R. Chirwa",
    "c-bio": "Dr. E. Nkhoma", "c-plant": "Dr. E. Nkhoma", "c-micro": "Dr. P. Tembo",
    "c-eco": "Dr. S. Gondwe", "c-soil": "Dr. K. Msiska", "c-comps": "Eng. C. Zulu",
    "c-ai": "Eng. C. Zulu", "c-agecon": "Dr. A. Kamanga",
  };
  db.course_offerings.push({
    id: id("off", c.id), course_id: c.id, academic_period_id: "ap-y2s1",
    lecturer_name: lecturers[c.id] ?? null, status: "active",
  });
  db.student_course_enrolments.push({
    id: id("sce", c.id), student_id: "student-1", course_offering_id: id("off", c.id), status: "active",
  });
});

// ---- skills ----
const skillDefs: [string, string, string][] = [
  ["sk-limits", "Evaluating limits", "procedural"],
  ["sk-diff", "Differentiation", "procedural"],
  ["sk-integral", "Integration", "procedural"],
  ["sk-newton", "Applying Newton's laws", "conceptual"],
  ["sk-energy", "Energy conservation", "conceptual"],
  ["sk-momentum", "Momentum & impulse", "procedural"],
  ["sk-stoich", "Stoichiometric calculation", "procedural"],
  ["sk-bonding", "Chemical bonding", "conceptual"],
  ["sk-cell", "Cell structure & function", "conceptual"],
  ["sk-genetics", "Genetic problem solving", "procedural"],
  ["sk-microbe", "Microbial identification", "conceptual"],
  ["sk-asex", "Aseptic technique", "practical"],
  ["sk-binary", "Binary & number systems", "procedural"],
  ["sk-search", "Search algorithms", "procedural"],
  ["sk-ml", "Machine learning basics", "conceptual"],
  ["sk-supply", "Supply & demand analysis", "conceptual"],
  ["sk-prob", "Probability reasoning", "procedural"],
  ["sk-soilph", "Soil pH measurement", "practical"],
];
skillDefs.forEach(([sid, name, st]) =>
  db.skills.push({ id: sid, name, description: null, skill_type: st })
);

// ---- Helper to build a topic with subtopics, units, questions ----
type Q = { text: string; type?: "multiple_choice" | "true_false" | "short_answer" | "numeric"; options?: string[]; answer: string | number; explain: string; diff?: number; hint?: string };
type Unit = { title: string; type: import("./types").UnitType; mins: number; body: string; diff?: number };

let topicSeq = 0;
function addTopic(
  courseId: string, name: string, description: string, skillIds: string[],
  subtopics: { name: string; units: Unit[]; questions?: Q[]; practical?: { title: string; objective: string; steps: string[] } }[],
  resources: { title: string; type: import("./types").ResourceType; url?: string; provider?: string }[] = [],
  status: import("./types").TopicStatus = "confirmed"
) {
  topicSeq++;
  const tid = id("t", topicSeq);
  db.topics.push({ id: tid, course_id: courseId, name, description, sequence_number: topicSeq, status, source_type: status === "student_added" ? "student" : "curriculum", source_reference: null, estimated_minutes: 120 });
  skillIds.forEach((sid) => db.topic_skills.push({ topic_id: tid, skill_id: sid, importance: 1 }));

  let subSeq = 0;
  subtopics.forEach((sub) => {
    subSeq++;
    const sid = id("s", `${tid}-${subSeq}`);
    db.subtopics.push({ id: sid, topic_id: tid, name: sub.name, description: null, sequence_number: subSeq, status: "active" });

    sub.units.forEach((u, i) => {
      db.learning_units.push({
        id: id("lu", `${tid}-${subSeq}-${i + 1}`), topic_id: tid, subtopic_id: sid, title: u.title,
        unit_type: u.type, sequence_number: i + 1, description: u.body.slice(0, 120), body: u.body,
        estimated_minutes: u.mins, difficulty: u.diff ?? 2, status: "approved",
      });
    });

    sub.questions?.forEach((q, i) => {
      const qid = id("q", `${tid}-${subSeq}-${i + 1}`);
      const qType = q.type ?? (q.options ? "multiple_choice" : "short_answer");
      let correct: import("./types").Question["correct_answer"];
      if (qType === "numeric") correct = { number: q.answer as number };
      else if (qType === "multiple_choice") correct = { key: q.answer as string };
      else correct = { value: String(q.answer) };
      db.questions.push({
        id: qid, topic_id: tid, subtopic_id: sid, question_type: qType, difficulty: q.diff ?? 2,
        question_text: q.text, explanation: q.explain, hint_1: q.hint ?? null, hint_2: null,
        correct_answer: correct, estimated_seconds: 90, status: "approved",
      });
      if (q.options) {
        q.options.forEach((otext, oi) => {
          db.question_options.push({
            id: id("qo", `${qid}-${oi + 1}`), question_id: qid,
            option_key: String.fromCharCode(65 + oi), option_text: otext, sequence_number: oi + 1,
          });
        });
      }
    });

    if (sub.practical) {
      const pid = id("p", tid);
      db.practicals.push({
        id: pid, topic_id: tid, title: sub.practical.title, objective: sub.practical.objective,
        background: description, materials: ["Lab notebook", "Apparatus as listed", "PPE"],
        safety_notes: "Wear a lab coat and safety glasses. Follow demonstrator instructions.",
        expected_outcome: "Recorded observations consistent with the theory.",
        assessment_notes: "Submit a written report including data, analysis and conclusion.",
        status: "approved",
      });
      sub.practical.steps.forEach((instr, i) =>
        db.practical_steps.push({
          id: id("ps", `${pid}-${i + 1}`), practical_id: pid, step_number: i + 1,
          instruction: instr, expected_action: null, observation_prompt: "Record your observation.",
        })
      );
    }
  });

  resources.forEach((r, i) => {
    const rid = id("r", `${tid}-${i + 1}`);
    db.content_resources.push({
      id: rid, title: r.title, description: null, resource_type: r.type, url: r.url ?? null,
      provider: r.provider ?? null, author: null, duration_seconds: r.type === "youtube" ? 720 : null,
      difficulty: 2, status: "active", source_type: "curated",
    });
    db.topic_resources.push({ topic_id: tid, resource_id: rid, relationship_type: "supports", sequence_number: i + 1 });
  });
}

// ===== CALCULUS I =====
addTopic("c-calc", "Limits and Continuity", "Understanding the foundation of the derivative through limits.",
  ["sk-limits"],
  [
    {
      name: "Intuitive notion of a limit", units: [
        { title: "What is a limit?", type: "explanation", mins: 12, diff: 1, body: "A limit describes the value a function approaches as the input gets close to some point. We write lim x→a f(x) = L. Limits do not depend on the value of f at a — only on the behaviour near a. This distinction is what makes calculus possible." },
        { title: "Estimating limits from tables", type: "worked_example", mins: 10, diff: 2, body: "Evaluate f(x) for x approaching a from both sides. If both sides approach the same number, the limit exists. Example: for f(x)=(x²−1)/(x−1) near x=1, values approach 2, so the limit is 2 even though f(1) is undefined." },
        { title: "Limit laws", type: "explanation", mins: 14, diff: 2, body: "The limit of a sum, difference, product and quotient equals the same combination of individual limits, provided the denominator's limit is non-zero. These laws let us break complicated limits into simple pieces." },
      ],
      questions: [
        { text: "Evaluate lim x→2 (3x + 1).", type: "numeric", answer: 7, explain: "By direct substitution, 3(2)+1 = 7.", diff: 1 },
        { text: "The limit lim x→a f(x) requires f(a) to be defined.", type: "true_false", answer: "false", explain: "A limit depends only on behaviour near a, not on f(a).", diff: 1 },
        { text: "lim x→1 (x²−1)/(x−1) equals:", options: ["0", "1", "2", "undefined"], answer: "C", explain: "Factor as (x−1)(x+1)/(x−1) = x+1, which approaches 2.", diff: 2, hint: "Factor the numerator." },
      ],
    },
    {
      name: "Continuity", units: [
        { title: "Definition of continuity", type: "explanation", mins: 10, diff: 2, body: "A function is continuous at a if f(a) is defined, lim x→a f(x) exists, and the limit equals f(a). Polynomials, rationals on their domains, and trig functions are continuous where defined." },
      ],
      questions: [
        { text: "Which condition is NOT required for continuity at a?", options: ["f(a) is defined", "The limit exists", "f(a) equals the limit", "f is differentiable"], answer: "D", explain: "Differentiability is stronger than continuity; continuity does not require it.", diff: 2 },
      ],
    },
  ],
  [{ title: "3Blue1Brown — The essence of calculus", type: "youtube", url: "https://www.youtube.com/watch?v=WUvTyaaNkzM", provider: "YouTube" }]
);

addTopic("c-calc", "Derivatives", "Rates of change, differentiation rules and applications.",
  ["sk-diff"],
  [
    {
      name: "The derivative", units: [
        { title: "Definition of the derivative", type: "explanation", mins: 14, diff: 3, body: "f'(x) = lim h→0 [f(x+h) − f(x)]/h. This is the instantaneous rate of change and the slope of the tangent line. The whole of differential calculus builds on this single limit." },
        { title: "Power rule worked example", type: "worked_example", mins: 9, diff: 1, body: "d/dx xⁿ = n xⁿ⁻¹. So d/dx x³ = 3x² and d/dx x⁵ = 5x⁴. Constants multiply through, and the derivative of a constant is zero." },
        { title: "Product and quotient rules", type: "explanation", mins: 14, diff: 3, body: "Product rule: (fg)' = f'g + fg'. Quotient rule: (f/g)' = (f'g − fg')/g². Identify f and g before differentiating to avoid sign errors." },
      ],
      questions: [
        { text: "Find d/dx (x⁴).", type: "numeric", answer: 4, explain: "Power rule gives 4x³; the coefficient requested is 4 in the form n x³. The answer here records the exponent coefficient.", diff: 1, hint: "Use the power rule: bring the exponent down." },
        { text: "The derivative measures:", options: ["Area under a curve", "Instantaneous rate of change", "Average value", "The intercept"], answer: "B", explain: "The derivative is the instantaneous rate of change.", diff: 1 },
        { text: "If f(x)=3x²+2x, f'(x)=", options: ["6x+2", "3x+2", "6x²+2", "6x"], answer: "A", explain: "Differentiate term by term: 6x + 2.", diff: 2 },
      ],
      practical: { title: "Estimating a derivative numerically", objective: "Approximate the slope of a curve using secant lines with shrinking h.", steps: ["Choose f(x)=x² at x=1.", "Compute [f(1+h)−f(1)]/h for h=0.1, 0.01, 0.001.", "Record the values in a table.", "Observe that they approach 2, the exact derivative."] },
    },
  ],
  [{ title: "Khan Academy — Derivatives introduction", type: "website", url: "https://www.khanacademy.org/math/differential-calculus", provider: "Khan Academy" }]
);

// ===== MECHANICS I =====
addTopic("c-mech", "Newton's Laws of Motion", "Forces, mass and the relationship between them.",
  ["sk-newton"],
  [
    {
      name: "The three laws", units: [
        { title: "First law — inertia", type: "explanation", mins: 9, diff: 1, body: "A body remains at rest or in uniform straight-line motion unless acted on by a net external force. This overturned the older idea that motion requires a continued cause." },
        { title: "Second law — F = ma", type: "explanation", mins: 14, diff: 2, body: "The net force on an object equals its mass times its acceleration: ΣF = ma. Force and acceleration are vectors and point the same way. Use a free-body diagram to identify all forces." },
        { title: "Third law — action & reaction", type: "explanation", mins: 9, diff: 2, body: "For every action there is an equal and opposite reaction. The two forces act on different bodies, so they never cancel each other on a single object." },
        { title: "Solving force problems", type: "worked_example", mins: 12, diff: 3, body: "A 5 kg box on a frictionless floor is pulled by a 20 N horizontal force. Acceleration a = F/m = 20/5 = 4 m/s². Always resolve forces along convenient axes and apply ΣF = ma separately." },
      ],
      questions: [
        { text: "A 5 kg object experiences a net force of 20 N. Its acceleration is:", options: ["0.25 m/s²", "4 m/s²", "25 m/s²", "100 m/s²"], answer: "B", explain: "a = F/m = 20/5 = 4 m/s².", diff: 1, hint: "Use F = ma and rearrange." },
        { text: "Newton's third law forces always act on the same object.", type: "true_false", answer: "false", explain: "Action–reaction pairs act on different bodies.", diff: 1 },
        { text: "Inertia is the tendency of an object to:", options: ["Accelerate", "Resist changes in motion", "Gain mass", "Exert gravity"], answer: "B", explain: "Inertia is resistance to changes in velocity, measured by mass.", diff: 2 },
      ],
      practical: { title: "Verifying F = ma with a dynamics cart", objective: "Show that acceleration is proportional to force for constant mass.", steps: ["Set up a track, cart and pulley.", "Keep cart mass constant; vary hanging mass to change force.", "Time the cart over a fixed distance for each force.", "Plot acceleration against force and confirm a straight line."] },
    },
  ],
  [{ title: "Veritasium — Newton's laws", type: "youtube", url: "https://www.youtube.com/results?search_query=veritasium+newton%27s+laws", provider: "YouTube" }]
);

addTopic("c-mech", "Work, Energy and Power", "Conservation of mechanical energy.",
  ["sk-energy"],
  [
    {
      name: "Energy conservation", units: [
        { title: "Kinetic and potential energy", type: "explanation", mins: 12, diff: 2, body: "Kinetic energy K = ½mv². Gravitational potential energy U = mgh. In the absence of non-conservative forces, K + U is conserved." },
        { title: "Worked energy problem", type: "worked_example", mins: 10, diff: 3, body: "A 2 kg ball dropped from 5 m converts potential energy mgh=98 J into kinetic energy at ground level. Its speed from ½mv²=98 is about 9.9 m/s." },
      ],
      questions: [
        { text: "Doubling an object's speed multiplies its kinetic energy by:", options: ["2", "4", "8", "1"], answer: "B", explain: "K depends on v², so doubling speed quadruples K.", diff: 2 },
        { text: "Mechanical energy is conserved when only conservative forces act.", type: "true_false", answer: "true", explain: "With no friction or drag, K + U stays constant.", diff: 1 },
      ],
    },
  ],
  []
);

// ===== CHEMISTRY I =====
addTopic("c-chem1", "Atomic Structure and Bonding", "Electrons, orbitals and how atoms combine.",
  ["sk-bonding"],
  [
    {
      name: "Atomic structure", units: [
        { title: "Subatomic particles", type: "explanation", mins: 10, diff: 1, body: "Atoms contain protons (positive), neutrons (neutral) in the nucleus, and electrons (negative) in orbitals. Atomic number = number of protons; mass number = protons + neutrons." },
        { title: "Electron configuration", type: "explanation", mins: 14, diff: 3, body: "Electrons fill orbitals in order 1s, 2s, 2p, 3s, 3p… with at most two electrons per orbital (opposite spins). Configuration explains periodic trends and bonding." },
      ],
      questions: [
        { text: "Which particle determines the element?", options: ["Neutron", "Electron", "Proton", "Ion"], answer: "C", explain: "Atomic number (proton count) defines the element.", diff: 1 },
        { text: "A covalent bond involves ______ of electrons.", type: "short_answer", answer: "sharing", explain: "Covalent bonds form when atoms share electron pairs.", diff: 1 },
      ],
    },
  ],
  []
);

addTopic("c-chem1", "Stoichiometry", "Quantitative relationships in chemical reactions.",
  ["sk-stoich"],
  [
    {
      name: "The mole", units: [
        { title: "Moles and molar mass", type: "explanation", mins: 12, diff: 2, body: "One mole contains 6.022×10²³ particles. Molar mass converts between grams and moles: n = m/M. Balanced equations give mole ratios between reactants and products." },
        { title: "Worked stoichiometry", type: "worked_example", mins: 12, diff: 3, body: "For 2H₂ + O₂ → 2H₂O, 2 moles of H₂ react with 1 mole of O₂. To make 4 moles of water you need 4 moles H₂ and 2 moles O₂." },
      ],
      questions: [
        { text: "How many moles of H₂O form from 4 mol H₂ in 2H₂+O₂→2H₂O?", type: "numeric", answer: 4, explain: "The ratio of H₂ to H₂O is 1:1, so 4 mol H₂ yields 4 mol H₂O.", diff: 2, hint: "Use the mole ratio from the balanced equation." },
      ],
    },
  ],
  []
);

// ===== GENERAL BIOLOGY =====
addTopic("c-bio", "Cell Structure and Function", "Prokaryotic versus eukaryotic cells and organelles.",
  ["sk-cell"],
  [
    {
      name: "The cell", units: [
        { title: "Cell theory", type: "explanation", mins: 8, diff: 1, body: "All organisms are made of cells; the cell is the basic unit of life; all cells arise from pre-existing cells. Cells are either prokaryotic (no nucleus) or eukaryotic (membrane-bound nucleus)." },
        { title: "Organelles", type: "explanation", mins: 14, diff: 2, body: "The nucleus stores DNA; mitochondria produce ATP; ribosomes build proteins; the ER and Golgi process and transport molecules; chloroplasts (in plants) perform photosynthesis." },
      ],
      questions: [
        { text: "Which organelle is the site of cellular respiration?", options: ["Nucleus", "Mitochondrion", "Ribosome", "Vacuole"], answer: "B", explain: "Mitochondria generate ATP through respiration.", diff: 1 },
        { text: "Prokaryotic cells have a membrane-bound nucleus.", type: "true_false", answer: "false", explain: "Prokaryotes lack a nucleus; their DNA is free in the cytoplasm.", diff: 1 },
      ],
    },
  ],
  []
);

addTopic("c-bio", "Mendelian Genetics", "Inheritance, Punnett squares and probability.",
  ["sk-genetics"],
  [
    {
      name: "Monohybrid crosses", units: [
        { title: "Dominance and segregation", type: "explanation", mins: 12, diff: 2, body: "Alleles can be dominant or recessive. A monohybrid cross Aa × Aa produces a genotypic ratio 1:2:1 and phenotypic ratio 3:1. Punnett squares make the combinations explicit." },
      ],
      questions: [
        { text: "In Aa × Aa, what fraction show the dominant phenotype?", options: ["1/4", "1/2", "3/4", "1"], answer: "C", explain: "AA, Aa, Aa show dominant; aa is recessive = 3/4.", diff: 2 },
      ],
    },
  ],
  []
);

// ===== MICROBIOLOGY =====
addTopic("c-micro", "Microbial Growth and Control", "How microbes grow and how we control them.",
  ["sk-microbe", "sk-asex"],
  [
    {
      name: "Growth and sterilisation", units: [
        { title: "Bacterial growth curve", type: "explanation", mins: 12, diff: 2, body: "Populations show lag, log (exponential), stationary and death phases. Growth depends on temperature, pH, nutrients and oxygen." },
        { title: "Control methods", type: "explanation", mins: 10, diff: 2, body: "Sterilisation kills all microbes; disinfection reduces pathogens on surfaces; antisepsis treats living tissue. Autoclaving uses moist heat under pressure." },
      ],
      questions: [
        { text: "Which phase features exponential cell division?", options: ["Lag", "Log", "Stationary", "Death"], answer: "B", explain: "The log phase is exponential growth.", diff: 1 },
        { text: "Autoclaving kills all microbial life including endospores.", type: "true_false", answer: "true", explain: "Steam under pressure achieves sterilisation.", diff: 1 },
      ],
      practical: { title: "Aseptic technique and streak plating", objective: "Isolate a single bacterial colony using sterile technique.", steps: ["Sterilise the inoculating loop in a flame until red hot.", "Allow it to cool, then collect a small sample.", "Streak the first quadrant of an agar plate.", "Flame the loop again and streak the next quadrant from the edge of the first.", "Repeat, then incubate inverted at 37°C for 24–48 hours and observe isolated colonies."] },
    },
  ],
  []
);

// ===== COMPUTER SYSTEMS =====
addTopic("c-comps", "Number Systems and Data Representation", "Binary, hexadecimal and how computers store data.",
  ["sk-binary"],
  [
    {
      name: "Binary", units: [
        { title: "Binary and decimal", type: "explanation", mins: 12, diff: 2, body: "Binary uses base 2 with digits 0 and 1. Each position is a power of two. 1011₂ = 1×8 + 0×4 + 1×2 + 1×1 = 11₁₀. Hexadecimal (base 16) compactly represents groups of four bits." },
        { title: "Conversion practice", type: "worked_example", mins: 10, diff: 2, body: "Convert decimal 13 to binary: 13 = 8+4+1 = 1101₂. Convert back by summing powers of two from left to right." },
      ],
      questions: [
        { text: "What is 1010₂ in decimal?", options: ["8", "10", "12", "14"], answer: "B", explain: "8+2 = 10.", diff: 1, hint: "Sum the powers of two where bits are 1." },
        { text: "One byte contains 4 bits.", type: "true_false", answer: "false", explain: "One byte is 8 bits.", diff: 1 },
      ],
    },
  ],
  [{ title: "CrashCourse Computer Science", type: "youtube", url: "https://www.youtube.com/watch?v?v=O5nskjZ_GoI", provider: "YouTube" }]
);

// ===== ARTIFICIAL INTELLIGENCE =====
addTopic("c-ai", "Search and Problem Solving", "Uninformed and informed search algorithms.",
  ["sk-search"],
  [
    {
      name: "Search algorithms", units: [
        { title: "State-space search", type: "explanation", mins: 14, diff: 3, body: "A search problem has an initial state, actions, a transition model, a goal test and path cost. BFS explores level by level and finds shortest paths in unweighted graphs; DFS dives deep first and uses less memory." },
        { title: "A* search", type: "explanation", mins: 12, diff: 4, body: "A* uses f(n)=g(n)+h(n), combining cost-so-far with a heuristic estimate to the goal. With an admissible (never overestimating) heuristic, A* is optimal." },
      ],
      questions: [
        { text: "Which search guarantees the shortest path in an unweighted graph?", options: ["DFS", "BFS", "Greedy", "Hill climbing"], answer: "B", explain: "BFS expands by depth, finding shortest paths first.", diff: 2 },
        { text: "An admissible heuristic never overestimates true cost.", type: "true_false", answer: "true", explain: "Admissibility is required for A* optimality.", diff: 2 },
      ],
    },
  ],
  []
);

addTopic("c-ai", "Machine Learning Foundations", "Supervised learning, features and models.",
  ["sk-ml"],
  [
    {
      name: "Learning from data", units: [
        { title: "What is machine learning?", type: "explanation", mins: 12, diff: 2, body: "ML systems learn patterns from examples instead of being explicitly programmed. Supervised learning maps inputs to labelled outputs; unsupervised learning finds structure; reinforcement learning learns by reward." },
        { title: "Overfitting", type: "explanation", mins: 10, diff: 3, body: "A model overfits when it memorises training data but fails on new examples. Use held-out test data, simpler models and regularisation to generalise better." },
      ],
      questions: [
        { text: "Training with labels is called:", options: ["Supervised", "Unsupervised", "Reinforcement", "Clustering"], answer: "A", explain: "Supervised learning uses labelled examples.", diff: 1 },
      ],
    },
  ],
  []
);

// ===== STATISTICS =====
addTopic("c-stats", "Probability Fundamentals", "Sample spaces, events and basic rules.",
  ["sk-prob"],
  [
    {
      name: "Probability rules", units: [
        { title: "Classical probability", type: "explanation", mins: 12, diff: 2, body: "P(A) = favourable outcomes / total outcomes. The complement rule: P(not A)=1−P(A). For disjoint events, P(A or B)=P(A)+P(B); for independent events, P(A and B)=P(A)P(B)." },
      ],
      questions: [
        { text: "A fair die rolls. P(even) =", options: ["1/6", "1/3", "1/2", "2/3"], answer: "C", explain: "Three even faces out of six = 1/2.", diff: 1 },
        { text: "Independent events affect each other's probability.", type: "true_false", answer: "false", explain: "Independence means one does not change the other's probability.", diff: 2 },
      ],
    },
  ],
  []
);

// ===== AGRICULTURAL ECONOMICS =====
addTopic("c-agecon", "Supply and Demand", "How markets set prices and quantities.",
  ["sk-supply"],
  [
    {
      name: "Market equilibrium", units: [
        { title: "Demand and supply curves", type: "explanation", mins: 14, diff: 2, body: "Demand slopes downward (lower price → more demanded); supply slopes upward. Their intersection is the equilibrium price and quantity. Shifters such as income, input costs or policy move the curves." },
      ],
      questions: [
        { text: "At equilibrium:", options: ["Supply exceeds demand", "Demand exceeds supply", "Quantity supplied equals quantity demanded", "Price is zero"], answer: "C", explain: "Equilibrium is where the curves cross.", diff: 1 },
      ],
    },
  ],
  []
);

// ===== SOIL SCIENCE =====
addTopic("c-soil", "Soil pH and Fertility", "Measuring and managing soil acidity.",
  ["sk-soilph"],
  [
    {
      name: "Soil reaction", units: [
        { title: "What pH means for soil", type: "explanation", mins: 12, diff: 2, body: "pH measures hydrogen-ion activity. Most crops prefer pH 6.0–7.0 where nutrients are most available. Acidic soils are often limed; alkaline soils may need elemental sulphur or organic matter." },
      ],
      questions: [
        { text: "Most crops grow best in soil pH of approximately:", options: ["3.0–4.0", "6.0–7.0", "9.0–10.0", "11–12"], answer: "B", explain: "Near-neutral pH maximises nutrient availability.", diff: 1 },
      ],
      practical: { title: "Measuring soil pH with a pH meter", objective: "Determine the pH of three soil samples.", steps: ["Air-dry and sieve each soil sample.", "Mix 1 part soil with 2 parts distilled water and stir.", "Let the suspension stand for 30 minutes.", "Calibrate the pH meter with buffers.", "Insert the electrode into the supernatant and record pH for each sample."] },
    },
  ],
  []
);

// ===== PHYSICS I (light touch) =====
addTopic("c-phys", "Heat and Temperature", "Thermal expansion and heat transfer.",
  ["sk-energy"],
  [
    {
      name: "Heat transfer", units: [
        { title: "Conduction, convection, radiation", type: "explanation", mins: 12, diff: 2, body: "Heat moves by direct contact (conduction), fluid flow (convection) and electromagnetic waves (radiation). Q = mcΔT relates heat transfer to temperature change." },
      ],
      questions: [
        { text: "Heat transfer through empty space occurs by:", options: ["Conduction", "Convection", "Radiation", "Insulation"], answer: "C", explain: "Radiation does not require a medium.", diff: 1 },
      ],
    },
  ],
  []
);

// ===== A student-added topic (curriculum inbox path) =====
addTopic("c-calc", "L'Hôpital's Rule", "Using derivatives to evaluate indeterminate limits.",
  ["sk-limits", "sk-diff"],
  [
    {
      name: "Indeterminate forms", units: [
        { title: "When substitution gives 0/0", type: "explanation", mins: 10, diff: 3, body: "If lim f/g yields 0/0 or ∞/∞, l'Hôpital's rule lets us differentiate numerator and denominator and take the limit again. Verify the indeterminate form before applying it." },
      ],
      questions: [
        { text: "L'Hôpital's rule applies to 0/0 and ∞/∞ forms.", type: "true_false", answer: "true", explain: "These are the standard indeterminate forms it handles.", diff: 2 },
      ],
    },
  ],
  [], "student_added"
);

// ---- initial topic mastery / reviews seeded for the student ----
db.topics.forEach((t, i) => {
  // Varied, realistic starting mastery.
  const base = [42, 61, 55, 38, 67, 49, 72, 58, 45, 30, 52, 74, 48, 40, 60, 35, 50, 0][i % 18];
  const level = base === 0 ? "not_started" : base < 35 ? "learning" : base < 55 ? "developing" : base < 70 ? "functional" : "strong";
  const next = new Date(Date.now() + (i % 5) * 86400000).toISOString();
  db.topic_mastery.push({
    id: id("tm", t.id), student_id: "student-1", topic_id: t.id, mastery_score: base,
    mastery_level: level as import("./types").MasteryLevel, confidence_score: Math.max(0, base - 8),
    attempt_count: Math.floor(base / 12), last_practiced_at: base ? now : null,
    last_assessed_at: base ? now : null, next_review_at: base ? next : null,
  });
  if (base > 0 && i % 2 === 0) {
    db.review_schedule.push({
      id: id("rev", t.id), student_id: "student-1", topic_id: t.id,
      scheduled_for: next, interval_days: [1, 2, 4, 7, 14][i % 5], ease_factor: 2.5,
      status: "scheduled", last_result: null,
    });
  }
});

// ---- recommendations ----
const recs: [string, import("./types").RecommendationType, string, number, number][] = [
  ["t-2", "practice", "Your derivative mastery is 61% — a 5-question set will push it higher.", 10, 95],
  ["t-3", "continue_unit", "Resume 'Solving force problems'; you are halfway through the unit.", 12, 80],
  ["t-9", "practical", "Aseptic technique practical is ready in Microbiology.", 15, 70],
  ["t-16", "upload_material", "Upload this week's AI lecture notes to build a learning pack.", 8, 60],
  ["t-1", "review", "A limits review is due today to keep retention strong.", 6, 88],
];
recs.forEach(([tid, type, reason, mins, pri], i) => {
  const topic = db.topics.find((t) => t.id === tid)!;
  db.recommendations.push({
    id: id("rec", i + 1), student_id: "student-1", course_id: topic.course_id, topic_id: tid,
    recommendation_type: type, priority: pri, reason, minutes: mins,
    expires_at: null, status: "active",
  });
});

// ---- today's study plan items ----
const planItems: [string, number, string][] = [
  ["t-1", 10, "Limits — quick revision"],
  ["t-2", 15, "Derivatives practice set"],
  ["t-3", 15, "Newton's laws — worked problems"],
  ["t-18", 5, "L'Hôpital's Rule overview"],
];
planItems.forEach(([tid, mins, title], i) => {
  db.study_plan_items.push({
    id: id("spi", i + 1), study_plan_id: "plan-today", topic_id: tid, title,
    scheduled_date: today, planned_minutes: mins, sequence_number: i + 1, status: "planned",
  });
});

// ---- a prior study session for history ----
db.study_sessions.push({
  id: "sess-yesterday", student_id: "student-1", started_at: "2026-08-20T14:00:00.000Z",
  ended_at: "2026-08-20T14:42:00.000Z", duration_seconds: 2520, session_type: "practice",
  topic_id: "t-2", note: "Derivatives — power and product rules.",
});

// ---- one uploaded material ----
db.uploaded_materials.push({
  id: "um-1", student_id: "student-1", course_id: "c-ai", topic_id: null,
  file_name: "AI-Week3-Search.pdf", storage_path: "student-1/AI-Week3-Search.pdf",
  mime_type: "application/pdf", file_size: 842310, processing_status: "ready",
  extracted_text: "These notes introduce state-space search, BFS, DFS and A* with examples...",
  ai_classification: { topic: "Search and Problem Solving", confidence: 0.92, suggested_topics: ["A* search", "heuristics"] },
  created_at: "2026-08-19T10:20:00.000Z",
});

export default db;
