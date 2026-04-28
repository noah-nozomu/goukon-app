import { Timestamp } from "firebase/firestore";

export interface Participant {
  uid: string;
  nickname: string;
  photoURL: string;
  /** Cloudinary の public_id（例: goukon/uid_1234567890）。リセット時に削除に使用 */
  photoPublicId?: string;
  bio?: string;
  createdAt: Timestamp;
}

export interface Like {
  from: string;
  to: string;
  createdAt: Timestamp;
}

export interface Vote {
  from: string;
  to: string;
  createdAt: Timestamp;
}

export interface Match {
  id: string;
  users: string[];
  createdAt: Timestamp;
  lastMessage?: string;
  unreadCount?: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}
