import React from "react";

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-[var(--error-soft)] bg-[var(--error-surface)] px-4 py-3 text-sm text-[var(--error)] mb-[1.5rem] text-center">
      {message}
    </p>
  );
}

export default ErrorMessage;
