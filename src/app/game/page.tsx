import { Suspense } from "react";
import GameClient from "@/components/GameClient";

export default function GamePage() {
  return (
    <Suspense fallback={<div className="panel animate-pulse">로딩 중...</div>}>
      <GameClient />
    </Suspense>
  );
}
