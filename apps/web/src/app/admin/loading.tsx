import { PageLoadingState } from "@/components/ui/page-state";

export default function AdminLoading() {
  return (
    <PageLoadingState
      title="Loading admin workspace"
      description="Fetching the latest dashboard and operational records."
    />
  );
}
