"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, LogOut, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle, GlassCard } from "@/components/ui/card";
import { cwKeys } from "@/lib/coworking";

import { ActivityFeed } from "./activity-feed";
import { useCoworking } from "./provider";
import { EmptyState, Input, PriorityDot, Spinner } from "./ui";

export function Dashboard() {
  const { client, apiKey, disconnect } = useCoworking();
  const qc = useQueryClient();
  const enabled = Boolean(apiKey);

  const workspace = useQuery({ queryKey: cwKeys.workspace, queryFn: () => client.getWorkspace(), enabled });
  const projects = useQuery({ queryKey: cwKeys.projects, queryFn: () => client.listProjects(), enabled });
  const myTasks = useQuery({
    queryKey: cwKeys.myTasks,
    queryFn: () => client.myOpenTasks(),
    enabled,
    refetchInterval: 8000,
  });

  const [projName, setProjName] = React.useState("");
  const [projKey, setProjKey] = React.useState("");
  const createProject = useMutation({
    mutationFn: () => client.createProject({ key: projKey.trim().toUpperCase(), name: projName.trim() }),
    onSuccess: () => {
      setProjName("");
      setProjKey("");
      qc.invalidateQueries({ queryKey: cwKeys.projects });
      qc.invalidateQueries({ queryKey: cwKeys.activity() });
    },
  });

  const projectItems = projects.data?.items ?? [];
  const myTaskItems = myTasks.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Connected to <span className="font-medium text-foreground">{workspace.data?.name ?? "…"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          <LogOut className="h-4 w-4" /> Disconnect
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <GlassCard>
            <CardTitle>New project</CardTitle>
            <CardDescription>Each project gets a default board: backlog → in progress → done.</CardDescription>
            <form
              className="mt-4 flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (projName.trim() && projKey.trim()) createProject.mutate();
              }}
            >
              <Input
                className="min-w-40 flex-1"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                placeholder="Project name"
                maxLength={160}
              />
              <Input
                className="w-28"
                value={projKey}
                onChange={(e) => setProjKey(e.target.value)}
                placeholder="KEY"
                maxLength={20}
              />
              <Button type="submit" disabled={!projName.trim() || !projKey.trim() || createProject.isPending}>
                {createProject.isPending ? <Spinner /> : <Plus className="h-4 w-4" />} Create
              </Button>
            </form>
            {createProject.isError ? (
              <p className="mt-2 text-sm text-destructive">
                {createProject.error instanceof Error ? createProject.error.message : "Could not create project."}
              </p>
            ) : null}
          </GlassCard>

          <div>
            <h2 className="mb-3 font-display text-scale-4 font-semibold">Projects</h2>
            {projects.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5" />
              </div>
            ) : projectItems.length === 0 ? (
              <EmptyState title="No projects yet" hint="Create your first project above." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {projectItems.map((p) => (
                  <Link key={p.id} href={`/coworking/p/${p.id}`} className="group">
                    <Card className="glow-card h-full p-5 transition">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-primary" />
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{p.key}</span>
                      </div>
                      <p className="mt-2 font-medium group-hover:text-primary">{p.name}</p>
                      {p.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      ) : null}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <GlassCard className="p-5 sm:p-6">
            <CardTitle>My open tasks</CardTitle>
            <div className="mt-3">
              {myTasks.isLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              ) : myTaskItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing assigned to you yet.</p>
              ) : (
                <ul className="space-y-2">
                  {myTaskItems.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <PriorityDot priority={t.priority} />
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6">
            <CardTitle>Activity</CardTitle>
            <div className="mt-3">
              <ActivityFeed />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
