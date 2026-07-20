import type { Metadata } from "next";
import { DemoPresentation } from "@/components/presentation/demo-presentation";

export const metadata: Metadata = { title: "Demo presentation" };

export default async function PresentationPage({
  searchParams,
}: {
  searchParams: Promise<{ scene?: string; phase?: string; recording?: string }>;
}) {
  const params = await searchParams;
  const scene = /^0[1-8]$/.test(params.scene ?? "") ? params.scene! : "01";

  return (
    <DemoPresentation
      scene={scene}
      phase={params.phase === "ending" ? "ending" : "evidence"}
      recording={params.recording === "true"}
    />
  );
}
