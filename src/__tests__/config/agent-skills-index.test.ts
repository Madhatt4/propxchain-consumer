import { createHash } from 'crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { buildIndex, parseFrontmatter, SCHEMA, writeIndex } from '../../../scripts/agent-skills-index.mjs'

const PUBLIC_SKILLS = path.resolve(__dirname, '../../../public/.well-known/agent-skills')

interface Entry { name: string; type: string; description: string; url: string; digest: string }
interface Index { $schema: string; skills: Entry[] }

function makeSkillDir(name: string, body: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'skills-'))
  mkdirSync(path.join(root, name))
  writeFileSync(path.join(root, name, 'SKILL.md'), body)
  return root
}

describe('parseFrontmatter', () => {
  it('should read name and description', () => {
    expect(parseFrontmatter('---\nname: a-b\ndescription: Does X: fully.\n---\n# A')).toEqual({
      name: 'a-b',
      description: 'Does X: fully.',
    })
  })

  it('should reject a file without frontmatter', () => {
    expect(() => parseFrontmatter('# no frontmatter')).toThrow(/frontmatter/)
  })
})

describe('buildIndex', () => {
  it('should emit the v0.2.0 schema and a digest of the raw bytes', () => {
    const body = '---\nname: demo-skill\ndescription: Demo.\n---\n# Demo\n'
    const root = makeSkillDir('demo-skill', body)
    const index = buildIndex(root) as Index
    expect(index.$schema).toBe(SCHEMA)
    expect(index.skills).toEqual([
      {
        name: 'demo-skill',
        type: 'skill-md',
        description: 'Demo.',
        url: '/.well-known/agent-skills/demo-skill/SKILL.md',
        digest: `sha256:${createHash('sha256').update(body).digest('hex')}`,
      },
    ])
  })

  it('should refuse a frontmatter name that differs from the directory', () => {
    const root = makeSkillDir('right-name', '---\nname: wrong-name\ndescription: D.\n---\n')
    expect(() => buildIndex(root)).toThrow(/must equal directory/)
  })

  it('should refuse names outside the Agent Skills naming rules', () => {
    const root = makeSkillDir('Bad_Name', '---\nname: Bad_Name\ndescription: D.\n---\n')
    expect(() => buildIndex(root)).toThrow(/invalid skill name/)
  })

  it('should refuse an empty skills directory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'skills-empty-'))
    expect(() => buildIndex(root)).toThrow(/no skills found/)
  })
})

describe('published skills', () => {
  it('should all build into a valid index with unique names', () => {
    const index = buildIndex(PUBLIC_SKILLS) as Index
    const names = index.skills.map((s) => s.name)
    expect(names).toEqual(['propxchain-agent-auth', 'propxchain-conveyancing'])
    for (const s of index.skills) {
      expect(s.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(s.description.length).toBeLessThanOrEqual(1024)
    }
  })

  it('should write index.json next to the skills', () => {
    const body = '---\nname: w\ndescription: W.\n---\n'
    const root = makeSkillDir('w', body)
    const { target, count } = writeIndex(root)
    expect(count).toBe(1)
    const written = JSON.parse(readFileSync(target, 'utf-8')) as Index
    expect(written.skills[0].name).toBe('w')
  })

  it('should serve the index and SKILL.md files with the right headers', () => {
    const rules = readFileSync(path.resolve(PUBLIC_SKILLS, '../../.ic-assets.json5'), 'utf-8')
    expect(rules).toContain('"match": ".well-known/agent-skills/index.json"')
    expect(rules).toContain('"match": ".well-known/agent-skills/*/SKILL.md"')
  })
})
