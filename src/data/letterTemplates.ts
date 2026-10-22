// Letter templates for Contact Reps. Source of truth for the wording:
// docs/contact-reps/letter-templates.md. Keep the two in sync.
//
// Each letter is kept under 2,000 characters (subject + body) so it fits in
// an email link for most mail apps. [Bracketed] text is either filled in
// from the camera's location (see fillLetter) or left for the user.

export type LetterLevel = 'city' | 'county' | 'state';

export interface LetterTemplate {
  subject: string;
  body: string;
}

export const LETTER_TEMPLATES: Record<LetterLevel, LetterTemplate> = {
  city: {
    subject: 'Remove License Plate Reader Cameras in [City]',
    body: `Dear Mayor [Last Name] and Members of the [City] City Council,

My name is [Your Name], and I live in [City]. I am asking the council to remove every automated license plate reader (ALPR) in [City], permanently delete the data they have collected, and ban their use going forward.

These cameras log every passing car, its make, color, and bumper stickers, and whoever is in the frame, whether or not anyone is suspected of a crime. Within weeks, that builds a searchable record of where each of us lives, works, worships, sees a doctor, and takes our kids to school, with no warrant and no judge.

That record is already being abused. Officers in Kansas, Texas, and Kentucky have been convicted, indicted, or arrested for using plate readers to track ex-partners, one allegedly searching more than 10,000 times. The Supreme Court held in Carpenter v. United States that long-term location records generally require a warrant, and the [State] Constitution protects us against unreasonable searches. ALPRs collect that history on everyone.

Lafayette, Colorado, San Diego, and Fayetteville, Arkansas have already voted to remove or ban these cameras. [City] should join them.

I am asking the council to:
1. End every ALPR contract and shut off every camera.
2. Remove the cameras from city property.
3. Require vendors to delete all [City] data and certify it in writing, except evidence held under a warrant.
4. Ban ALPRs on city property and city funding for them.
5. Bar city access to other agencies' and businesses' ALPR networks.

Thank you for your time and for serving our city.

Respectfully,
[Your Name]
[Street Address, City, State, ZIP]
[Phone Number]`,
  },
  county: {
    subject: 'Remove License Plate Reader Cameras in [County] County',
    body: `Dear [County Judge / County Executive / Chair] [Last Name] and Members of the [County] County [Commission / Board / Court],

My name is [Your Name], and I live in [County] County. I am asking you to remove every automated license plate reader (ALPR) operated by or for [County] County, permanently delete the data they have collected, and ban their use going forward.

These cameras log every passing car, its make, color, and bumper stickers, and whoever is in the frame, whether or not anyone is suspected of a crime. Within weeks, that builds a searchable record of where each of us lives, works, worships, sees a doctor, and takes our kids to school, with no warrant and no judge.

That record is already being abused. Officers in Kansas, Texas, and Kentucky have been convicted, indicted, or arrested for using plate readers to track ex-partners, one allegedly searching more than 10,000 times. The Supreme Court held in Carpenter v. United States that long-term location records generally require a warrant, and the [State] Constitution protects us against unreasonable searches. ALPRs collect that history on everyone.

Madison County, Georgia, Lafayette, Colorado, and Fayetteville, Arkansas have already ended or banned these cameras. [County] County should join them.

I am asking you to:
1. End every county ALPR contract, including the Sheriff's Office, and shut off every camera.
2. Remove the cameras from county property and roads.
3. Require vendors to delete all county data and certify it in writing, except evidence held under a warrant.
4. Ban ALPRs on county property and fund them in no county budget.
5. Bar county access to other agencies' and businesses' ALPR networks.

Thank you for your time and for serving our county.

Respectfully,
[Your Name]
[Street Address, City, State, ZIP]
[Phone Number]`,
  },
  state: {
    subject: 'Constituent Request: Ban License Plate Reader Cameras in [State]',
    body: `Dear [Representative / Senator] [Last Name],

My name is [Your Name], and I am a constituent in [City, State]. I am asking you to work to remove every automated license plate reader (ALPR) in [State], permanently delete the data they have collected, and ban their use going forward.

These cameras log every passing car, its make, color, and bumper stickers, and whoever is in the frame, whether or not anyone is suspected of a crime. Within weeks, that builds a searchable record of where each of us lives, works, worships, sees a doctor, and takes our kids to school, with no warrant and no judge.

That record is already being abused. Officers in Kansas, Texas, and Kentucky have been convicted, indicted, or arrested for using plate readers to track ex-partners, one allegedly searching more than 10,000 times. The Supreme Court held in Carpenter v. United States that long-term location records generally require a warrant, and the [State] Constitution protects us against unreasonable searches. ALPRs collect that history on everyone.

Cities and counties from San Diego to Madison County, Georgia have already acted. The state should protect every resident, not only those who live there.

I am asking you to:
1. Pass a statewide ban on ALPR use by every state and local agency.
2. Require all existing cameras to be shut off and removed.
3. Require all ALPR data to be deleted and certified, except evidence held under a warrant.
4. Ban public money, including grants, from paying for ALPRs.
5. Ban agencies from using privately owned ALPR networks.

Thank you for your time and for representing our community.

Respectfully,
[Your Name]
[Street Address, City, State, ZIP]
[Phone Number]`,
  },
};
