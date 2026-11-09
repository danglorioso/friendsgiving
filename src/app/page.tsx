import { connection } from "next/server";
import { BoardView } from "@/components/BoardView";
import { board } from "@/lib/server";
import { getStore } from "@/lib/store";

export default async function Home() {
  // Always render with the live board, never a build-time snapshot.
  await connection();
  // Read on the server from PARTIFUL_URL, so it stays out of the repo and the JS bundle.
  return <BoardView initial={await board(getStore())} partifulUrl={process.env.PARTIFUL_URL ?? ""} />;
}
