import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expenses",
  description: "AI Expense Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-zen-base via-zen-peach to-zen-lavender min-h-screen text-zen-charcoal antialiased">{children}</body>
    </html>
  );
}
