import type { Course, Recommendation } from "./types";

export const courses: Course[] = [
  { id: "calc", code: "NMAT32122", name: "Calculus I", category: "Mathematics", progress: 34, mastery: 61, nextTopic: "Add your first lecturer topic", accent: "math" },
  { id: "stats", code: "NBAT32107", name: "Statistics I", category: "Mathematics", progress: 22, mastery: 58, nextTopic: "Add your first lecturer topic", accent: "math" },
  { id: "physics", code: "NPHY31105", name: "Physics I", category: "Physical Sciences", progress: 18, mastery: 54, nextTopic: "Add your first lecturer topic", accent: "physics" },
  { id: "mechanics", code: "NPHY32104", name: "Mechanics I", category: "Physical Sciences", progress: 27, mastery: 63, nextTopic: "Add your first lecturer topic", accent: "physics" },
  { id: "chem1", code: "NCHE31104", name: "Introductory Chemistry I", category: "Chemistry", progress: 20, mastery: 59, nextTopic: "Add your first lecturer topic", accent: "chem" },
  { id: "chem3", code: "NCHE32103", name: "Introductory Chemistry III", category: "Chemistry", progress: 15, mastery: 51, nextTopic: "Add your first lecturer topic", accent: "chem" },
  { id: "biology", code: "NBIO31101", name: "General Biology I", category: "Biology", progress: 31, mastery: 72, nextTopic: "Add your first lecturer topic", accent: "bio" },
  { id: "plant", code: "NBIO32103", name: "Plant Form and Function", category: "Biology", progress: 24, mastery: 65, nextTopic: "Add your first lecturer topic", accent: "bio" },
  { id: "micro", code: "NBMB32101", name: "Microbiology", category: "Biology", progress: 12, mastery: 49, nextTopic: "Add your first lecturer topic", accent: "bio" },
  { id: "ecology", code: "NDEV23203", name: "Ecology", category: "Biology", progress: 9, mastery: 47, nextTopic: "Add your first lecturer topic", accent: "bio" },
  { id: "soil", code: "NBAT32104", name: "Soil Science", category: "Agricultural Sciences", progress: 16, mastery: 56, nextTopic: "Add your first lecturer topic", accent: "soil" },
  { id: "computers", code: "NCOM31103", name: "Introduction to Computer Systems", category: "Technology", progress: 36, mastery: 74, nextTopic: "Add your first lecturer topic", accent: "tech" },
  { id: "ai", code: "NNAS32101", name: "Introduction to Artificial Intelligence", category: "Technology", progress: 19, mastery: 52, nextTopic: "Add your first lecturer topic", accent: "tech" },
  { id: "ag-econ", code: "NAAE32101", name: "Introduction to Agricultural Economics", category: "Agricultural Economics", progress: 14, mastery: 55, nextTopic: "Add your first lecturer topic", accent: "econ" },
];

export const recommendations: Recommendation[] = [
  { id: "r1", course: "Calculus I", topic: "Add a current topic", reason: "Your curriculum is intentionally open-ended. Add the topic your lecturer introduced today.", minutes: 10, priority: "High" },
  { id: "r2", course: "Introductory Chemistry III", topic: "Upload lecture notes", reason: "The AI tutor can build a learning pack from your own course material.", minutes: 8, priority: "Medium" },
  { id: "r3", course: "Introduction to Agricultural Economics", topic: "Practice session", reason: "A short applied scenario will strengthen recall.", minutes: 15, priority: "Medium" },
];