export interface SkillEntry {
  name: string;
  type: 'skill-md';
  description: string;
  url: string;
  digest: string;
}
export interface SkillsIndex {
  $schema: string;
  skills: SkillEntry[];
}
export const SCHEMA: string;
export function parseFrontmatter(markdown: string): { name: string; description: string };
export function buildIndex(skillsDir: string, urlPrefix?: string): SkillsIndex;
export function writeIndex(skillsDir: string): { target: string; count: number };
