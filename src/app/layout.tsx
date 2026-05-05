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
      <body>{children}</body>
    </html>
  );
}
