export function normalizePhoneNumber(phone: string | null | undefined, countryContext?: string | null): string | null {
    if (!phone) return null;

    const trimmed = phone.trim();
    if (!trimmed) return null;

    // Has explicit '+' prefix
    if (trimmed.startsWith("+")) {
        const digits = trimmed.replace(/\D/g, "");
        return digits.length > 5 ? digits : null;
    }

    // Starts with international dialing prefix '00'
    if (trimmed.startsWith("00")) {
        const digits = trimmed.slice(2).replace(/\D/g, "");
        return digits.length > 5 ? digits : null;
    }

    // No explicit international prefix.
    const digits = trimmed.replace(/\D/g, "");
    
    // Check if context implies India
    const cleanedContext = countryContext ? countryContext.trim().toLowerCase() : "";
    const cleanedContextDigits = countryContext ? countryContext.replace(/\D/g, "") : "";
    const isIndiaContext =
        cleanedContext === "india" || 
        cleanedContext === "in" || 
        cleanedContext === "ind" ||
        cleanedContextDigits === "91";

    if (isIndiaContext && digits.length === 10) {
        return `91${digits}`;
    }

    // If it's 10 digits but no country context (or not India), we cannot safely prepend.
    // However, Meta requires the country code. If we just send it, Meta will reject it.
    // If it's already 12 digits (like 919876543210), it might be valid.
    return digits.length > 5 ? digits : null;
}
