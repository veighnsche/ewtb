import { getYear } from 'date-fns'
import { Separator } from '#/components/ui/separator'

export default function Footer() {
  const year = getYear(new Date())

  return (
    <footer className="px-4 pb-10 pt-8 text-sm text-muted-foreground">
      <div className="page-wrap space-y-4">
        <Separator />
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <p className="m-0">&copy; {year} EWTB.</p>
          <p className="m-0">Lokaal telemetriebord gebouwd op TanStack Start en shadcn/ui.</p>
        </div>
      </div>
    </footer>
  )
}
