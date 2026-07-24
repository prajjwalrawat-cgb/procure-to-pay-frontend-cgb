import { Card, CardContent, CardHeader, CardTitle, Pill } from '@/components/ui';

/** Slice 0 home — the only live buyer screen. Everything else is a stub. */
export default function HomePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Welcome to ProcureFlow
        </h1>
        <p className="text-muted mt-1 text-[13px]">
          Foundation shell (Slice 0). Business modules arrive in later slices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
          </CardHeader>
          <CardContent className="text-muted text-[13px]">
            Use the sidebar to explore where each module will live. Press{' '}
            <kbd className="font-numeric text-text text-[11px]">⌘K</kbd> to open the
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
          <CardContent className="text-muted text-[13px]">
            Auth, tenancy, RLS, seed data, and the design system are in place. Invoices
            land in Slice 1.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
