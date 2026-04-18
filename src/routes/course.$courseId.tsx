import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/course/$courseId")({
  component: () => <Outlet />,
});
