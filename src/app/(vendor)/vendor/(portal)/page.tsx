import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Pill,
} from '@/components/ui';

export default function VendorHomePage(): React.JSX.Element {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <PageHeader title="Supplier dashboard" />
        <Pill variant="success" dot>
          Slice 0 shell
        </Pill>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted">
          Your supplier workspace is ready. Invoice submission, PO tracking, and document
          management arrive in later slices.
        </CardContent>
      </Card>
    </div>
  );
}
