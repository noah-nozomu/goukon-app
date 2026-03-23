import { Timestamp } from "firebase/firestore";

export interface Participant {
  uid: string;
  nickname: string;
  photoURL: string;
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
