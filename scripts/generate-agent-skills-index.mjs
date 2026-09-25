#!/usr/bin/env node
// Post-build step: writes dist/.well-known/agent-skills/index.json. Pass a
// directory to target a different build output.
import path from 'node:path';
import { writeIndex } from './agent-skills-index.mjs';

const dir = process.argv[2] ?? path.resolve('dist/.well-known/agent-skills');
const { target, count } = writeIndex(dir);
console.log(`agent-skills index: ${count} skill(s) -> ${target}`);
