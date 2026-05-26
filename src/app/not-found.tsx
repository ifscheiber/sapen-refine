import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 text-center text-card-foreground">
        <div className="text-sm text-muted-foreground">SaPen Annotate</div>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested page does not exist or is no longer available.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/app/projects">Open projects</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
