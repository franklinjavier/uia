import { motion } from "motion/react"
import {
  ChevronLeftIcon,
  MessageCircleQuestionIcon,
  PencilIcon,
  SkipForwardIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"

import { Button } from "@/components/ui/button"
import {
  Questionnaire,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import {
  ActionCard,
  ActionCardHeader,
  ActionCardPanel,
  ResolvedRow,
} from "@/components/ai-elements/action-card"

export type Question = { id: string; question: string; choices: string[] }

// Clarify-first. One question at a time, choices keyed A/B/C, a free answer
// always available, and × to skip (the assistant then uses its defaults).
export function AskUser({
  questions,
  onSubmit,
  onSkip,
  className,
}: {
  questions: Question[]
  onSubmit: (answers: Record<string, string>) => void
  onSkip: () => void
  className?: string
}) {
  const last = questions.length - 1

  return (
    <ActionCard className={cn("gap-0 p-0", className)}>
      <Questionnaire
        // Never let the browser restore a previous pick on reload: an answer
        // must always be the person's own click.
        autoComplete="off"
        shortcuts="letters"
        defaultItem={questions[0]?.id}
        items={questions.map((q) => ({
          name: q.id,
          required: true,
          choices: q.choices.map((value) => ({ value })),
        }))}
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSubmit(
            Object.fromEntries(questions.map((q) => [q.id, String(data.get(q.id) ?? "")]))
          )
        }}
        className="gap-0"
      >
        {questions.map((q, i) => (
          <QuestionnaireItem key={q.id} name={q.id} required className="gap-3 p-3.5">
            <ActionCardHeader>
              <QuestionnaireTitle className="mb-0! pt-0.5 text-sm font-medium tracking-normal">
                {q.question}
              </QuestionnaireTitle>
              <div className="-mt-0.5 -mr-1 flex items-center gap-1.5">
                {questions.length > 1 && (
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {i + 1}/{questions.length}
                  </span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Skip questions"
                  className="text-muted-foreground"
                  onClick={onSkip}
                >
                  <XIcon />
                </Button>
              </div>
            </ActionCardHeader>
            <QuestionnaireChoices className="gap-2">
              <ActionCardPanel className="divide-y divide-border/70 [&_[data-slot=questionnaire-choice-indicator]]:hidden">
                {q.choices.map((choice) => (
                  <QuestionnaireChoice
                    key={choice}
                    value={choice}
                    className="min-h-10 items-center rounded-none border-0 px-3 py-2 hover:bg-muted/60 data-checked:bg-muted has-[>input:focus-visible]:ring-2 has-[>input:focus-visible]:ring-inset [&>[data-slot=questionnaire-choice-shortcut]]:order-first [&>[data-slot=questionnaire-choice-shortcut]]:ms-0 [&>[data-slot=questionnaire-choice-shortcut]]:translate-y-0 [&>[data-slot=questionnaire-choice-shortcut]]:rounded-md [&>[data-slot=questionnaire-choice-shortcut]]:border-border [&>[data-slot=questionnaire-choice-shortcut]]:bg-muted [&>[data-slot=questionnaire-choice-shortcut]]:uppercase [&[data-checked]>[data-slot=questionnaire-choice-shortcut]]:border-primary [&[data-checked]>[data-slot=questionnaire-choice-shortcut]]:bg-primary [&[data-checked]>[data-slot=questionnaire-choice-shortcut]]:text-primary-foreground"
                  >
                    {choice}
                  </QuestionnaireChoice>
                ))}
              </ActionCardPanel>
              {/* Same button language as every ActionCard: sm pills,
                  primary = default, secondary = secondary. */}
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <QuestionnairePrevious variant="secondary" size="sm" className="min-h-0 shrink-0">
                    <ChevronLeftIcon data-icon="inline-start" />
                    Back
                  </QuestionnairePrevious>
                )}
                <QuestionnaireInput
                  aria-label="Your own answer"
                  placeholder="Type your own answer"
                  // The error is "nothing chosen", not "this field is wrong":
                  // keep the field calm and say it in one quiet line below.
                  className="h-7 min-h-0 rounded-full border-border bg-card px-3 text-sm aria-invalid:border-border aria-invalid:ring-0 dark:aria-invalid:border-border"
                />
                {i === last ? (
                  <QuestionnaireSubmit size="sm" className="min-h-0 shrink-0">
                    Submit
                  </QuestionnaireSubmit>
                ) : (
                  <QuestionnaireNext size="sm" className="min-h-0 shrink-0">
                    Next
                  </QuestionnaireNext>
                )}
              </div>
              <QuestionnaireError className="mt-0 px-1 text-xs text-destructive/90">
                Pick an option or type your own answer.
              </QuestionnaireError>
            </QuestionnaireChoices>
          </QuestionnaireItem>
        ))}
      </Questionnaire>
    </ActionCard>
  )
}

// The chosen option's key, filled: A/B/C, or a pencil for a typed answer.
export function AnswerKey({ question, answer }: { question: Question; answer: string }) {
  const index = question.choices.indexOf(answer)
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-[11px] text-primary-foreground uppercase [&_svg]:size-3">
      {index >= 0 ? String.fromCharCode(65 + index) : <PencilIcon />}
    </span>
  )
}

// Answered. One question: a small card that keeps the question and shows
// the pick (like the questionnaire it replaces). Several: a ResolvedRow
// that expands to every question and its pick. Skipped: a muted row.
export function AskUserAnswered({
  questions,
  answers,
}: {
  questions: Question[]
  answers: Record<string, string>
}) {
  const given = questions.map((q) => answers[q.id]).filter(Boolean)

  if (given.length === 0) {
    return (
      <ResolvedRow
        icon={<SkipForwardIcon />}
        label="Skipped"
        summary="Used defaults"
        muted
      />
    )
  }

  if (questions.length === 1) {
    const [q] = questions
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={enter}
        data-slot="answered-question"
        className="not-typeset flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 text-sm shadow-xs"
      >
        <p className="font-medium text-pretty text-muted-foreground">{q.question}</p>
        <div className="flex items-center gap-2.5">
          <AnswerKey question={q} answer={answers[q.id]} />
          <span className="min-w-0">{answers[q.id]}</span>
        </div>
      </motion.div>
    )
  }

  return (
    <ResolvedRow
      icon={<MessageCircleQuestionIcon />}
      label="Answered"
      summary={given.join(" · ")}
    >
      <dl className="flex flex-col divide-y divide-border/70 pt-1">
        {questions.map((q) => (
          <div key={q.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-xs text-muted-foreground">{q.question}</dt>
            <dd className="flex items-center gap-2.5">
              {answers[q.id] ? (
                <>
                  <AnswerKey question={q} answer={answers[q.id]} />
                  {answers[q.id]}
                </>
              ) : (
                <span className="text-muted-foreground">Default</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </ResolvedRow>
  )
}
