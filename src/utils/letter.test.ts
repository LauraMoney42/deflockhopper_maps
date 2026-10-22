import { describe, expect, it } from 'vitest';
import { LETTER_TEMPLATES } from '@/data/letterTemplates';
import {
  fillLetter,
  insertPersonalNote,
  findPlaceholders,
  letterLength,
  buildMailtoLink,
  buildGmailLink,
  MAILTO_MAX_LENGTH,
} from './letter';

describe('LETTER_TEMPLATES', () => {
  it('keeps every template under 2,000 characters', () => {
    for (const t of Object.values(LETTER_TEMPLATES)) {
      expect(letterLength(t)).toBeLessThan(2000);
    }
  });
});

describe('fillLetter', () => {
  it('fills city, state, and mayor into the city letter', () => {
    const { subject, body } = fillLetter('city', { state: 'Colorado', city: 'Westminster', lastName: 'McNally' });
    expect(subject).toBe('Remove License Plate Reader Cameras in Westminster');
    expect(body).toContain('Dear Mayor McNally and Members of the Westminster City Council');
    expect(body).toContain('the Colorado Constitution');
    expect(findPlaceholders(body)).toEqual(['[Your Name]', '[Street Address, City, State, ZIP]', '[Phone Number]']);
  });

  it('addresses the council alone when no mayor is known', () => {
    const { body } = fillLetter('city', { state: 'Colorado', city: 'Westminster' });
    expect(body.startsWith('Dear Members of the Westminster City Council')).toBe(true);
  });

  it('greets the mayor and the named body for a village, and makes the text say village', () => {
    const { body } = fillLetter('city', {
      state: 'New York', city: 'Pleasantville', cityType: 'village', cityBody: 'Board of Trustees', cityHeadTitle: 'Mayor', lastName: 'Smith',
    });
    expect(body).toMatch(/^Dear Mayor Smith and Members of the Pleasantville Board of Trustees,\n/);
    expect(body).toContain('serving our village.');
    expect(body).toContain('Remove the cameras from village property.');
    expect(body).toContain('Ban ALPRs on village property and village funding for them.');
    expect(body).toContain('Bar village access to');
    expect(body).toContain('I am asking the board to remove');
    expect(body).toContain('I am asking the board to:');
    expect(body).not.toMatch(/\bcity (property|funding|access)|our city|council/);
  });

  it('uses town and borough wording', () => {
    const town = fillLetter('city', { state: 'New York', city: 'Smithtown', cityType: 'town', cityBody: 'Town Board', cityHeadTitle: 'Supervisor', lastName: 'Wehrheim' }).body;
    expect(town).toMatch(/^Dear Supervisor Wehrheim and Members of the Smithtown Town Board,\n/);
    expect(town).toContain('serving our town.');
    const borough = fillLetter('city', { state: 'Pennsylvania', city: 'Doylestown', cityType: 'borough', cityBody: 'Borough Council', cityHeadTitle: 'Mayor' }).body;
    expect(borough).toMatch(/^Dear Members of the Doylestown Borough Council,\n/);
    expect(borough).toContain('borough property');
    expect(borough).toContain('I am asking the council to remove');
  });

  it('greets just the body when the mayor is unknown, and just the place when the body varies', () => {
    expect(fillLetter('city', { state: 'Missouri', city: 'Ashland', cityType: 'city', cityBody: 'City Council', cityHeadTitle: 'Mayor' }).body)
      .toMatch(/^Dear Members of the Ashland City Council,\n/);
    const varies = fillLetter('city', { state: 'Missouri', city: 'Ashland', cityType: 'city', cityBody: null, cityHeadTitle: null, lastName: 'Jones' }).body;
    expect(varies).toMatch(/^Dear Ashland officials,\n/);
    // never invents a council or a mayor title when the data is unknown
    expect(varies).toContain('I am asking you to remove');
    expect(varies).not.toContain('Mayor');
    expect(varies).not.toContain('Jones');
  });

  it('does not use a mayor title the table does not know', () => {
    const { body } = fillLetter('city', { state: 'Connecticut', city: 'Orange', cityType: 'town', cityBody: 'Board of Selectmen', cityHeadTitle: null, lastName: 'Smith' });
    expect(body).toMatch(/^Dear Members of the Orange Board of Selectmen,\n/);
  });

  it('falls back to "city" wording for unusual place types', () => {
    const { body } = fillLetter('city', { state: 'Alaska', city: 'Juneau', cityType: 'city and borough', cityBody: 'Assembly', cityHeadTitle: 'Mayor' });
    expect(body).toMatch(/^Dear Members of the Juneau Assembly,\n/);
    expect(body).toContain('serving our city.');
    expect(body).toContain('I am asking the assembly to');
  });

  it('titles state legislators by chamber, with Nebraska members as senators', () => {
    expect(fillLetter('state', { state: 'Colorado', chamber: 'lower', lastName: 'García' }).body)
      .toMatch(/^Dear Representative García,/);
    expect(fillLetter('state', { state: 'Colorado', chamber: 'upper', lastName: 'Benavidez' }).body)
      .toMatch(/^Dear Senator Benavidez,/);
    expect(fillLetter('state', { state: 'Nebraska', chamber: 'legislature', lastName: 'Guereca' }).body)
      .toMatch(/^Dear Senator Guereca,/);
  });

  it('leaves unknown values as placeholders for the user', () => {
    const { body } = fillLetter('county', { state: 'Colorado', county: 'Adams County' });
    expect(findPlaceholders(body)).not.toContain('[County Judge / County Executive / Chair]');
    expect(body).toContain('I live in Adams County.');
    expect(body).not.toContain('County County');
  });

  it('greets the county body and its leader when known', () => {
    const { body } = fillLetter('county', {
      state: 'Arkansas', county: 'Washington County', countyBody: 'Quorum Court', countyHeadTitle: 'County Judge', lastName: 'Deffenbaugh',
    });
    expect(body).toMatch(/^Dear County Judge Deffenbaugh and Members of the Washington County Quorum Court,\n/);
  });

  it('greets just the body when the leader is unknown, and never guesses the body', () => {
    expect(fillLetter('county', { state: 'Texas', county: 'Travis County', countyBody: 'Commissioners Court', countyHeadTitle: 'County Judge' }).body)
      .toMatch(/^Dear Members of the Travis County Commissioners Court,\n/);
    expect(fillLetter('county', { state: 'New York', county: 'Albany County', countyBody: null }).body)
      .toMatch(/^Dear Albany County officials,\n/);
  });

  it('keeps a known mayor in the greeting when the council name is unknown', () => {
    const { body } = fillLetter('city', {
      state: 'Arkansas', city: 'Springdale', cityType: 'city', cityBody: null, cityHeadTitle: 'Mayor', lastName: 'Sprouse',
    });
    expect(body).toMatch(/^Dear Mayor Sprouse and Springdale officials,\n/);
  });

  it('keeps parish names intact', () => {
    const { subject } = fillLetter('county', { state: 'Louisiana', county: 'Orleans Parish' });
    expect(subject).toBe('Remove License Plate Reader Cameras in Orleans Parish');
  });
});

describe('insertPersonalNote', () => {
  const body = 'Dear X,\n\nOpening request.\n\nRest of letter.';

  it('inserts the note after the opening request', () => {
    expect(insertPersonalNote(body, '  I drive past three of these daily. ')).toBe(
      'Dear X,\n\nOpening request.\n\nI drive past three of these daily.\n\nRest of letter.',
    );
  });

  it('leaves the body alone for an empty note', () => {
    expect(insertPersonalNote(body, '   ')).toBe(body);
  });
});

describe('email links', () => {
  const short = { subject: 'Hello there', body: 'Short body & more' };
  const long = { subject: 'Hello', body: 'word '.repeat(600) };

  it('includes an encoded body when it fits', () => {
    const link = buildMailtoLink('rep@example.gov', short);
    expect(link.includesBody).toBe(true);
    expect(link.url).toBe('mailto:rep@example.gov?subject=Hello%20there&body=Short%20body%20%26%20more');
  });

  it('drops the body from a mailto link that would be too long', () => {
    const link = buildMailtoLink('rep@example.gov', long);
    expect(link.includesBody).toBe(false);
    expect(link.url.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    expect(link.url).not.toContain('body=');
  });

  it('builds a Gmail compose link with recipient, subject, and body', () => {
    const link = buildGmailLink('rep@example.gov', short);
    expect(link.includesBody).toBe(true);
    expect(link.url).toContain('https://mail.google.com/mail/?view=cm&fs=1&to=rep%40example.gov&su=Hello%20there&body=');
  });

  it('fits a filled template in a Gmail link', () => {
    const letter = fillLetter('county', { state: 'Colorado', county: 'Adams County' });
    expect(buildGmailLink('a@b.gov', letter).includesBody).toBe(true);
  });
});
