#!/usr/bin/env node
// Daily job: builds the posts that need no ops data, following the weekly plan.
//   Tuesday   -> Umpire's Call question (next one from config/quiz-bank.json)
//   Wednesday -> Umpire's Call answer
// Ops-driven posts (fixtures, results, Player of the week, leaderboards, Guess the Lion)
// arrive as events from the ops system instead.
import fs from 'node:fs';
import path from 'node:path';
import { buildEvent } from './build-pack.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const club = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/club.json'), 'utf8'));
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/quiz-bank.json'), 'utf8')).questions;

const now = new Date(new Date().toLocaleString('en-US', { timeZone: club.timezone }));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const week = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7 * 864e5));
const day = process.argv[2] || ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
const plan = club.dailyPlan || { tue: ['quiz'], wed: ['quiz.answer'] };

const q = bank[week % bank.length];
const events = { quiz: { event: 'quiz', date: iso(now), ...q }, 'quiz.answer': { event: 'quiz.answer', date: iso(now), ...q } };

const todo = plan[day] || [];
if (!todo.length) console.log(`Nothing scheduled for ${day}.`);
for (const name of todo) {
  if (!events[name]) { console.log(`Unknown daily item "${name}"`); continue; }
  await buildEvent(events[name]);
}
