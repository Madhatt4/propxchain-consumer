// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

import {
  DEV_CONTENT_SECURITY_POLICY,
  INLINE_SCRIPT_HASHES,
  SECURITY_HEADERS,
} from '../../../config/security-headers.mjs'

const IC_ASSETS_PATH = path.resolve(__dirname, '../../../public/.ic-assets.json5')

/**
 * `.ic-assets.json5` is JSON5, so it carries `//` comments that JSON.parse
 * rejects. Only whole comment lines are dropped — a naive global strip would
 * eat the `//` inside every `https://` origin in the CSP.
 */
function parseIcAssets(): Array<{ match: string; headers?: Record<string, string> }> {
  const source = readFileSync(IC_ASSETS_PATH, 'utf-8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  return JSON.parse(source)
}

describe('security headers', () => {
  it('should serve the shared header set on every production asset', () => {
    const defaultRule = parseIcAssets().find((rule) => rule.match === '**/*')

    expect(defaultRule).toBeDefined()
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      expect(defaultRule?.headers?.[header]).toBe(value)
    }
  })

  it('should serve the shared CSP in production', () => {
    const prodCsp = parseIcAssets().find((rule) => rule.match === '**/*')?.headers?.[
      'Content-Security-Policy'
    ]
    // Identical by construction: both read the same module. This asserts
    // nobody has re-hardcoded the production copy.
    expect(prodCsp).toBe(SECURITY_HEADERS['Content-Security-Policy'])
  })

  it('should let dev differ from production only by allowing inline script (Vite preamble)', () => {
    const swapped = DEV_CONTENT_SECURITY_POLICY.replace(" 'unsafe-inline';", ';')
    const prodWithoutHashes = INLINE_SCRIPT_HASHES.reduce(
      (csp: string, h: string) => csp.replace(` ${h}`, ''),
      SECURITY_HEADERS['Content-Security-Policy'],
    )
    expect(swapped).toBe(prodWithoutHashes)
  })

  it('should hash exactly the executable inline scripts in index.html (M4)', () => {
    // Hash the LF form: CI builds from the LF blob and the site serves it as is.
    const html = readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf-8').replace(/\r\n/g, '\n')
    const hashes: string[] = []
    for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] ?? ''
      if (/\bsrc=/.test(attrs) || /ld\+json/.test(attrs)) continue
      hashes.push(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
    }
    expect(hashes).toEqual(INLINE_SCRIPT_HASHES)
  })

  it('should not trust wildcard hosts anyone can deploy to', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy']
    expect(csp).not.toContain('https://*.workers.dev')
    expect(csp).not.toContain('https://*.onrender.com')
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })

  it('should keep localhost out of the production Internet Identity origins (M5)', () => {
    const file = readFileSync(path.resolve(__dirname, '../../../public/.well-known/ii-alternative-origins'), 'utf-8')
    const { alternativeOrigins } = JSON.parse(file) as { alternativeOrigins: string[] }
    expect(alternativeOrigins).toEqual(['https://propxchain.com', 'https://www.propxchain.com'])
  })

  it('should keep raw uncertified access disabled', () => {
    const defaultRule = parseIcAssets().find((rule) => rule.match === '**/*') as unknown as {
      allow_raw_access?: boolean
    }

    expect(defaultRule.allow_raw_access).toBe(false)
  })
})
