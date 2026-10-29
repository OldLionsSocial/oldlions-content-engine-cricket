// Writes one caption per platform. Claude writes the words; every number is checked
// against the fact sheet, and anything that fails falls back to a safe template.
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { allowedNumbers } from './facts.js';

export const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'gmb'];

const KIND_BRIEF = {
  fixture: 'Announce an upcoming fixture and encourage members and families to come and support.',
  'team-list': 'Announce the selected team. Congratulate the players. Mention every player in the facebook caption.',
  result: 'Report the result and celebrate the player of the match. Mention other standout performances briefly.',
  'playing-xi': 'Announce the playing XI. Congratulate the players. Mention every player in the facebook caption.',
  gameday: 'It is match day. Build excitement, give the start time and venue, and invite people to come down and support.',
  potm: 'Celebrate the player of the match and their performance. Keep it personal and proud.',
  milestone: 'Celebrate the milestone performance. Make it feel special.',
  'weekend-fixtures': "List this weekend's fixtures for all club teams and invite members to support.",
  'weekend-results': "Summarise the weekend's results across all club teams. Celebrate wins, stay positive about losses.",
  predict: 'Invite followers to predict the score in the comments. Fun and short.',
  potw: 'Invite followers to vote for Player of the Week. Mention each candidate briefly.',
  guess: 'Tease a Guess the Lion silhouette. Invite guesses in the comments. Never reveal the name.',
  'guess-reveal': "Reveal yesterday's Guess the Lion answer. Light-hearted.",
  leaderboard: 'Share the season leaderboard. Celebrate the leader, encourage the chasers.',
  quiz: "Pose the Umpire's Call question. Invite answers in the comments. Never reveal the answer.",
  'quiz-answer': "Reveal the answer to yesterday's Umpire's Call and explain it simply.",
};

export function checkCaption(text, allowed) {
  const nums = text.match(/\d+(?:\.\d+)?/g) || [];
  const bad = nums.filter((n) => !allowed.has(n));
  return bad.length ? `Contains numbers not in the facts: ${[...new Set(bad)].join(', ')}` : null;
}

function fallback(kind, facts, club) {
  const get = (k) => (facts.find((f) => f.startsWith(k + ':')) || '').slice(k.length + 1).trim();
  const tags = club.hashtags.join(' ');
  let base;
  if (kind === 'fixture') base = `${get('Team')} v ${get('Opponent')}, ${get('Date')} at ${get('Start time')}, ${get('Venue')}. Come and support!`;
  else if (kind === 'team-list') base = `Here's the ${get('Team')} side to face ${get('Opponent')} on ${get('Date')}: ${get('Selected team')}. Good luck, Lions!`;
  else if (kind === 'result') base = `${get('Result')}. ${facts.filter((f) => f.startsWith('Innings:')).map((f) => f.slice(9)).join(' v ')}. Player of the match: ${get('Player of the match')}.`;
  else if (kind === 'playing-xi') base = `Your ${get('Team')} side to face ${get('Opponent')} on ${get('Date')}: ${get('Selected team')}. Good luck, Lions!`;
  else if (kind === 'gameday') base = `Game day! ${get('Team')} v ${get('Opponent')}, ${get('Start time')} at ${get('Venue')}. Come down and support!`;
  else if (kind === 'potm') base = `Player of the match: ${get('Player of the match')} against ${get('Opponent')}.`;
  else if (kind === 'milestone') base = `${get('Milestone')}, against ${get('Opponent')}. Take a bow!`;
  else if (kind === 'weekend-fixtures') base = `This weekend: ${facts.filter((f) => f.startsWith('Fixture:')).map((f) => f.slice(9)).join('; ')}. Come and support!`;
  else if (kind === 'weekend-results') base = `Weekend results: ${facts.filter((f) => f.startsWith('Result:')).map((f) => f.slice(8)).join(' ')}`;
  else if (kind === 'predict') base = `Predict the score! ${get('Match')}, ${get('Date')}. ${get('Question')} Comment your prediction below.`;
  else if (kind === 'potw') base = `Player of the Week: who gets your vote? ${facts.filter((f) => f.startsWith('Candidate')).map((f) => f.replace(/^Candidate /, '')).join('. ')}. Vote in our story!`;
  else if (kind === 'guess') base = `Guess the Lion! ${get('Clue') !== 'none' ? `Clue: ${get('Clue')}. ` : ''}Comment your guess. Answer tomorrow.`;
  else if (kind === 'guess-reveal') base = `It was ${get('Answer')}! Did you get it?`;
  else if (kind === 'leaderboard') base = `${get('Leaderboard')}: ${facts.filter((f) => /^\d+\./.test(f)).slice(0, 3).join(', ')}.`;
  else if (kind === 'quiz') base = `Umpire's Call: ${get('Question')} ${facts.filter((f) => f.startsWith('Option')).map((f) => f.replace('Option ', '')).join(' / ')}. Comment your answer!`;
  else if (kind === 'quiz-answer') base = `Umpire's Call answer: ${get('Correct answer')}. ${get('Explanation')}`;
  else base = facts.slice(0, 3).join('. ');
  return Object.fromEntries(PLATFORMS.map((p) => [p, p === 'gmb' ? base : `${base} ${tags}`]));
}

export async function writeCaptions(kind, facts, club, { log = console.log } = {}) {
  const allowed = allowedNumbers(facts);
  const safe = fallback(kind, facts, club);
  if (!process.env.ANTHROPIC_API_KEY) {
    log('  ANTHROPIC_API_KEY not set: using template captions');
    return { captions: safe, source: 'template', warnings: [] };
  }

  const client = new Anthropic();
  const style = fs.readFileSync(new URL('../config/style-guide.md', import.meta.url), 'utf8');
  const system = `You write social media captions for ${club.name}.\n\n${style}\n\nHashtags to use where the platform suits them: ${club.hashtags.join(' ')}\n\nReply with only a JSON object with these keys: ${PLATFORMS.join(', ')}. No markdown fences, no commentary.`;
  let prompt = `Task: ${KIND_BRIEF[kind]}\n\nFacts (the only information you may use; do not add any other numbers, scores or details):\n- ${facts.join('\n- ')}`;

  const warnings = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const msg = await client.messages.create({ model: club.claudeModel, max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] });
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const out = JSON.parse(text.replace(/```json|```/g, '').trim());
      const problems = {};
      for (const p of PLATFORMS) {
        const err = typeof out[p] === 'string' ? checkCaption(out[p], allowed) : 'missing';
        if (err) problems[p] = err;
      }
      if (!Object.keys(problems).length) return { captions: out, source: 'claude', warnings };
      if (attempt === 2) {
        // Keep the good ones, swap failures for the safe template, and flag it for the reviewer.
        for (const [p, err] of Object.entries(problems)) {
          out[p] = safe[p];
          warnings.push(`${p}: Claude caption replaced with template (${err})`);
        }
        return { captions: out, source: 'claude+template', warnings };
      }
      prompt += `\n\nYour previous attempt had problems: ${JSON.stringify(problems)}. Fix them and use only numbers that appear in the facts.`;
    } catch (e) {
      warnings.push(`Claude attempt ${attempt} failed: ${e.message}`);
    }
  }
  return { captions: safe, source: 'template', warnings };
}
