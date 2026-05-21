import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

function showDemoCredentials() {
  if (process.env.NODE_ENV === "development") return true;
  return ["1", "true", "yes", "y"].includes(
    (process.env.SHOW_DEMO_CREDENTIALS ?? "").trim().toLowerCase(),
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm showDemoCredentials={showDemoCredentials()} />
    </Suspense>
  );
}
