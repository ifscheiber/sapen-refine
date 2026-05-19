"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      disabled={loading}
      onClick={async () => {
        try {
          setLoading(true);

          const res = await fetch("/api/auth/logout", { method: "POST" });
          // Optional: handle failures explicitly
          if (!res.ok) throw new Error("Logout failed");

          router.replace("/login");
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Signing out..." : "Log out"}
    </Button>
  );
}
