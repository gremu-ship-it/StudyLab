export type Course = {
  id: string;
  code: string;
  name: string;
  category: string;
  progress: number;
  mastery: number;
  nextTopic: string;
  accent: string;
};

export type Recommendation = {
  id: string;
  course: string;
  topic: string;
  reason: string;
  minutes: number;
  priority: "High" | "Medium" | "Low";
};