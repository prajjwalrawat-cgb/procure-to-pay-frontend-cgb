import { Card, CardContent, CardHeader, CardTitle, Pill } from '@procureflow/ui';

export default function VendorHomePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Supplier dashboard
        </h1>
        <Pill variant="success" dot>
          Slice 0 shell
        </Pill>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent className="text-muted text-[13px]">
          Your supplier workspace is ready. Invoice submission, PO tracking, and document
          management arrive in later slices.
        </CardContent>
      </Card>
    </div>
  );
}
