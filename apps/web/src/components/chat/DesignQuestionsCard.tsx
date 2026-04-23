import { memo, useCallback, useMemo, useState } from "react";
import { PaletteIcon, SendHorizonalIcon } from "lucide-react";
import {
  compileDesignAnswers,
  createEmptyDesignAnswers,
  type DesignAnswerState,
  type DesignAnswers,
  type DesignQuestion,
  type DesignQuestionsBlock,
} from "../../designQuestions";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

interface DesignQuestionsCardProps {
  readonly block: DesignQuestionsBlock;
  readonly disabled?: boolean;
  readonly onSubmit?: (compiledText: string) => void | Promise<void>;
}

function toggleSelection(
  current: ReadonlySet<string>,
  optionId: string,
  multiselect: boolean,
): Set<string> {
  if (multiselect) {
    const next = new Set(current);
    if (next.has(optionId)) {
      next.delete(optionId);
    } else {
      next.add(optionId);
    }
    return next;
  }
  if (current.has(optionId) && current.size === 1) {
    return new Set();
  }
  return new Set([optionId]);
}

const DesignQuestionBlock = memo(function DesignQuestionBlock(props: {
  question: DesignQuestion;
  answer: DesignAnswerState;
  disabled: boolean;
  onChange: (next: DesignAnswerState) => void;
}) {
  const { question, answer, disabled, onChange } = props;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-col gap-1">
        <div className="font-medium text-sm text-foreground">{question.question}</div>
        {question.rationale ? (
          <div className="text-xs text-muted-foreground/80">{question.rationale}</div>
        ) : null}
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          {question.multiselect ? "Select any that apply" : "Select one"}
        </div>
      </div>
      {question.options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.options.map((option) => {
            const active = answer.selectedOptionIds.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...answer,
                    selectedOptionIds: toggleSelection(
                      answer.selectedOptionIds,
                      option.id,
                      question.multiselect,
                    ),
                  })
                }
                className={cn(
                  "group/option inline-flex max-w-full items-start gap-2 rounded-md border px-3 py-1.5 text-left text-xs transition-colors",
                  active
                    ? "border-pink-400/60 bg-pink-400/10 text-foreground"
                    : "border-border/60 bg-background/60 text-muted-foreground/90 hover:border-border hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "mt-[2px] inline-block size-3 shrink-0 rounded-[3px] border transition-colors",
                    active ? "border-pink-400/80 bg-pink-400/60" : "border-border/60",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block font-medium leading-tight">{option.label}</span>
                  {option.description ? (
                    <span className="block pt-0.5 text-[11px] leading-snug text-muted-foreground/70">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {question.allowFreeText ? (
        <textarea
          className="mt-3 w-full min-w-0 resize-y rounded-md border border-border/50 bg-background/50 px-3 py-2 text-xs text-foreground shadow-inner outline-none transition-colors focus:border-pink-400/60"
          rows={2}
          placeholder="Extra notes (optional)"
          disabled={disabled}
          value={answer.freeText}
          onChange={(event) => onChange({ ...answer, freeText: event.target.value })}
        />
      ) : null}
    </div>
  );
});

export const DesignQuestionsCard = memo(function DesignQuestionsCard({
  block,
  disabled,
  onSubmit,
}: DesignQuestionsCardProps) {
  const [answers, setAnswers] = useState<DesignAnswers>(() => createEmptyDesignAnswers(block));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isInteractive = !disabled && !submitted && !submitting && onSubmit !== undefined;

  const hasAnySelection = useMemo(
    () =>
      Object.values(answers.byQuestionId).some(
        (a) => a.selectedOptionIds.size > 0 || a.freeText.trim().length > 0,
      ),
    [answers],
  );

  const onAnswerChange = useCallback((questionId: string, next: DesignAnswerState) => {
    setAnswers((prev) => ({
      byQuestionId: { ...prev.byQuestionId, [questionId]: next },
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!onSubmit || submitting || submitted) return;
    setSubmitting(true);
    try {
      const compiled = compileDesignAnswers({ block, answers });
      await onSubmit(compiled);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [answers, block, onSubmit, submitted, submitting]);

  return (
    <div className="my-2 rounded-xl border border-pink-400/20 bg-gradient-to-b from-pink-400/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-pink-400/90">
        <PaletteIcon className="size-3.5" />
        Design questions
      </div>
      <div className="flex flex-col gap-3">
        {block.questions.map((question) => (
          <DesignQuestionBlock
            key={question.id}
            question={question}
            answer={
              answers.byQuestionId[question.id] ?? {
                selectedOptionIds: new Set<string>(),
                freeText: "",
              }
            }
            disabled={!isInteractive}
            onChange={(next) => onAnswerChange(question.id, next)}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground/70">
          {submitted
            ? "Answers sent."
            : hasAnySelection
              ? "Ready to continue."
              : "Select at least one option or add a note before continuing."}
        </div>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={!isInteractive || !hasAnySelection}
          onClick={handleSubmit}
          className="shrink-0"
        >
          <SendHorizonalIcon className="size-3.5" />
          {submitted ? "Sent" : submitting ? "Sending..." : "Continue"}
        </Button>
      </div>
    </div>
  );
});
