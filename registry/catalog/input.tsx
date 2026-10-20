import * as React from "react"
import { z } from "zod"

import { Button as ButtonView } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider as SliderView } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/parts/action-card"
import { action, defineComponent, format } from "@/components/surface/catalog"

// Input: what the person does. Values bind both ways to the data model
// (`value: { "path": "/form/limit" }`); an action's context can read them
// back at click time. Destructive actions go through Confirm.

export const Button = defineComponent({
  name: "Button",
  kind: "input",
  description:
    "One action, labelled with its verb ('Raise limit', 'Deploy'). primary: the main one; secondary; ghost: tertiary.",
  props: z.object({
    label: z.string(),
    variant: z.enum(["primary", "secondary", "ghost"]).optional(),
    action,
  }),
  // No handler (an event the host doesn't offer, or a destructive one on a
  // plain button): nothing renders. Use Confirm for destructive actions.
  render: (p, ctx) => {
    const onClick = ctx.action(p.action)
    if (!onClick) return null
    return (
      <ButtonView
        size="sm"
        variant={
          p.variant === "secondary"
            ? "secondary"
            : p.variant === "ghost"
              ? "ghost"
              : "default"
        }
        className="rounded-full"
        onClick={onClick}
      >
        {p.label}
      </ButtonView>
    )
  },
})

export const TextField = defineComponent({
  name: "TextField",
  kind: "input",
  description: "Free text, bound to the data model through `value`.",
  props: z.object({
    label: z.string(),
    value: z.string().optional(),
    placeholder: z.string().optional(),
    multiline: z.boolean().optional(),
  }),
  render: (p, ctx) => {
    const path = ctx.boundPath("value")
    const id = `${ctx.surfaceId}-${ctx.componentId}`
    const field = {
      id,
      value: p.value ?? "",
      placeholder: p.placeholder,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => path && ctx.set(path, e.target.value),
    }
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{p.label}</Label>
        {p.multiline ? <Textarea {...field} /> : <Input {...field} />}
      </div>
    )
  },
})

export const ChoicePicker = defineComponent({
  name: "ChoicePicker",
  kind: "input",
  description:
    "Pick one of a few options (2–6), each with an optional hint. Bound through `value`.",
  props: z.object({
    label: z.string(),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
          hint: z.string().optional(),
        })
      )
      .min(2)
      .max(8),
    value: z.string().optional(),
  }),
  render: (p, ctx) => {
    const path = ctx.boundPath("value")
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{p.label}</legend>
        <RadioGroup
          value={p.value ?? ""}
          onValueChange={(v) => path && ctx.set(path, v)}
        >
          {p.options.map((o) => {
            const id = `${ctx.surfaceId}-${ctx.componentId}-${o.value}`
            return (
              <div key={o.value} className="flex items-start gap-2.5">
                <RadioGroupItem id={id} value={o.value} className="mt-0.5" />
                <Label
                  htmlFor={id}
                  className="flex flex-col items-start gap-0 font-normal"
                >
                  <span>{o.label}</span>
                  {o.hint && (
                    <span className="text-xs text-muted-foreground">
                      {o.hint}
                    </span>
                  )}
                </Label>
              </div>
            )
          })}
        </RadioGroup>
      </fieldset>
    )
  },
})

export const CheckBox = defineComponent({
  name: "CheckBox",
  kind: "input",
  description: "One yes/no, bound through `value`.",
  props: z.object({ label: z.string(), value: z.boolean().optional() }),
  render: (p, ctx) => {
    const path = ctx.boundPath("value")
    const id = `${ctx.surfaceId}-${ctx.componentId}`
    return (
      <div className="flex items-center gap-2.5">
        <Checkbox
          id={id}
          checked={!!p.value}
          onCheckedChange={(v) => path && ctx.set(path, v === true)}
        />
        <Label htmlFor={id} className="font-normal">
          {p.label}
        </Label>
      </div>
    )
  },
})

export const Slider = defineComponent({
  name: "Slider",
  kind: "input",
  description:
    "A number in a range, bound through `value`; shows the formatted value.",
  props: z.object({
    label: z.string(),
    value: z.number().optional(),
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    format: format.optional(),
  }),
  render: (p, ctx) => {
    const path = ctx.boundPath("value")
    const v = p.value ?? p.min
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between text-sm">
          <span>{p.label}</span>
          <span className="tabular-nums">{ctx.format(v, p.format)}</span>
        </div>
        <SliderView
          value={[v]}
          min={p.min}
          max={p.max}
          step={p.step ?? 1}
          onValueChange={(next) =>
            path && ctx.set(path, Array.isArray(next) ? next[0] : next)
          }
        />
      </div>
    )
  },
})

export const Confirm = defineComponent({
  name: "Confirm",
  kind: "input",
  description:
    "An approval gate: what will happen, and the two answers. Required before anything destructive or irreversible.",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    confirmLabel: z.string(),
    cancelLabel: z.string().optional(),
    action,
    cancelAction: action.optional(),
  }),
  render: (p, ctx) => (
    <ActionCard>
      <ActionCardHeader>
        <ActionCardTitle>{p.title}</ActionCardTitle>
      </ActionCardHeader>
      {p.description && (
        <ActionCardDescription>{p.description}</ActionCardDescription>
      )}
      <ActionCardActions>
        <ButtonView
          size="sm"
          onClick={ctx.action(p.action, { confirmed: true })}
        >
          {p.confirmLabel}
        </ButtonView>
        {p.cancelAction && (
          <ButtonView
            size="sm"
            variant="secondary"
            onClick={ctx.action(p.cancelAction, { confirmed: true })}
          >
            {p.cancelLabel ?? "Not now"}
          </ButtonView>
        )}
      </ActionCardActions>
    </ActionCard>
  ),
})

export const input = [
  Button,
  TextField,
  ChoicePicker,
  CheckBox,
  Slider,
  Confirm,
]
