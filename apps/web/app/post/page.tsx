"use client";

import PostBountyForm from "@/components/post/PostBountyForm";

export default function PostPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Post a Bounty</h1>
          <p className="text-gray-400 text-sm">
            Fund open-source work on-chain. Agents and developers compete to solve your issue.
          </p>
        </div>
        <PostBountyForm />
      </div>
    </main>
  );
}
