import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Custard Hotels" },
      {
        name: "description",
        content: "Sign in or create an account for your hotel on Custard Hotels.",
      },
      { property: "og:title", content: "Sign in — Custard Hotels" },
      {
        property: "og:description",
        content: "Sign in or create an account for your hotel on Custard Hotels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type SearchParams = { redirect?: string };

const KINETIC_INPUT =
  "h-11 rounded-none border-[3px] border-ink bg-background px-3 shadow-none transition-shadow focus-visible:ring-0 focus-visible:shadow-hard";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ strict: false }) as SearchParams;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const afterAuth = () => {
    const target =
      redirect && redirect.startsWith(window.location.origin)
        ? redirect.replace(window.location.origin, "")
        : "/dashboard";
    window.location.href = target;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setConfirmSent(true);
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        afterAuth();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sand px-5 py-12">
      {/* Decorative kinetic blocks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-16 hidden size-40 -rotate-6 border-[3px] border-ink bg-amber shadow-hard lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-20 hidden size-52 rotate-6 border-[3px] border-ink bg-teal shadow-hard lg:block"
      />

      <div className="relative w-full max-w-md animate-rise ink shadow-hard-lg bg-card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <Link to="/" className="font-display text-2xl font-extrabold italic tracking-tighter">
            CUSTARD<span className="text-primary">.</span>
          </Link>
          <span className="ink -rotate-1 bg-amber px-3 py-1 kinetic-label text-[10px] text-amber-foreground sm:text-xs">
            {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </span>
        </div>

        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.85] tracking-tighter sm:text-4xl">
            {mode === "signin" ? (
              <>
                <span className="animate-swipe block">Welcome</span>
                <span className="animate-swipe block text-primary underline decoration-[6px] underline-offset-[6px] [animation-delay:120ms]">
                  Back.
                </span>
              </>
            ) : (
              <>
                <span className="animate-swipe block">Join the</span>
                <span className="animate-swipe block text-primary underline decoration-[6px] underline-offset-[6px] [animation-delay:120ms]">
                  house.
                </span>
              </>
            )}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            {mode === "signin"
              ? "Sign in to manage your hotel, run reception, or book your next stay."
              : "Create your account to register a hotel or book stays across Ghana."}
          </p>
        </div>

        {confirmSent ? (
          <div className="animate-rise mt-8 border-[3px] border-success bg-success/10 p-4 text-center">
            <p className="kinetic-label text-xs text-success">CHECK YOUR INBOX</p>
            <p className="mt-1 text-sm text-foreground">
              A confirmation email is on its way. Verify before signing in.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
              {/* Kinetic segmented control */}
              <div className="grid grid-cols-2 border-[3px] border-ink bg-card shadow-hard">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={cn(
                    "kinetic-label py-3 text-xs uppercase tracking-widest transition-colors",
                    mode === "signin"
                      ? "bg-ink text-background"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={cn(
                    "kinetic-label border-l-[3px] border-ink py-3 text-xs uppercase tracking-widest transition-colors",
                    mode === "signup"
                      ? "bg-ink text-background"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  Create account
                </button>
              </div>

              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="kinetic-label text-xs uppercase tracking-widest"
                    >
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={KINETIC_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="kinetic-label text-xs uppercase tracking-widest"
                    >
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={KINETIC_INPUT}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="kinetic-press h-12 w-full rounded-none border-[3px] border-ink bg-ink font-display text-sm font-extrabold uppercase tracking-wider text-background hover:bg-ink/85"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="fullName"
                      className="kinetic-label text-xs uppercase tracking-widest"
                    >
                      Full name
                    </Label>
                    <Input
                      id="fullName"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={KINETIC_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-email"
                      className="kinetic-label text-xs uppercase tracking-widest"
                    >
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={KINETIC_INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="signup-password"
                      className="kinetic-label text-xs uppercase tracking-widest"
                    >
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={KINETIC_INPUT}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="kinetic-press h-12 w-full rounded-none border-[3px] border-ink bg-ink font-display text-sm font-extrabold uppercase tracking-wider text-background hover:bg-ink/85"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-6 flex items-center gap-3">
              <span className="h-[3px] flex-1 bg-ink" />
              <span className="kinetic-label text-[10px] text-muted-foreground">OR</span>
              <span className="h-[3px] flex-1 bg-ink" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="kinetic-press h-12 w-full rounded-none border-[3px] border-ink bg-card font-display text-sm font-extrabold uppercase tracking-wider shadow-hard hover:bg-amber hover:text-amber-foreground"
              onClick={handleGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Want to list your property?{" "}
          <Link
            to="/register"
            className="font-display font-extrabold text-primary underline decoration-[3px] underline-offset-4 transition-colors hover:text-ink"
          >
            Register your hotel
          </Link>
        </p>
      </div>
    </div>
  );
}
