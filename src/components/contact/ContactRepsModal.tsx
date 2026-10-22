import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Copy, Check, Mail, ExternalLink, Search, Landmark, Building2, Loader2, AlertTriangle, Phone } from 'lucide-react';
import type { ALPRCamera } from '@/types';
import { fetchOfficials, NotInUSError, type Officials } from '@/services/officialsService';
import type { LetterLevel } from '@/data/letterTemplates';
import {
  fillLetter,
  insertPersonalNote,
  findPlaceholders,
  letterLength,
  letterAsText,
  buildGmailLink,
  buildMailtoLink,
  contactSearchUrl,
  placeNoun,
  MAILTO_MAX_LENGTH,
  type LetterContext,
} from '@/utils/letter';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

// Contact Reps (MVP1): from a clicked camera, list the city, county, and state
// legislators that answer for its location, and hand the user a filled-in
// letter they can personalize and send from their own email.

interface Recipient {
  key: string;
  level: LetterLevel;
  title: string;
  subtitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  /** Shown under the card when the email was found automatically and not yet checked */
  emailCaveat?: { text: string; source: string | null };
  /** "Profile" for a legislator's official page, "Website" for a government */
  websiteLabel: string;
  /** Used for "Find contact" when there is no email on file */
  searchQuery: string;
  ctx: LetterContext;
}

// "Democratic" -> "D"; nonpartisan seats (Nebraska) show no party at all
function partyLetter(party: string): string | null {
  if (!party || /nonpartisan/i.test(party)) return null;
  return party.trim()[0].toUpperCase();
}

function lastWord(name: string | null): string | undefined {
  return name ? name.trim().split(/\s+/).slice(-1)[0] : undefined;
}

// "Pleasantville village" is addressed as "Village of Pleasantville"
const PLACE_TITLES: Record<string, string> = {
  city: 'City', town: 'Town', village: 'Village', borough: 'Borough', township: 'Township', 'city and borough': 'City and Borough',
};

function buildRecipients(o: Officials): Recipient[] {
  const recipients: Recipient[] = [];
  const state = o.state.name;

  if (o.place) {
    recipients.push({
      key: 'city',
      level: 'city',
      title: `${(o.place.type && PLACE_TITLES[o.place.type]) || 'City'} of ${o.place.name}`,
      // Only name a title we know: "Mayor" comes from the state/type table, never assumed
      subtitle: [
        o.place.head ? (o.place.headTitle ? `${o.place.headTitle} ${o.place.head}` : o.place.head) : null,
        o.place.body ?? 'City government',
      ].filter(Boolean).join(' · '),
      email: o.place.email,
      phone: o.place.phone,
      emailCaveat: o.place.contactStatus === 'found' && o.place.email
        ? { text: `Found on the ${placeNoun(o.place.type)} website, not yet checked by a person. Make sure it reaches the right office.`, source: o.place.contactPage }
        : undefined,
      website: o.place.website,
      websiteLabel: 'Website',
      searchQuery: `${o.place.name} ${o.state.code} ${o.place.body ?? `${placeNoun(o.place.type)} council`} contact email`,
      ctx: {
        state,
        city: o.place.name,
        county: o.county?.name,
        lastName: lastWord(o.place.head),
        cityType: o.place.type,
        cityBody: o.place.body,
        cityHeadTitle: o.place.headTitle,
      },
    });
  }

  if (o.county) {
    recipients.push({
      key: 'county',
      level: 'county',
      title: o.county.name,
      subtitle: [
        o.county.head && o.county.headTitle ? `${o.county.headTitle} ${o.county.head}` : null,
        o.county.body ?? 'County government',
        o.place ? null : 'This camera is outside any city, so the county governs it',
      ].filter(Boolean).join(' · '),
      email: o.county.email,
      phone: o.county.phone,
      emailCaveat: o.county.contactStatus === 'found' && o.county.email
        ? { text: 'Found on the county website, not yet checked by a person. Make sure it reaches the right office.', source: o.county.contactPage }
        : undefined,
      website: o.county.website,
      websiteLabel: 'Website',
      searchQuery: `${o.county.name} ${o.state.code} commissioners contact email`,
      ctx: {
        state,
        county: o.county.name,
        countyBody: o.county.body,
        countyHeadTitle: o.county.headTitle,
        lastName: lastWord(o.county.head),
      },
    });
  }

  for (const l of o.stateLegislators) {
    const role = l.chamber === 'lower' ? 'State representative' : 'State senator';
    const party = partyLetter(l.party);
    recipients.push({
      key: `state-${l.chamber}-${l.district}-${l.name}`,
      level: 'state',
      title: party ? `${l.name} (${party})` : l.name,
      subtitle: `${role} · District ${l.district}`,
      email: l.email,
      phone: l.phone,
      website: l.url,
      websiteLabel: 'Profile',
      searchQuery: `${l.name} ${state} legislator email`,
      ctx: { state, lastName: l.familyName, chamber: l.chamber },
    });
  }

  return recipients;
}

interface ContactRepsModalProps {
  camera: ALPRCamera;
  onClose: () => void;
}

export function ContactRepsModal({ camera, onClose }: ContactRepsModalProps) {
  const [officials, setOfficials] = useState<Officials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Recipient | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchOfficials(camera.lat, camera.lon)
      .then(o => { if (!cancelled) setOfficials(o); })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof NotInUSError
          ? 'Contact lookup only covers cameras in the United States for now.'
          : 'Could not look up officials for this camera. Check your connection and try again.');
      });
    return () => { cancelled = true; };
  }, [camera.lat, camera.lon, attempt]);

  // Escape steps back from the letter first, then closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selected, onClose]);

  const recipients = useMemo(() => (officials ? buildRecipients(officials) : []), [officials]);

  // Portal to <body>: the MapLibre popup is CSS-transformed, which would
  // otherwise trap a position:fixed overlay inside the popup's box.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Contact your representatives">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-dark-800 rounded-t-xl sm:rounded-xl border border-dark-600 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 shrink-0">
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="w-8 h-8 -ml-2 flex items-center justify-center rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
              aria-label="Back to the list of officials"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="flex-1 text-lg font-semibold text-white truncate">
            {selected ? selected.title : 'Who answers for this camera'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto">
          {selected ? (
            <LetterEditor recipient={selected} />
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-dark-300">{error}</p>
              <button
                onClick={() => setAttempt(a => a + 1)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-dark-700 text-dark-200 hover:bg-dark-600 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : !officials ? (
            <div className="flex items-center gap-2 py-6 text-sm text-dark-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Looking up officials for this location…
            </div>
          ) : (
            <RecipientList recipients={recipients} officials={officials} onSelect={setSelected} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RecipientList({ recipients, officials, onSelect }: {
  recipients: Recipient[];
  officials: Officials;
  onSelect: (r: Recipient) => void;
}) {
  const local = recipients.filter(r => r.level !== 'state');
  const state = recipients.filter(r => r.level === 'state');

  return (
    <div className="space-y-5">
      <p className="text-xs text-dark-400">
        Based on where this camera is, not where you live. A city council or county board usually
        approves the camera contract and can cancel it, so start there.
      </p>

      {local.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 mb-2 text-sm font-medium text-dark-100">
            <Building2 className="w-4 h-4 text-dark-300" /> Local government
          </h3>
          <div>{local.map(r => <RecipientCard key={r.key} recipient={r} onSelect={onSelect} />)}</div>
          {officials.countyNote && <p className="mt-2 text-xs text-dark-400">{officials.countyNote}</p>}
        </section>
      )}

      <section>
        <h3 className="flex items-center gap-2 mb-2 text-sm font-medium text-dark-100">
          <Landmark className="w-4 h-4 text-dark-300" /> {officials.state.name} legislators
        </h3>
        {state.length > 0 && (
          <div>{state.map(r => <RecipientCard key={r.key} recipient={r} onSelect={onSelect} />)}</div>
        )}
        {officials.unfilledSeats.map(seat => (
          <p key={`${seat.chamber}-${seat.district}`} className="mt-2 text-xs text-dark-400">
            {seat.chamber === 'lower' ? 'State House' : 'State Senate'} District {seat.district}: no current member on file.
            The seat may be vacant.
          </p>
        ))}
        {state.length === 0 && officials.unfilledSeats.length === 0 && (
          <p className="text-xs text-dark-400">No legislators found for this district.</p>
        )}
      </section>

      <p className="text-[11px] text-dark-500">
        Legislators from Open States; city and county websites and mayors from Wikidata, which can lag after an election.
      </p>
    </div>
  );
}

// Card layout follows Track the Pole's: who, what they are, then one row of
// contact buttons. "Write letter" leads because the letter is the product.
function RecipientCard({ recipient: r, onSelect }: { recipient: Recipient; onSelect: (r: Recipient) => void }) {
  const chip = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-dark-500 text-dark-100 hover:bg-dark-600 transition-colors';
  return (
    <div className="py-3 border-b border-dark-600 last:border-b-0">
      <p className="text-sm font-semibold text-white">{r.title}</p>
      {r.subtitle && <p className="text-xs text-dark-400">{r.subtitle}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          onClick={() => onSelect(r)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-dark-900 hover:bg-accent/90 transition-colors"
        >
          <Mail className="w-3.5 h-3.5" /> Write letter
        </button>
        {r.email && (
          <a href={`mailto:${r.email}`} className={chip} title={r.email}>Email</a>
        )}
        {r.phone && (
          <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className={chip}>
            <Phone className="w-3 h-3" /> {r.phone}
          </a>
        )}
        {r.website && (
          <a href={r.website} target="_blank" rel="noopener noreferrer" className={chip}>
            <ExternalLink className="w-3 h-3" /> {r.websiteLabel}
          </a>
        )}
        {!r.email && (
          <a href={contactSearchUrl(r.searchQuery)} target="_blank" rel="noopener noreferrer" className={chip}>
            <Search className="w-3 h-3" /> Find contact
          </a>
        )}
      </div>
      {r.emailCaveat && <EmailCaveat caveat={r.emailCaveat} />}
    </div>
  );
}

function EmailCaveat({ caveat }: { caveat: NonNullable<Recipient['emailCaveat']> }) {
  return (
    <p className="mt-2 text-[11px] text-amber-400/90">
      {caveat.text}
      {caveat.source && (
        <> <a href={caveat.source} target="_blank" rel="noopener noreferrer" className="underline">Source</a></>
      )}
    </p>
  );
}

function LetterEditor({ recipient }: { recipient: Recipient }) {
  const initial = useMemo(() => fillLetter(recipient.level, recipient.ctx), [recipient]);
  const [to, setTo] = useState(recipient.email ?? '');
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [note, setNote] = useState('');
  const [pasteHint, setPasteHint] = useState(false);
  const { copied, copy } = useCopyFeedback();

  const letter = { subject, body: insertPersonalNote(body, note) };
  const length = letterLength(letter);
  const leftover = findPlaceholders(`${subject}\n${letter.body}`);

  // When the letter is too long for the link, put it on the clipboard first
  // so the user only has to paste it into the email that opens.
  const openLink = async (link: { url: string; includesBody: boolean }, newTab: boolean) => {
    if (!link.includesBody) {
      await copy(letter.body, 'body');
      setPasteHint(true);
    } else {
      setPasteHint(false);
    }
    if (newTab) window.open(link.url, '_blank', 'noopener,noreferrer');
    else window.location.href = link.url;
  };

  const fieldClass = 'w-full px-3 py-2 rounded-md bg-dark-900 border border-dark-600 text-sm text-dark-100 placeholder:text-dark-500 focus:outline-none focus:border-accent';

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs text-dark-400 mb-1">To</span>
        <input
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="Paste the email address you found"
          className={fieldClass}
        />
        {recipient.emailCaveat && <EmailCaveat caveat={recipient.emailCaveat} />}
        {!recipient.email && (
          <span className="block mt-1 text-xs text-dark-400">
            No email on file.{' '}
            {recipient.website && (
              <><a href={recipient.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Check their website</a> or </>
            )}
            <a href={contactSearchUrl(recipient.searchQuery)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">search for a contact</a>
            , or just copy the letter.
          </span>
        )}
      </label>

      <label className="block">
        <span className="block text-xs text-dark-400 mb-1">Subject</span>
        <input value={subject} onChange={e => setSubject(e.target.value)} className={fieldClass} />
      </label>

      <label className="block">
        <span className="block text-xs text-dark-400 mb-1">Why this matters to you (optional, goes near the top)</span>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="A sentence or two in your own words. Personal letters get read."
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="block text-xs text-dark-400 mb-1">Letter (edit anything)</span>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className={`${fieldClass} font-mono text-xs leading-relaxed`} />
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={length > MAILTO_MAX_LENGTH ? 'text-amber-400' : 'text-dark-400'}>
          {length.toLocaleString()} characters
        </span>
        {leftover.length > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Still to fill in: {leftover.join(', ')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => copy(letterAsText(letter, to || undefined), 'all')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            copied === 'all' ? 'bg-green-600 text-white' : 'bg-accent text-dark-900 hover:bg-accent/90'
          }`}
        >
          {copied === 'all' ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy email</>}
        </button>
        <button
          onClick={() => openLink(buildGmailLink(to, letter), true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-dark-700 text-dark-200 hover:bg-dark-600 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in Gmail
        </button>
        <button
          onClick={() => openLink(buildMailtoLink(to, letter), false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-dark-700 text-dark-200 hover:bg-dark-600 transition-colors"
        >
          <Mail className="w-3.5 h-3.5" /> Open in email app
        </button>
      </div>

      {pasteHint && (
        <p className="text-xs text-amber-400" role="status">
          The letter was too long for the email link, so it's on your clipboard. Paste it into the email body.
        </p>
      )}
    </div>
  );
}
