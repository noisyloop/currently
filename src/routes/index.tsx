import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/current/desk";

export const Route = createFileRoute("/")({ component: Desk });
