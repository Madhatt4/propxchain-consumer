#!/usr/bin/env node
/**
 * Refreshes public/.well-known/oauth-authorization-server from the live
 * authorization server. The apex-domain copy exists so agents probing
 * propxchain.com (RFC 8414 / isitagentready) find the metadata; the issuer is
 * and must remain https://auth.propxchain.com, so this file is a mirror, never
 * an edit target.
 */
import { writeFileSync } from 'node:fs';

const SOURCE = 'https://auth.propxchain.com/.well-known/oauth-authorization-server';
const TARGET = new URL('../public/.well-known/oauth-authorization-server', import.meta.url);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} responded ${res.status}`);
const doc = await res.json();
if (doc.issuer !== 'https://auth.propxchain.com') throw new Error(`unexpected issuer ${doc.issuer}`);
writeFileSync(TARGET, JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${TARGET.pathname}`);
