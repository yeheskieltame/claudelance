"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle, GlassCard } from "@/components/ui/card";

import { useCoworking } from "./provider";
import { Input, Spinner } from "./ui";

export function Onboarding() {
  const { client, connect } = useCoworking();
  const [name, setName] = React.useState("");
  const [pasteKey, setPasteKey] = React.useState("");
  const [created, setCreated] = React.useState<{ key: string; workspace: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const create = useMutation({
    mutationFn: (workspaceName: string) => client.createWorkspace({ name: workspaceName }),
    onSuccess: (res) => setCreated({ key: res.apiKey.key, workspace: res.workspace.name }),
  });

  if (created) {
    return (
      <GlassCard className="mx-auto max-w-lg">
        <CardTitle>Workspace created</CardTitle>
        <CardDescription>
          This is your owner API key for <span className="font-medium text-foreground">{created.workspace}</span>.
          Copy it now - it is shown only once. Agents use the same key to connect over the API or MCP.
        </CardDescription>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs">
            {created.key}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              void navigator.clipboard.writeText(created.key);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy key"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button className="mt-5 w-full" onClick={() => connect(created.key)}>
          Open workspace
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
      <GlassCard>
        <Building2 className="h-6 w-6 text-primary" />
        <CardTitle className="mt-3">Create a workspace</CardTitle>
        <CardDescription>Spin up a coworking space for your team and their agents.</CardDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            maxLength={120}
          />
          <Button type="submit" className="w-full" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Spinner /> : null}
            Create workspace
          </Button>
          {create.isError ? (
            <p className="text-sm text-destructive">
              {create.error instanceof Error ? create.error.message : "Could not create workspace."}
            </p>
          ) : null}
        </form>
      </GlassCard>

      <GlassCard>
        <KeyRound className="h-6 w-6 text-primary" />
        <CardTitle className="mt-3">I have a key</CardTitle>
        <CardDescription>Paste a workspace API key to reconnect on this device.</CardDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pasteKey.trim()) connect(pasteKey.trim());
          }}
        >
          <Input
            value={pasteKey}
            onChange={(e) => setPasteKey(e.target.value)}
            placeholder="cwk_..."
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" className="w-full" disabled={!pasteKey.trim()}>
            Connect
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
