import { Link } from '@tanstack/react-router'
import { BookOpen, Github, LayoutGrid } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export default function Header() {
  return (
    <header className="border-b bg-background/95 px-4 backdrop-blur">
      <nav className="page-wrap flex flex-wrap items-center gap-3 py-4">
        <Link
          to="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2 px-0')}
        >
          <LayoutGrid />
          EWTB
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            activeProps={{ className: cn(buttonVariants({ variant: 'secondary', size: 'sm' })) }}
          >
            Home
          </Link>
          <Link
            to="/about"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            activeProps={{ className: cn(buttonVariants({ variant: 'secondary', size: 'sm' })) }}
          >
            About
          </Link>
          <a
            href="https://tanstack.com/start/latest/docs/framework/react/overview"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <BookOpen />
            Docs
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/Veighnsche"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          >
            <Github />
            <span className="sr-only">Open Veighnsche on GitHub</span>
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
