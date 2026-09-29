import { getSession } from "@/lib/session";
import LogoutButton from "./logout-button";

export default async function Home() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">SynthNews Review</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session?.name} ({session?.email})
          </p>
        </div>
        <LogoutButton />
      </header>
      <p className="text-sm text-muted-foreground">
        Your review lists will appear here.
      </p>
    </main>
  );
}
