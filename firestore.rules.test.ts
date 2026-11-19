/**
 * Phase 0 Security Test Specification for Grade 9 Hub Firestore Rules.
 * Documents and validates the "Dirty Dozen" adversarial payload invariants
 * synchronized with firebase-blueprint.json and firestore.rules.
 */

export interface DirtyDozenCase {
  id: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  attackVector: string;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOAD_TESTS: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    collection: '/users/{userId}',
    operation: 'create',
    attackVector: 'Shadow field injection (extra unknown key superPower: true)',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    collection: '/users/{userId}',
    operation: 'create',
    attackVector: 'Non-admin self-assigning role: "teacher" or isAdmin: true',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    collection: '/users/{userId}',
    operation: 'update',
    attackVector: 'Student modifying immutable uid, email, role, isAdmin, or createdAt',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    collection: '/users/{userId}',
    operation: 'get',
    attackVector: 'Student reading another user private profile document',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    collection: '/users',
    operation: 'list',
    attackVector: 'Non-admin listing /users collection to scrape PII emails',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    collection: '/admins/{userId}',
    operation: 'create',
    attackVector: 'Non-admin user writing their UID to /admins',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    collection: '/school_accounts/{accountKey}',
    operation: 'get',
    attackVector: 'Student reading /school_accounts password hashes or emails',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    collection: '/school_accounts/{accountKey}',
    operation: 'list',
    attackVector: 'Spoofed email without email_verified == true attempting admin query',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    collection: '/users/{userId}',
    operation: 'create',
    attackVector: 'Path poisoning with invalid characters or >128 char document ID',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    collection: '/users/{userId}/quiz_attempts/{attemptId}',
    operation: 'create',
    attackVector: 'Client forging createdAt != request.time or writing under another UID',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    collection: '/leaderboard_entries/{userId}',
    operation: 'create',
    attackVector: 'Injecting PII email field or role != "student" into leaderboard',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    collection: '/leaderboard_entries',
    operation: 'list',
    attackVector: 'Listing leaderboard_entries without enforcing resource.data.role == "student"',
    expectedOutcome: 'PERMISSION_DENIED',
  },
];

export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function verifyBlueprintRegexAlignment(id: string): boolean {
  return VALID_ID_REGEX.test(id);
}
