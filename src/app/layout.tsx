import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expenses",
  description: "AI Expense Tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") || undefined;

  return (
    <html lang="en" nonce={nonce}>
      <body className="bg-gradient-to-br from-zen-base via-zen-peach to-zen-lavender min-h-screen text-zen-charcoal antialiased" nonce={nonce}>{children}</body>
    </html>
  );
}
