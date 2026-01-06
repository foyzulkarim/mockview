import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MockView - AI Interview Prep",
  description: "AI-powered interview preparation platform. Upload your CV and practice with adaptive mock interviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
