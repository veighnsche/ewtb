import { createFileRoute } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">About EWTB</CardTitle>
          <CardDescription>
            The improvised wall presentation layer has been removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="m-0 max-w-3xl text-sm leading-7 text-muted-foreground">
            This project now has a neutral baseline again: TanStack Start for routing and app
            structure, `shadcn/ui` for primitives, and mock telemetry data for the content
            model. The next design pass should start from information architecture and
            interaction needs, not from decorative card composition.
          </p>
          <Separator />
          <p className="m-0 max-w-3xl text-sm leading-7 text-muted-foreground">
            The home route is currently a system-driven dashboard scaffold intended to be
            redesigned deliberately. It is no longer using the previous atoms, molecules,
            organisms, or template layer.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
