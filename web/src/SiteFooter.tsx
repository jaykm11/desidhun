export function SiteFooter() {
  return (
    <footer className="footer site-footer">
      <p className="footer-legal">
        © {new Date().getFullYear()} YSCHOLAR TECHNOLOGY LLP
        {' · '}
        <a href="/about">About</a>
        {' · '}
        <a href="/privacy">Privacy</a>
        {' · '}
        <a href="/terms">Terms</a>
        {' · '}
        <a href="/cancellation">Cancellation</a>
        {' · '}
        <a href="/refunds">Refunds</a>
        {' · '}
        <a href="mailto:contact.yscholar@gmail.com">Contact</a>
      </p>
    </footer>
  );
}
