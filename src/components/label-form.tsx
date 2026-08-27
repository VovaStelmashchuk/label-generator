'use client';

import { useMemo, useRef, useState } from 'react';

import { LabelPreview } from '@/components/label-preview';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tag } from '@/components/ui/tag';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  FieldLabel,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/ui/text-input';

import { FONTS, type FontId } from '@/lib/fonts';
import {
  clearSpanRange,
  DEFAULT_SPEC,
  LIMITS,
  normalizeSpans,
  remapSpans,
  styleAt,
  type LabelSpec,
  type TextSpan,
} from '@/lib/label-spec';
import { trackClient } from '@/lib/track-client';
import { cn } from '@/lib/utils';

const HORIZONTAL_OPTIONS = [
  { value: 'left', icon: 'lucide:align-left', label: 'Align left' },
  { value: 'center', icon: 'lucide:align-center', label: 'Align centre' },
  { value: 'right', icon: 'lucide:align-right', label: 'Align right' },
] as const;

const VERTICAL_OPTIONS = [
  { value: 'top', icon: 'lucide:align-start-horizontal', label: 'Align top' },
  {
    value: 'middle',
    icon: 'lucide:align-center-horizontal',
    label: 'Align middle',
  },
  { value: 'bottom', icon: 'lucide:align-end-horizontal', label: 'Align bottom' },
] as const;

/** Fields the plain number inputs write to; text size goes through applyStyle. */
type NumericKey = 'widthCm' | 'heightCm' | 'strokeMm' | 'radiusMm' | 'maxLabels';

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; fileName: string; labelCount: number };

export function LabelForm({ isLoggedIn, authUrl }: { isLoggedIn?: boolean; authUrl?: string }) {
  const [spec, setSpec] = useState<LabelSpec>(DEFAULT_SPEC);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  /**
   * The stretch of text the size and weight controls act on. Kept in state
   * rather than read on demand, because the textarea loses its selection the
   * moment focus moves to the control the user is about to touch.
   */
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const update = <K extends keyof LabelSpec>(key: K, value: LabelSpec[K]) => {
    setSpec((current) => ({ ...current, [key]: value }) as LabelSpec);
    setStatus({ kind: 'idle' });
  };

  const numberField = (key: NumericKey, raw: string) => {
    const parsed = Number(raw);
    // Let the field go empty while typing; the value is only applied once it
    // parses, and the server clamps anything out of range anyway.
    if (raw === '' || Number.isNaN(parsed)) return;
    update(key, parsed);
  };

  const spans = useMemo(
    () => normalizeSpans(spec.text, spec.spans),
    [spec.text, spec.spans],
  );

  /** Style the controls currently display: the selection's, or the label's. */
  const activeStyle = selection
    ? styleAt(spec, selection.start)
    : { sizePt: spec.fontSizePt, bold: spec.bold };

  function rememberSelection(target: HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end } = target;
    // A caret is not a selection; collapsing it puts the controls back on the
    // label as a whole, which is what clicking into the text should do.
    setSelection(end > start ? { start, end } : null);
  }

  /** Applies an override to the selection, or to the whole label without one. */
  function applyStyle(patch: { sizePt?: number; bold?: boolean }) {
    setStatus({ kind: 'idle' });

    if (!selection) {
      setSpec((current) => ({
        ...current,
        fontSizePt: patch.sizePt ?? current.fontSizePt,
        bold: patch.bold ?? current.bold,
      }));
      return;
    }

    const { start, end } = selection;
    setSpec((current) => ({
      ...current,
      spans: normalizeSpans(current.text, [
        ...current.spans,
        { start, end, ...patch },
      ]),
    }));

    // Keep the words highlighted so the next tweak lands on the same stretch.
    textRef.current?.setSelectionRange(start, end);
  }

  function changeText(next: string) {
    setStatus({ kind: 'idle' });
    // Offsets from before the edit no longer mean anything; the textarea's own
    // select event will report the new caret straight after this.
    setSelection(null);
    setSpec((current) => ({
      ...current,
      text: next,
      spans: remapSpans(current.text, next, current.spans),
    }));
  }

  function clearSpan(span: TextSpan) {
    setStatus({ kind: 'idle' });
    setSpec((current) => ({
      ...current,
      spans: clearSpanRange(current, span.start, span.end),
    }));
  }

  async function generate() {
    trackClient('click_download_labels', {
      widthCm: spec.widthCm,
      heightCm: spec.heightCm,
      fontId: spec.fontId,
      bold: spec.bold,
      spanCount: spec.spans.length,
      maxLabels: spec.maxLabels,
    });

    setStatus({ kind: 'working' });

    try {
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      });

      const payload = await response.json();
      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: payload?.error ?? 'Could not build the PDF',
        });
        return;
      }

      // A plain navigation to the stored file lets the browser's own download
      // handling take over, and keeps the URL shareable.
      window.location.href = payload.downloadUrl;

      setStatus({
        kind: 'ready',
        fileName: payload.fileName,
        labelCount: payload.labelCount,
      });
    } catch {
      setStatus({ kind: 'error', message: 'The server did not answer' });
    }
  }

  async function saveLabel() {
    if (!isLoggedIn && authUrl) {
      window.location.href = authUrl;
      return;
    }

    setStatus({ kind: 'working' });
    try {
      const response = await fetch('/api/labels/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setStatus({
          kind: 'error',
          message: payload?.error ?? 'Could not save the label',
        });
        return;
      }

      setStatus({
        kind: 'ready',
        fileName: 'Label saved successfully',
        labelCount: 0,
      });
    } catch {
      setStatus({ kind: 'error', message: 'The server did not answer' });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="label-text">Label text</FieldLabel>
          <TextArea
            id="label-text"
            ref={textRef}
            rows={3}
            maxLength={LIMITS.text.maxLength}
            placeholder="Sugar"
            value={spec.text}
            onChange={(event) => changeText(event.target.value)}
            onSelect={(event) => rememberSelection(event.currentTarget)}
            onBlur={(event) => rememberSelection(event.currentTarget)}
          />
          <p className="mt-1.5 text-xs text-label-tertiary">
            Long text wraps automatically. Press Enter for a manual line break.
            Select part of the text to size or bold just that part.
          </p>

          {spans.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {spans.map((span) => (
                <Tag key={`${span.start}-${span.end}`} icon="lucide:type">
                  <span>
                    {describeSpan(span, spec)} &middot;{' '}
                    <span className="text-label-primary">
                      &ldquo;{excerpt(spec.text, span)}&rdquo;
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Reset "${excerpt(spec.text, span)}" to the label style`}
                    onClick={() => clearSpan(span)}
                    className="ml-0.5 cursor-pointer rounded-sm p-0.5 hover:bg-fill-secondary"
                  >
                    <Icon name="lucide:x" className="size-3" />
                  </button>
                </Tag>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="label-width">Width (cm)</FieldLabel>
            <TextInput
              id="label-width"
              type="number"
              inputMode="decimal"
              min={LIMITS.widthCm.min}
              max={LIMITS.widthCm.max}
              step={LIMITS.widthCm.step}
              value={spec.widthCm}
              onChange={(event) => numberField('widthCm', event.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="label-height">Height (cm)</FieldLabel>
            <TextInput
              id="label-height"
              type="number"
              inputMode="decimal"
              min={LIMITS.heightCm.min}
              max={LIMITS.heightCm.max}
              step={LIMITS.heightCm.step}
              value={spec.heightCm}
              onChange={(event) => numberField('heightCm', event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="label-font">Font</FieldLabel>
            <SelectInput
              id="label-font"
              value={spec.fontId}
              onChange={(event) =>
                update('fontId', event.target.value as FontId)
              }
            >
              {(['sans', 'serif', 'mono'] as const).map((category) => (
                <optgroup key={category} label={category.toUpperCase()}>
                  {FONTS.filter((font) => font.category === category).map(
                    (font) => (
                      <option key={font.id} value={font.id}>
                        {font.name}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel htmlFor="label-size">
              Text size (pt){selection ? ' — selection' : ''}
            </FieldLabel>
            <TextInput
              id="label-size"
              type="number"
              inputMode="numeric"
              min={LIMITS.fontSizePt.min}
              max={LIMITS.fontSizePt.max}
              step={LIMITS.fontSizePt.step}
              value={activeStyle.sizePt}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (event.target.value === '' || Number.isNaN(parsed)) return;
                applyStyle({ sizePt: parsed });
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <FieldLabel>Horizontal</FieldLabel>
            <SegmentedControl
              options={HORIZONTAL_OPTIONS}
              value={spec.horizontalAlign}
              onChange={(value) => update('horizontalAlign', value)}
            />
          </div>
          <div>
            <FieldLabel>Vertical</FieldLabel>
            <SegmentedControl
              options={VERTICAL_OPTIONS}
              value={spec.verticalAlign}
              onChange={(value) => update('verticalAlign', value)}
            />
          </div>
          <div>
            <FieldLabel>Weight{selection ? ' — selection' : ''}</FieldLabel>
            <Button
              variant={activeStyle.bold ? 'primary' : 'ghost'}
              size="sm"
              icon="lucide:bold"
              aria-pressed={activeStyle.bold}
              className={cn(!activeStyle.bold && 'border-separator-primary')}
              onClick={() => applyStyle({ bold: !activeStyle.bold })}
            >
              Bold
            </Button>
          </div>
        </div>

        <fieldset className="rounded-md border border-separator-secondary p-4">
          <legend className="px-1 text-sm font-medium text-label-secondary">
            Border
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="label-stroke">Stroke width (mm)</FieldLabel>
              <TextInput
                id="label-stroke"
                type="number"
                inputMode="decimal"
                min={LIMITS.strokeMm.min}
                max={LIMITS.strokeMm.max}
                step={LIMITS.strokeMm.step}
                value={spec.strokeMm}
                onChange={(event) => numberField('strokeMm', event.target.value)}
              />
              <p className="mt-1.5 text-xs text-label-tertiary">
                0 prints no border.
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="label-radius">Corner radius (mm)</FieldLabel>
              <TextInput
                id="label-radius"
                type="number"
                inputMode="decimal"
                min={LIMITS.radiusMm.min}
                max={LIMITS.radiusMm.max}
                step={LIMITS.radiusMm.step}
                value={spec.radiusMm}
                onChange={(event) => numberField('radiusMm', event.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <div>
          <FieldLabel htmlFor="label-max">Maximum labels per page</FieldLabel>
          <TextInput
            id="label-max"
            type="number"
            inputMode="numeric"
            min={LIMITS.maxLabels.min}
            max={LIMITS.maxLabels.max}
            step={LIMITS.maxLabels.step}
            value={spec.maxLabels ?? ''}
            placeholder="Fill page"
            onChange={(event) => {
              if (event.target.value === '') {
                update('maxLabels', undefined);
              } else {
                numberField('maxLabels', event.target.value);
              }
            }}
          />
          <p className="mt-1.5 text-xs text-label-tertiary">
            Leave empty to fill the entire A4 page.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            icon="lucide:download"
            onClick={generate}
            disabled={status.kind === 'working' || spec.text.trim() === ''}
          >
            {status.kind === 'working' ? 'Building PDF...' : 'Download labels'}
          </Button>

          <Button
            variant="ghost"
            icon="lucide:save"
            onClick={saveLabel}
            disabled={status.kind === 'working' || spec.text.trim() === ''}
          >
            {isLoggedIn ? 'Save Label' : 'Log in to Save'}
          </Button>

          <Button
            variant="ghost"
            icon="lucide:ruler"
            href="/api/calibration"
            onClick={() =>
              trackClient('click_download_calibration', {
                fileName: 'calibration-10x10cm.pdf',
              })
            }
          >
            Download calibration
          </Button>
        </div>

        <div aria-live="polite" className="min-h-6">
          {status.kind === 'error' ? (
            <Tag variant="error" icon="lucide:circle-alert">
              {status.message}
            </Tag>
          ) : null}
          {status.kind === 'ready' ? (
            <Tag variant="success" icon="lucide:circle-check">
              {status.labelCount} labels in {status.fileName}
            </Tag>
          ) : null}
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-label-secondary">
          <Icon name="lucide:eye" />
          Preview
        </h2>
        <LabelPreview spec={spec} />
        <p className="mt-3 text-xs text-label-tertiary">
          Print at 100% scale. Use the calibration PDF to check that your printer
          is not resizing the page.
        </p>
      </aside>
    </div>
  );
}

/** Short human description of what a span overrides, e.g. "24pt · Bold". */
function describeSpan(span: TextSpan, spec: LabelSpec): string {
  const parts: string[] = [];
  if (span.sizePt !== undefined) parts.push(`${span.sizePt}pt`);
  if (span.bold !== undefined && span.bold !== spec.bold) {
    parts.push(span.bold ? 'Bold' : 'Regular');
  }
  return parts.join(' · ') || 'Label style';
}

/** The span's text, shortened so a long selection cannot stretch the chip. */
function excerpt(text: string, span: TextSpan): string {
  const slice = text.slice(span.start, span.end).replace(/\s+/g, ' ').trim();
  return slice.length > 16 ? `${slice.slice(0, 15)}…` : slice;
}

