"use client";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { TextInput, TextArea, SelectInput, FieldLabel } from "@/components/ui/text-input";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import * as React from 'react';

export default function DesignSystemPreviewPage() {
  const [segment, setSegment] = React.useState('0');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 pb-24">
      <h1 className="text-3xl font-bold mb-8">Design System</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Buttons</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" icon="lucide:download">With Icon</Button>
          <Button variant="ghost" icon="lucide:settings" iconOnly aria-label="Settings" />
          <Button variant="primary" size="sm">Small</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Tags</h2>
        <div className="flex flex-wrap gap-4">
          <Tag variant="primary">Primary Tag</Tag>
          <Tag variant="success">Success Tag</Tag>
          <Tag variant="error">Error Tag</Tag>
        </div>
        <div className="flex flex-wrap gap-4">
          <Tag variant="primary" icon="lucide:tag">With Icon</Tag>
          <Tag variant="success" icon="lucide:circle-check">Completed</Tag>
          <Tag variant="error" icon="lucide:triangle-alert">Warning</Tag>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Form Elements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <FieldLabel htmlFor="text-input">Text Input</FieldLabel>
            <TextInput id="text-input" placeholder="Enter text..." />
          </div>
          <div>
            <FieldLabel htmlFor="disabled-input">Disabled Input</FieldLabel>
            <TextInput id="disabled-input" disabled value="Cannot edit me" />
          </div>
          <div className="md:col-span-2">
            <FieldLabel htmlFor="textarea">Text Area</FieldLabel>
            <TextArea id="textarea" placeholder="Enter multiline text..." rows={3} />
          </div>
          <div>
            <FieldLabel htmlFor="select">Select Input</FieldLabel>
            <SelectInput id="select">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </SelectInput>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Segmented Control (0-5)</h2>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon="lucide:minus"
            onClick={() => setSegment(String(Math.max(0, parseInt(segment) - 1)))}
            disabled={segment === '0'}
            aria-label="Decrease"
            iconOnly
          />
          <SegmentedControl
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '5', label: '5' },
            ]}
            value={segment}
            onChange={setSegment}
          />
          <Button
            variant="ghost"
            icon="lucide:plus"
            onClick={() => setSegment(String(Math.min(5, parseInt(segment) + 1)))}
            disabled={segment === '5'}
            aria-label="Increase"
            iconOnly
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-separator-primary pb-2">Icons</h2>
        <div className="flex gap-4 text-2xl text-label-secondary">
          <Icon name="lucide:download" />
          <Icon name="lucide:tag" />
          <Icon name="lucide:settings" />
          <Icon name="lucide:user" />
          <Icon name="lucide:check" />
        </div>
      </section>
    </div >
  );
}
