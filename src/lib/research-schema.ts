import { z } from "zod";
import { modelSchema } from "./finance";
export const tickerSchema = z.string().regex(/^[A-Z0-9][A-Z0-9.\-]{0,11}$/);
export const researchWriteSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("watch"), ticker: tickerSchema }).strict(),
  z
    .object({
      operation: z.literal("note"),
      ticker: tickerSchema,
      note: z.string().max(6000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("valuation"),
      ticker: tickerSchema,
      assumptions: modelSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("import"),
      ticker: tickerSchema,
      note: z.string().max(6000),
      assumptions: modelSchema.optional(),
    })
    .strict(),
]);
export type CloudResearch = {
  id: string;
  ticker: string;
  note: string;
  assumptions: z.infer<typeof modelSchema> | null;
  is_watchlisted: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
};
