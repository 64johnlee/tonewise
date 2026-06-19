import "./globals.css";
export const metadata = {
  title: "ToneWise — AI Mandarin Practice",
  description: "Practice Mandarin conversations with real-time tone grading. Powered by AWS DynamoDB + Vercel.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
