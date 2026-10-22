import { LETTER_TEMPLATES, type LetterLevel } from '@/data/letterTemplates';

// Pure helpers for Contact Reps letters: fill placeholders from the camera's
// location, insert the user's personal note, and build email links.

/** Many mail apps (Outlook, some mobile clients) cut off mailto: links past ~2,000 chars. */
export const MAILTO_MAX_LENGTH = 2000;
/** Gmail's compose URL tolerates much longer links; stay well under browser limits. */
export const GMAIL_MAX_LENGTH = 8000;

export interface LetterContext {
  /** Full state name, e.g. "Colorado" */
  state: string;
  /** City name without "city" suffix, e.g. "Westminster" */
  city?: string;
  /** Full county name as Census gives it, e.g. "Adams County" or "Orleans Parish" */
  county?: string;
  /** Recipient's family name, when known */
  lastName?: string;
  /** County governing body, e.g. "Quorum Court"; unknown where a state's counties differ */
  countyBody?: string | null;
  /** How the county's leader is addressed, e.g. "County Judge" */
  countyHeadTitle?: string | null;
  /** For state letters: which chamber the legislator sits in */
  chamber?: 'upper' | 'lower' | 'legislature';
}

export interface Letter {
  subject: string;
  body: string;
}

function replaceAll(text: string, placeholder: string, value: string | undefined): string {
  return value ? text.split(placeholder).join(value) : text;
}

export function fillLetter(level: LetterLevel, ctx: LetterContext): Letter {
  const { subject } = LETTER_TEMPLATES[level];
  let { body } = LETTER_TEMPLATES[level];

  if (level === 'city' && !ctx.lastName) {
    // No mayor on file: address the council alone instead of leaving a
    // "Mayor [Last Name]" gap the user has to research.
    body = body.replace('Mayor [Last Name] and ', '');
  }

  if (level === 'county') {
    // Build the greeting from what we actually know, never a guessed title:
    // "Dear County Judge Smith and Members of the Washington County Quorum Court,"
    const lines = body.split('\n');
    const head = ctx.countyHeadTitle && ctx.lastName ? `${ctx.countyHeadTitle} ${ctx.lastName} and ` : '';
    if (ctx.countyBody && ctx.county) {
      lines[0] = `Dear ${head}Members of the ${ctx.county} ${ctx.countyBody},`;
    } else if (ctx.county) {
      lines[0] = `Dear ${ctx.county} officials,`;
    }
    body = lines.join('\n');
  }

  if (level === 'state' && ctx.chamber) {
    // Nebraska's one-house legislature calls its members senators
    const title = ctx.chamber === 'lower' ? 'Representative' : 'Senator';
    body = replaceAll(body, '[Representative / Senator]', title);
  }

  const fill = (text: string) => {
    let out = text;
    out = replaceAll(out, '[City]', ctx.city);
    // Templates say "[County] County"; swap the whole phrase so parishes and
    // boroughs don't come out as "Orleans Parish County"
    out = replaceAll(out, '[County] County', ctx.county);
    out = replaceAll(out, '[County]', ctx.county);
    out = replaceAll(out, '[State]', ctx.state);
    out = replaceAll(out, '[Last Name]', ctx.lastName);
    return out;
  };

  return { subject: fill(subject), body: fill(body) };
}

/**
 * Put the user's own words right after the opening request (the second
 * paragraph), so the letter reads personal from the top instead of
 * leading with the same text every office has seen before.
 */
export function insertPersonalNote(body: string, note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return body;
  const paragraphs = body.split('\n\n');
  const at = Math.min(2, paragraphs.length);
  paragraphs.splice(at, 0, trimmed);
  return paragraphs.join('\n\n');
}

/** Bracketed placeholders still in the text, e.g. ["[Your Name]", "[Phone Number]"]. */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]+\]/g) ?? [])];
}

export function letterLength(letter: Letter): number {
  return letter.subject.length + letter.body.length;
}

/** Text placed on the clipboard by "Copy email". */
export function letterAsText(letter: Letter, to?: string): string {
  const header = to ? `To: ${to}\n` : '';
  return `${header}Subject: ${letter.subject}\n\n${letter.body}`;
}

export interface EmailLink {
  url: string;
  /** False when the body was too long for the link and must be pasted in */
  includesBody: boolean;
}

function buildLink(base: string, params: Record<string, string>, bodyKey: string, body: string, maxLength: number): EmailLink {
  // encodeURIComponent, not URLSearchParams: mail apps expect %20 for spaces,
  // and some show a literal "+" otherwise.
  const encode = (p: Record<string, string>) =>
    Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const withBody = `${base}${encode({ ...params, [bodyKey]: body })}`;
  if (withBody.length <= maxLength) return { url: withBody, includesBody: true };
  return { url: `${base}${encode(params)}`, includesBody: false };
}

export function buildMailtoLink(to: string, letter: Letter): EmailLink {
  // Addresses stay unencoded: some mail apps don't decode "%40" back to "@"
  return buildLink(`mailto:${to.replace(/[\s?&#]/g, '')}?`, { subject: letter.subject }, 'body', letter.body, MAILTO_MAX_LENGTH);
}

export function buildGmailLink(to: string, letter: Letter): EmailLink {
  return buildLink(
    'https://mail.google.com/mail/?',
    { view: 'cm', fs: '1', to, su: letter.subject },
    'body',
    letter.body,
    GMAIL_MAX_LENGTH,
  );
}

/** Search link for finding a local body's contact page when we have no email. */
export function contactSearchUrl(query: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}
