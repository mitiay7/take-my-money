import type { Metadata } from "next";
import { RebaseDemo } from "@/components/demo/rebase-demo";

export const metadata: Metadata = { title: "Migration demo" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  return <RebaseDemo />;
}
