/**
 * Builds /.well-known/agent-skills/index.json (Agent Skills Discovery RFC
 * v0.2.0) from the SKILL.md files in a built site. Runs after `vite build`
 * so every digest is the SHA-256 of the exact bytes the asset canister will
 * serve; a hand-maintained index would drift the moment a skill was edited.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Reads `name` and `description` from SKILL.md YAML frontmatter. */
export function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) throw new Error('SKILL.md has no YAML frontmatter');
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!fields.name || !fields.description) throw new Error('frontmatter needs name and description');
  return { name: fields.name, description: fields.description };
}

/** Lists `<skillsDir>/<name>/SKILL.md` entries as index records. */
export function buildIndex(skillsDir, urlPrefix = '/.well-known/agent-skills') {
  const skills = readdirSync(skillsDir)
    .filter((entry) => statSync(path.join(skillsDir, entry)).isDirectory())
    .sort()
    .map((dir) => {
      const file = path.join(skillsDir, dir, 'SKILL.md');
      const bytes = readFileSync(file);
      const { name, description } = parseFrontmatter(bytes.toString('utf8'));
      if (name !== dir) throw new Error(`${file}: frontmatter name "${name}" must equal directory "${dir}"`);
      if (!NAME_PATTERN.test(name) || name.length > 64) throw new Error(`${file}: invalid skill name "${name}"`);
      if (description.length > 1024) throw new Error(`${file}: description over 1024 chars`);
      return {
        name,
        type: 'skill-md',
        description,
        url: `${urlPrefix}/${name}/SKILL.md`,
        digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      };
    });
  if (skills.length === 0) throw new Error(`no skills found under ${skillsDir}`);
  return { $schema: SCHEMA, skills };
}

export function writeIndex(skillsDir) {
  const index = buildIndex(skillsDir);
  const target = path.join(skillsDir, 'index.json');
  writeFileSync(target, JSON.stringify(index, null, 2) + '\n');
  return { target, count: index.skills.length };
}
