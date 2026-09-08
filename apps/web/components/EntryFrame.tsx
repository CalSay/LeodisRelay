import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function EntryFrame({children, signedIn=false}: {children:React.ReactNode;signedIn?:boolean}) {
  return <main className="entry-wrap"><section className="entry-screen">
    <header className="entry-top"><Link href="/" className="entry-brand" aria-label="RELAY company hub">RELAY<small>BY LEODIS</small></Link>
      <nav className="entry-nav" aria-label="Account and appearance"><ThemeToggle />
        {signedIn && <form action="/api/auth/signout" method="POST"><button type="submit">Sign out</button></form>}
      </nav>
    </header>{children}
    <footer className="entry-footer"><span>Leodis Developments Ltd</span><span>Leodis Compliance Management Ltd</span></footer>
  </section></main>;
}
export function EntryArrow() {return <span className="entry-arrow" aria-hidden="true">↗</span>;}
