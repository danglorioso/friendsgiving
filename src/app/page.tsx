import { connection } from "next/server";
import { BoardView } from "@/components/BoardView";
import { board } from "@/lib/server";
import { getStore } from "@/lib/store";

export default async function Home() {
  // Always render with the live board, never a build-time snapshot.
  await connection();
  return <BoardView initial={await board(getStore())} />;
}
