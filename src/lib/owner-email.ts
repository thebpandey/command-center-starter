export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(candidate: string, ownerEmail: string): boolean {
  const owner = normalizeEmail(ownerEmail);
  return owner.length > 0 && normalizeEmail(candidate) === owner;
}
