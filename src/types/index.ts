import { is } from "./../../node_modules/unist-util-is/lib/index.d";
import type { UserRecord } from "firebase-admin/auth";

export interface User extends UserRecord {
    squareAppId?: string
    squareAppSecret?: string
    subscriptionId?: string
    status?: string
    priceId?: string
    clientReferenceId?: string
}

export interface Chat {
    id: string; 
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

export interface Message {
    id: string;
    content: string;
    role: "user" | "assistant";
    isNew?: boolean;
}