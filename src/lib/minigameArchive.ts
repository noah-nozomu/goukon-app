import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { rankTopThree } from "@/lib/minigame";
import type { MinigameCurrent, Participant } from "@/types";

/** 進行中または発表済みのテーマを、この回の結果一覧用に残す。同じテーマは一度だけ保存する。 */
export async function archiveMinigameRound(current: MinigameCurrent | null) {
  if (!current?.themeId || !current.themeText) return;
  if (current.status !== "voting" && current.status !== "result") return;

  const ref = doc(db, "minigame_results", current.themeId);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const [votesSnap, participantsSnap] = await Promise.all([
    getDocs(query(collection(db, "minigame_votes"), where("themeId", "==", current.themeId))),
    getDocs(collection(db, "participants")),
  ]);

  const participants = new Map<string, Participant>();
  participantsSnap.docs.forEach((item) => {
    const data = item.data() as Participant;
    participants.set(data.uid || item.id, data);
  });

  const counts = new Map<string, number>();
  votesSnap.docs.forEach((item) => {
    const targetId = item.data().targetId as string | undefined;
    if (!targetId) return;
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  });

  const ranking = rankTopThree(counts).map((entry) => {
    const participant = participants.get(entry.uid);
    return {
      uid: entry.uid,
      nickname: participant?.nickname || "退室した参加者",
      photoURL: participant?.photoURL || "",
      votes: entry.votes,
      rank: entry.rank,
    };
  });

  await setDoc(ref, {
    themeId: current.themeId,
    themeText: current.themeText,
    totalVotes: votesSnap.size,
    finishedAt: serverTimestamp(),
    ranking,
  });
}
