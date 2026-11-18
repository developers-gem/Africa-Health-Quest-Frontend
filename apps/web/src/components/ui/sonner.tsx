import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border-2 border-foreground bg-card text-foreground shadow-pop-sm font-sans",
          description: "text-muted-foreground",
          error: "border-destructive",
          success: "border-success",
        },
      }}
    />
  );
}
