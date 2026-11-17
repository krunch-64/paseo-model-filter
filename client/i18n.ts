import { defineTranslations } from "@getpaseo/plugin/client";
import { en, fr } from "./strings";

/** Follows the app language; anything other than French falls back to English. */
export const messages = defineTranslations({ resources: { en, fr } });
