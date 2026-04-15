import { auth } from '../firebase';
import { toast } from 'sonner';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let message = error instanceof Error ? error.message : String(error);
  let isQuotaError = false;
  
  // Check for quota exceeded error
  if (message.includes('Quota limit exceeded') || message.includes('quota exceeded')) {
    isQuotaError = true;
    message = "Firestore Quota Exceeded: The free tier limit for database reads has been reached for today. It will reset tomorrow.";
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));

  if (isQuotaError) {
    toast.error("Quota Limit Reached", {
      description: "The daily free limit for database reads has been exceeded. Some data may not be visible until tomorrow.",
      duration: 10000,
    });
    // We still throw to stop the execution flow, but the ErrorBoundary will handle the UI
    throw new Error(JSON.stringify(errInfo));
  } else {
    throw new Error(JSON.stringify(errInfo));
  }
}
