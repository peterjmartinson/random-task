export interface ExtractedContacts {
  phone?: string;
  email?: string;
}

export function parseContacts(text?: string): ExtractedContacts {
  if (!text) return {};

  // Standard regex for US / international phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  // Standard regex for email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

  const phoneMatch = text.match(phoneRegex);
  const emailMatch = text.match(emailRegex);

  return {
    phone: phoneMatch ? phoneMatch[0] : undefined,
    email: emailMatch ? emailMatch[0] : undefined,
  };
}
