import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { KenteStrip } from "@/components/game/KenteStrip";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-6xl" aria-hidden="true">
        🧭
      </div>
      <h1 className="mt-4 text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        This ward doesn't exist. Let's get you back to the clinic.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="min-h-dvh">
      <KenteStrip />
      {notFound ? (
        <NotFound />
      ) : (
        <div className="mx-auto max-w-md px-4 py-16 text-center" role="alert">
          <h1 className="text-3xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">
            Please reload the page. If it keeps happening, let us know.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )}
    </div>
  );
}
