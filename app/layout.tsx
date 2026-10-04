import type {Metadata} from 'next'
import Link from 'next/link'
import {Dart} from './components/Dart'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import {projectId, publicDatasetUrl} from '@/lib/sanity'
import './globals.css'


export const metadata: Metadata = {
  title: 'Pinned',
  description:
    'Paste your Sanity client config. Pinned shows what it does at the apiVersion you pinned, what changes if you bump it, and cites Sanity’s docs for every claim.',
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-mist bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-1 px-4 md:px-6">
        <Link href="/" className="mr-4 flex items-center gap-2 text-[15px] font-semibold text-graphite">
          <Dart size={28} />
          Pinned
        </Link>
        <Link href="/analyze" className="rounded-md px-2.5 py-1.5 text-[14px] font-medium text-charcoal hover:bg-linen">
          Analyze
        </Link>
        <Link href="/rules" className="rounded-md px-2.5 py-1.5 text-[14px] font-medium text-charcoal hover:bg-linen">
          Rules
        </Link>
        <Link href="/#how" className="hidden rounded-md px-2.5 py-1.5 text-[14px] font-medium text-charcoal hover:bg-linen sm:block">
          How it works
        </Link>
        <Link
          href="/analyze"
          className="ml-auto rounded-full bg-graphite px-4 py-1.5 text-[14px] font-medium text-white transition-colors hover:bg-brand"
        >
          <span className="sm:hidden">Demo</span>
          <span className="hidden sm:inline">Run the demo</span>
        </Link>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-mist bg-linen">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        <p className="font-serif max-w-3xl text-[28px] leading-[1.2] text-graphite md:text-[40px] md:leading-[1.1]">
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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
