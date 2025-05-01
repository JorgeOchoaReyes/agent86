import type { UserRecord } from "firebase-admin/auth";

export interface User extends UserRecord {
    squareAppId?: string
    squareAppSecret?: string
    subscriptionId?: string
    status?: string
    priceId?: string
    clientReferenceId?: string
}