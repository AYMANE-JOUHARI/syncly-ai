import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { CourseProvider } from "@/lib/course-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-slate-900">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Syncly.ai — Turn your docs into a course in 60 seconds" },
      { name: "description", content: "AI-powered employee onboarding. Generate structured learning courses with quizzes and an AI tutor from any role description or PDF." },
      { property: "og:title", content: "Syncly.ai — Turn your docs into a course in 60 seconds" },
      { property: "og:description", content: "AI-powered employee onboarding. Generate structured learning courses with quizzes and an AI tutor from any role description or PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Syncly.ai — Turn your docs into a course in 60 seconds" },
      { name: "twitter:description", content: "AI-powered employee onboarding. Generate structured learning courses with quizzes and an AI tutor from any role description or PDF." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/40249bc8-125f-4620-9bce-8e110b7d9bde/id-preview-e94f63b7--2ed71b3a-bc44-49cc-8ef4-a0defe217ec4.lovable.app-1776547873496.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/40249bc8-125f-4620-9bce-8e110b7d9bde/id-preview-e94f63b7--2ed71b3a-bc44-49cc-8ef4-a0defe217ec4.lovable.app-1776547873496.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <CourseProvider>
      <Outlet />
    </CourseProvider>
  );
}
