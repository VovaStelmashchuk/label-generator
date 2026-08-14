'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

const LabelPreview = dynamic(
  () => import('@/components/label-preview').then((mod) => mod.LabelPreview),
  { ssr: false }
);
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tag } from '@/components/ui/tag';
import {
  FieldLabel,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/ui/text-input';

import { FONTS, type FontId } from '@/lib/fonts';
import { DEFAULT_SPEC, LIMITS, type LabelSpec } from '@/lib/label-spec';
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

type NumericKey =
  | 'widthCm'
  | 'heightCm'
  | 'fontSizePt'
  | 'strokeMm'
  | 'radiusMm';

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; fileName: string; labelCount: number };

export function LabelForm() {
  const [spec, setSpec] = useState<LabelSpec>(DEFAULT_SPEC);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

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

  async function generate() {
    trackClient('click_download_labels', {
      widthCm: spec.widthCm,
      heightCm: spec.heightCm,
      fontId: spec.fontId,
      bold: spec.bold,
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="label-text">Label text</FieldLabel>
          <TextArea
            id="label-text"
            rows={3}
            maxLength={LIMITS.text.maxLength}
            placeholder="Sugar"
            value={spec.text}
            onChange={(event) => update('text', event.target.value)}
          />
          <p className="mt-1.5 text-xs text-label-tertiary">
            Long text wraps automatically. Press Enter for a manual line break.
          </p>
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

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
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
            <FieldLabel htmlFor="label-size">Text size (pt)</FieldLabel>
            <TextInput
              id="label-size"
              type="number"
              inputMode="numeric"
              min={LIMITS.fontSizePt.min}
              max={LIMITS.fontSizePt.max}
              step={LIMITS.fontSizePt.step}
              value={spec.fontSizePt}
              onChange={(event) => numberField('fontSizePt', event.target.value)}
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
            <FieldLabel>Weight</FieldLabel>
            <Button
              variant={spec.bold ? 'primary' : 'ghost'}
              size="sm"
              icon="lucide:bold"
              aria-pressed={spec.bold}
              className={cn(!spec.bold && 'border-separator-primary')}
              onClick={() => update('bold', !spec.bold)}
            >
              Bold
            </Button>
          </div>
        </div>

        <fieldset className="rounded-xl border border-separator-secondary p-4">
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
            icon="lucide:ruler"
            href="/api/calibration"
            onClick={() =>
              trackClient('click_download_calibration', {
                fileName: 'calibration-10x10cm.pdf',
              })
            }
          >
            Download the calibration PDF
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

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; icon: string; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl border-2 border-accent-primary bg-surface p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.value === value ? 'primary' : 'ghost'}
          size="sm"
          icon={option.icon}
          aria-label={option.label}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
