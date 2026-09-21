import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Pill,
} from '@/components/ui';

/** Slice 0 home — the only live buyer screen. Everything else is a stub. */
export default function HomePage(): React.JSX.Element {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <PageHeader
          title="Welcome to ProcureFlow"
          description="Foundation shell (Slice 0). Business modules arrive in later slices."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-muted">
            Use the section tabs above to explore where each module will live. Press{' '}
            <kbd className="font-numeric text-micro text-text">⌘K</kbd> to open the
            command palette.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Slice status
              <Pill variant="success" dot>
                Slice 0 live
              </Pill>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-muted">
            Auth, tenancy, RLS, seed data, and the design system are in place. Invoices
            land in Slice 1.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
