import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/logout-button";
import { getSession } from "@/lib/session";

export default async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SynthNews
        </Link>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Feed
          </Link>
          <Link href="/stories" className="hover:text-foreground">
            Stories
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>
          {session ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/review">Review</Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
