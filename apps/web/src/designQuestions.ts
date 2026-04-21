const DESIGN_QUESTIONS_OPEN_TAG = "<design_questions>";
const DESIGN_QUESTIONS_CLOSE_TAG = "</design_questions>";

export interface DesignQuestionOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface DesignQuestion {
  readonly id: string;
  readonly question: string;
  readonly rationale?: string;
  readonly multiselect: boolean;
  readonly allowFreeText: boolean;
  readonly options: ReadonlyArray<DesignQuestionOption>;
}

export interface DesignQuestionsBlock {
  readonly questions: ReadonlyArray<DesignQuestion>;
}

export interface ParsedDesignQuestions {
  readonly preamble: string;
  readonly trailing: string;
  readonly block: DesignQuestionsBlock | null;
  readonly rawBlock: string | null;
  readonly parseError: string | null;
}

function toKebabId(input: string, fallback: string): string {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimmed.length > 0 ? trimmed : fallback;
}

function coerceOption(raw: unknown, index: number): DesignQuestionOption | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const label =
    typeof obj.label === "string" && obj.label.trim().length > 0 ? obj.label.trim() : null;
  if (!label) return null;
  const idRaw = typeof obj.id === "string" && obj.id.trim().length > 0 ? obj.id.trim() : label;
  const id = toKebabId(idRaw, `option-${index + 1}`);
  const description =
    typeof obj.description === "string" && obj.description.trim().length > 0
      ? obj.description.trim()
      : undefined;
  return description !== undefined ? { id, label, description } : { id, label };
}

function coerceQuestion(raw: unknown, index: number): DesignQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const questionText =
    typeof obj.question === "string" && obj.question.trim().length > 0 ? obj.question.trim() : null;
  if (!questionText) return null;
  const idRaw =
    typeof obj.id === "string" && obj.id.trim().length > 0 ? obj.id.trim() : questionText;
  const id = toKebabId(idRaw, `question-${index + 1}`);
  const rationale =
    typeof obj.rationale === "string" && obj.rationale.trim().length > 0
      ? obj.rationale.trim()
      : undefined;
  const multiselect = obj.multiselect === false ? false : true;
  const allowFreeText = obj.allowFreeText === false ? false : true;
  const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
  const options: DesignQuestionOption[] = [];
  for (const [i, item] of optionsRaw.entries()) {
    const option = coerceOption(item, i);
    if (option) options.push(option);
  }
  return {
    id,
    question: questionText,
    ...(rationale !== undefined ? { rationale } : {}),
    multiselect,
    allowFreeText,
    options,
  };
}

function coerceBlock(raw: unknown): DesignQuestionsBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const questionsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  const questions: DesignQuestion[] = [];
  for (const [i, item] of questionsRaw.entries()) {
    const question = coerceQuestion(item, i);
    if (question) questions.push(question);
  }
  if (questions.length === 0) return null;
  return { questions };
}

export function parseDesignQuestionsMessage(text: string): ParsedDesignQuestions {
  const openIdx = text.indexOf(DESIGN_QUESTIONS_OPEN_TAG);
  if (openIdx === -1) {
    return {
      preamble: text,
      trailing: "",
      block: null,
      rawBlock: null,
      parseError: null,
    };
  }
  const closeIdx = text.indexOf(DESIGN_QUESTIONS_CLOSE_TAG, openIdx);
  const preamble = text.slice(0, openIdx).trimEnd();
  if (closeIdx === -1) {
    // Block is still streaming in. Hide raw JSON while we wait.
    return {
      preamble,
      trailing: "",
      block: null,
      rawBlock: text.slice(openIdx),
      parseError: null,
    };
  }
  const rawBlock = text.slice(openIdx, closeIdx + DESIGN_QUESTIONS_CLOSE_TAG.length);
  const trailing = text.slice(closeIdx + DESIGN_QUESTIONS_CLOSE_TAG.length).trim();
  const inner = text.slice(openIdx + DESIGN_QUESTIONS_OPEN_TAG.length, closeIdx).trim();
  try {
    const parsed = JSON.parse(inner);
    const block = coerceBlock(parsed);
    if (!block) {
      return {
        preamble,
        trailing,
        block: null,
        rawBlock,
        parseError: "No valid questions in design block.",
      };
    }
    return { preamble, trailing, block, rawBlock, parseError: null };
  } catch (err) {
    return {
      preamble,
      trailing,
      block: null,
      rawBlock,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface DesignAnswerState {
  readonly selectedOptionIds: ReadonlySet<string>;
  readonly freeText: string;
}

export interface DesignAnswers {
  readonly byQuestionId: Readonly<Record<string, DesignAnswerState>>;
}

function renderAnswerSection(
  question: DesignQuestion,
  state: DesignAnswerState | undefined,
): string {
  const selectedOptions = question.options.filter((option) =>
    state?.selectedOptionIds.has(option.id),
  );
  const selectedLabels = selectedOptions.map((option) => `- ${option.label}`);
  const notes = state?.freeText.trim() ?? "";
  const parts: string[] = [`### ${question.question}`];
  if (selectedLabels.length > 0) {
    parts.push("", ...selectedLabels);
  } else {
    parts.push("", "- _(no option selected)_");
  }
  if (notes.length > 0) {
    parts.push("", "Notes:", "", notes);
  }
  return parts.join("\n");
}

export function compileDesignAnswers(input: {
  readonly block: DesignQuestionsBlock;
  readonly answers: DesignAnswers;
}): string {
  const sections = input.block.questions.map((question) =>
    renderAnswerSection(question, input.answers.byQuestionId[question.id]),
  );
  return ["## Answers", "", ...sections, ""].join("\n\n");
}

export function createEmptyDesignAnswers(block: DesignQuestionsBlock): DesignAnswers {
  const byQuestionId: Record<string, DesignAnswerState> = {};
  for (const question of block.questions) {
    byQuestionId[question.id] = {
      selectedOptionIds: new Set<string>(),
      freeText: "",
    };
  }
  return { byQuestionId };
}
