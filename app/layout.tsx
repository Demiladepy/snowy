import type {Metadata} from 'next'
import Link from 'next/link'
import {Fraunces, Inter, JetBrains_Mono} from 'next/font/google'
import {projectId, publicDatasetUrl} from '@/lib/sanity'
import './globals.css'

const display = Fraunces({variable: '--font-display', subsets: ['latin'], axes: ['opsz']})
const ui = Inter({variable: '--font-ui', subsets: ['latin']})
const code = JetBrains_Mono({variable: '--font-code', subsets: ['latin']})

export const metadata: Metadata = {
  title: 'Pinned',
  description:
    'Paste your Sanity client config. Pinned shows what it does at the apiVersion you pinned, what changes if you bump it, and cites Sanity’s docs for every claim.',
}

function Nav() {
  return (
    <nav className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-0.5 rounded-[50px] border border-twilight/15 bg-white/70 py-1.5 pl-4 pr-1.5 shadow-[var(--shadow-nav)] backdrop-blur-xl">
        <Link href="/" className="mr-2 flex items-center gap-2 text-[15px] font-medium text-graphite">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-twilight">
            <circle cx="12" cy="9" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 13v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Pinned
        </Link>
        <Link href="/analyze" className="hidden rounded-[50px] px-3 py-1.5 text-[15px] font-medium text-charcoal hover:text-graphite sm:block">
          Analyze
        </Link>
        <Link href="/rules" className="rounded-[50px] px-3 py-1.5 text-[15px] font-medium text-charcoal hover:text-graphite">
          Rules
        </Link>
        <Link href="/#how" className="hidden rounded-[50px] px-3 py-1.5 text-[15px] font-medium text-charcoal hover:text-graphite sm:block">
          How it works
        </Link>
        <Link
          href="/analyze"
          className="ml-1 rounded-lg border border-signal px-3 py-1.5 text-[15px] font-medium text-signal transition-colors hover:bg-signal/5"
        >
          <span className="sm:hidden">Demo</span>
          <span className="hidden sm:inline">Run the demo</span>
        </Link>
      </div>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-mist bg-paper">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        <p className="font-serif max-w-3xl text-[27px] leading-[1.3] tracking-[-0.04em] text-graphite md:text-[40px] md:leading-[1.1] md:tracking-[-0.02em]">
          Some contradictions in the docs are just versions. Pinned keeps them apart.
        </p>
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ash">
          <span>
            Sanity project <code className="text-charcoal">{projectId}</code>
          </span>
          <a className="hover:text-graphite" href={publicDatasetUrl} target="_blank" rel="noreferrer">
            Public rules dataset ↗
          </a>
          <Link className="hover:text-graphite" href="/rules">
            Rule catalogue
          </Link>
          <span>Built on Sanity Context</span>
        </div>
      </div>
    </footer>
  )
}

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${code.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
