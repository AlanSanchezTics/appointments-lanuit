import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}
