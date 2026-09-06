import { BankTemplate, EmailPayload, ParsedTransaction } from "./templates/types";
import { hdfcTemplate } from "./templates/hdfc";
import { iciciTemplate } from "./templates/icici";
import { indusindTemplate } from "./templates/indusind";
import { axisTemplate } from "./templates/axis";

const templates: BankTemplate[] = [hdfcTemplate, iciciTemplate, indusindTemplate, axisTemplate];

export function tryParseWithRules(email: EmailPayload): ParsedTransaction | null {
  for (const template of templates) {
    if (!template.matches(email)) continue;
    const parsed = template.parse(email);
    if (parsed) return parsed;
  }
  return null;
}
