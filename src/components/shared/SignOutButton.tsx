import { LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
      navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={className}>
          <LogOut className="size-5" />
          Sign out
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="ink border-[3px] border-ink">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of Custard?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be returned to the home page and will need to sign in again to manage your hotel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay signed in</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy}>
            {busy ? "Signing out…" : "Sign out"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
