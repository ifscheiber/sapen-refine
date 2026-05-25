"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
  label?: string;
  title?: string;
};

export function LogoutButton({
  className,
  children,
  iconOnly = false,
  label = "Log out",
  title,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const hasCustomContent = children !== undefined;

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      className={className}
      disabled={loading}
      aria-label={iconOnly ? label : undefined}
      aria-busy={loading || undefined}
      title={title ?? (iconOnly ? label : undefined)}
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
      {hasCustomContent ? (
        <>
          {children}
          <span className="sr-only">{loading ? "Signing out..." : label}</span>
        </>
      ) : loading ? (
        "Signing out..."
      ) : (
        label
      )}
    </Button>
  );
}
