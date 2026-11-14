// Pure rules for profile skills (PLAN 28): the same limits as the API, and matching a skill to a help request.
import type { Skill } from '@/api/types';
import type { HelpCategory } from '@/api/types.help';

export const SKILL_NAME_MIN = 2;
export const SKILL_NAME_MAX = 40;
/** Most skills one person can list (the API answers 409 SKILL_LIMIT after that). */
export const SKILL_LIMIT = 10;

/** Trimmed name with inner spaces collapsed, as the server stores it. */
export function cleanSkillName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Error text for a skill form, or null when it can be sent. `others` are my other skills (for the duplicate check). */
export function validateSkill(name: string, category: HelpCategory | null, others: Skill[] = []): string | null {
  const clean = cleanSkillName(name);
  if (clean.length < SKILL_NAME_MIN || clean.length > SKILL_NAME_MAX) return `Use ${SKILL_NAME_MIN}–${SKILL_NAME_MAX} characters.`;
  if (!category) return 'Pick a category.';
  if (others.some((s) => s.name.toLowerCase() === clean.toLowerCase())) return 'You already listed this skill.';
  return null;
}

/** Skills that fit a help request's category. */
export function skillsFor(skills: Skill[] | undefined, category: HelpCategory): Skill[] {
  return (skills ?? []).filter((s) => s.category === category);
}

/** Skills that fit first, then the rest, each group keeping its order. */
export function matchingFirst(skills: Skill[] | undefined, category: HelpCategory | undefined): Skill[] {
  const list = skills ?? [];
  if (!category) return list;
  return [...list.filter((s) => s.category === category), ...list.filter((s) => s.category !== category)];
}

/** Categories of my skills, for the "Fits your skills" chip on the board. */
export function skillCategories(skills: Skill[] | undefined): ReadonlySet<string> {
  return new Set((skills ?? []).map((s) => s.category));
}
