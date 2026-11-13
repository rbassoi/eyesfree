// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { memoryAdapter } from '@eyesfree/web';
import { EyesFreeCalibrator, EyesFreeProvider, useEyesFree } from '@eyesfree/react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Status() {
  const { active, profile, toggle } = useEyesFree();
  return (
    <button id="status" onClick={toggle}>
      {active ? `on:${profile?.sharpness}` : 'off'}
    </button>
  );
}

describe('@eyesfree/react', () => {
  it('provides reactive state and renders the calibrator (StrictMode)', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let completed: string | undefined;

    await act(async () => {
      root.render(
        <StrictMode>
          <EyesFreeProvider options={{ storage: memoryAdapter(), sync: false }}>
            <Status />
            <EyesFreeCalibrator locale="en" onComplete={(p) => (completed = p.sharpness)} />
          </EyesFreeProvider>
        </StrictMode>,
      );
    });

    const status = host.querySelector('#status')!;
    expect(status.textContent).toBe('off');

    const cal = host.querySelector('eyesfree-calibrator')!;
    await act(async () => {
      (cal.querySelector('[data-action="next"]') as HTMLElement).click();
    });
    await act(async () => {
      (cal.querySelector('[data-sharpness="strong"]') as HTMLElement).click();
      (cal.querySelector('[data-action="apply"]') as HTMLElement).click();
    });

    expect(completed).toBe('strong');
    expect(status.textContent).toBe('on:strong');
    expect(document.body.classList.contains('eyesfree-active')).toBe(true);

    await act(async () => (status as HTMLElement).click());
    expect(status.textContent).toBe('off');

    await act(async () => root.unmount());
  });
});
