// AdSense asks every site to publish /ads.txt naming its publisher account.

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // ca-pub-1234567890
  if (!client) return new Response("Not found", { status: 404 });
  const publisher = client.replace(/^ca-/, "");
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain" },
  });
}
