import { memo, useCallback, useMemo, useState } from "react";
import { CheckIcon, ChevronRightIcon, SparkleIcon } from "lucide-react";
import {
  compileDesignAnswers,
  createEmptyDesignAnswers,
  type DesignAnswerState,
  type DesignAnswers,
  type DesignQuestion,
  type DesignQuestionsBlock,
} from "../../designQuestions";
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
  index: number;
  onChange: (next: DesignAnswerState) => void;
}) {
  const { question, answer, disabled, index, onChange } = props;
  const selectionHint = question.multiselect ? "Pick any that apply" : "Pick one";
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong/70 bg-background font-mono text-[11px] font-medium text-muted-foreground"
        >
          {index + 1}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="font-display text-[19px] italic leading-tight text-foreground">
            {question.question}
          </div>
          {question.rationale ? (
            <div className="text-[13px] leading-snug text-muted-foreground">
              {question.rationale}
            </div>
          ) : null}
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            {selectionHint}
          </div>
        </div>
      </div>

      {question.options.length > 0 ? (
        <div className="flex flex-wrap gap-2 pl-8">
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
                  "group/option inline-flex max-w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors",
                  active
                    ? "border-brand/70 bg-brand/10 text-foreground"
                    : "border-border bg-background text-foreground hover:border-border-strong hover:bg-accent/50",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "mt-[3px] inline-flex size-3.5 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                    active ? "border-brand bg-brand text-brand-foreground" : "border-border-strong",
                  )}
                  aria-hidden="true"
                >
                  {active ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium leading-tight text-foreground">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="block pt-0.5 text-[12px] leading-snug text-muted-foreground">
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
          className="ml-8 min-h-[72px] w-[calc(100%-2rem)] resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          rows={3}
          placeholder="A note, a preference, a reference — anything extra we should know"
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

  const footerMessage = submitted
    ? "Sent — the model is drafting."
    : hasAnySelection
      ? "Ready when you are."
      : "Pick an option or add a note to continue.";

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border-strong/50 bg-surface shadow-soft">
      <div className="flex items-center gap-2.5 border-b border-border/70 bg-brand/[0.06] px-5 py-3">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <SparkleIcon className="size-3" strokeWidth={2.5} />
        </span>
        <div className="flex flex-col">
          <span className="font-display text-[17px] italic leading-none text-foreground">
            A few questions first
          </span>
          <span className="text-[12px] text-muted-foreground">
            Your answers shape what the model draws.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {block.questions.map((question, index) => (
          <DesignQuestionBlock
            key={question.id}
            question={question}
            index={index}
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

      <div className="flex items-center justify-between gap-4 border-t border-border/70 bg-background/50 px-5 py-3">
        <div className="text-[13px] text-muted-foreground">{footerMessage}</div>
        <button
          type="button"
          disabled={!isInteractive || !hasAnySelection}
          onClick={handleSubmit}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-transparent bg-brand pl-4 pr-3 text-[14px] font-medium text-brand-foreground shadow-soft transition-[background-color,opacity] hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
            submitted && "!bg-success !text-success-foreground",
          )}
        >
          {submitted ? (
            <>
              <CheckIcon className="size-4" strokeWidth={2.5} />
              Sent
            </>
          ) : submitting ? (
            "Sending…"
          ) : (
            <>
              Continue
              <ChevronRightIcon className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
});
