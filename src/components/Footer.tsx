import { Separator } from '#/components/ui/separator'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="px-4 pb-10 pt-8 text-sm text-muted-foreground">
      <div className="page-wrap space-y-4">
        <Separator />
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <p className="m-0">&copy; {year} EWTB.</p>
          <p className="m-0">Local telemetry board built on TanStack Start and shadcn/ui.</p>
        </div>
      </div>
    </footer>
  )
}
