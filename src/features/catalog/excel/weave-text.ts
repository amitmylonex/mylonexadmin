import { z } from "zod";

export const IMPORT_WEAVE_MAX_LENGTH = 200;

/** Preserve supplier wording; React escapes text when it is displayed. */
export const importWeaveTextSchema = z.string().trim()
    .min(1, "Weave is required. Enter the supplier's weave description.")
    .max(IMPORT_WEAVE_MAX_LENGTH, `Weave must be at most ${IMPORT_WEAVE_MAX_LENGTH} characters.`)
    .refine(value => !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
        "Weave must not contain control characters.");
