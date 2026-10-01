type LegalPageId = 'privacy' | 'terms' | 'cancellation' | 'refunds';

const SUPPORT_EMAIL = 'contact.yscholar@gmail.com';
const COMPANY = 'YSCHOLAR TECHNOLOGY LLP';

const CONTENT: Record<LegalPageId, { title: string; sections: Array<{ heading: string; body: string[] }> }> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { heading: 'Information we collect', body: ['We collect account details supplied through Firebase Authentication, including your email address and display name. We also process the lyrics, prompts, song settings, generated songs, and feedback you submit while using Desi Dhun.'] },
      { heading: 'How we use information', body: ['We use this information to operate Desi Dhun, authenticate your account, generate requested content, enforce plan limits, provide support, prevent fraud, and improve service reliability.'] },
      { heading: 'Service providers', body: ['Desi Dhun uses Google Cloud and Firebase to host the service and store account/content data. Payments are processed by PayU for Indian billing and Stripe for eligible billing outside India. We do not receive or store full card, bank, or UPI credentials.'] },
      { heading: 'Retention and contact', body: [`We retain information for as long as needed to operate your account, meet legal obligations, and resolve disputes. For privacy requests, contact ${SUPPORT_EMAIL}.`] },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { heading: 'Service', body: ['Desi Dhun is operated by YSCHOLAR TECHNOLOGY LLP. It provides AI-assisted lyric, music-prompt, and song-generation tools. You are responsible for ensuring that your inputs and use of generated outputs comply with applicable law and third-party rights.'] },
      { heading: 'Accounts and acceptable use', body: ['Keep your account credentials secure. Do not use the service to infringe intellectual-property rights, violate laws, generate unlawful content, bypass usage limits, or interfere with the service.'] },
      { heading: 'Plans and payments', body: ['Memberships and credit packs provide the allowances described at purchase. Credit packs do not expire. Membership access and allowances are subject to the applicable billing period and payment status.'] },
      { heading: 'Changes and contact', body: [`We may update the service or these terms when reasonably necessary. Questions may be sent to ${SUPPORT_EMAIL}.`] },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    sections: [
      { heading: 'Membership cancellation', body: ['You may cancel an active membership before its current paid period expires. Cancellation stops the next renewal; your membership access remains active until the end of the already-paid period.'] },
      { heading: 'How to cancel', body: [`Stripe memberships can be cancelled from the account menu. For PayU memberships, contact ${SUPPORT_EMAIL} for assistance with mandate management.`] },
      { heading: 'Credit packs', body: ['Credit packs are one-time purchases and do not renew automatically.'] },
    ],
  },
  refunds: {
    title: 'Refund Policy',
    sections: [
      { heading: 'All payments are final', body: ['Payments for memberships and one-time credit packs are final. We do not provide refunds after purchase or after access/credits are granted.'] },
      { heading: 'Billing assistance', body: [`If you believe a payment was unauthorized, duplicated, or made in error, contact ${SUPPORT_EMAIL} promptly with the transaction reference so we can investigate.`] },
    ],
  },
};

export function legalPageForPath(pathname: string): LegalPageId | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/cancellation') return 'cancellation';
  if (path === '/refunds') return 'refunds';
  return undefined;
}

export function LegalPage({ page }: { page: LegalPageId }) {
  const content = CONTENT[page];
  return (
    <main className="legal-page">
      <p className="workflow-step">{COMPANY}</p>
      <h1>{content.title}</h1>
      <p className="legal-updated">Last updated: September 15, 2026</p>
      {content.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      <p className="legal-contact">Contact: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </main>
  );
}
