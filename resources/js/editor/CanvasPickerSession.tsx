import React from 'react';
import { createPortal } from 'react-dom';
import { CanvasMediaPicker } from './MediaPickerField';
import { CanvasRoutePicker } from './RouteUrlField';

/** A picker owns the field it opened for; later selections cannot retarget it. */
export function CanvasPickerSession({ kind, targetKey, value, onChange, onDismiss }: {
  kind: 'media' | 'route';
  targetKey: string | null;
  value: string;
  onChange: (value: string) => void;
  onDismiss: () => void;
}): React.ReactElement | null {
  const [owner] = React.useState(targetKey);
  const live = React.useRef(false);
  const applied = React.useRef(false);
  const current = React.useRef({ targetKey, onChange, onDismiss });
  current.current = { targetKey, onChange, onDismiss };
  React.useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  React.useEffect(() => {
    if (!targetKey || targetKey !== owner) current.current.onDismiss();
  }, [targetKey, owner]);
  if (!owner || targetKey !== owner) return null;
  const apply = (next: string): void => {
    if (!live.current || applied.current || current.current.targetKey !== owner) return;
    applied.current = true;
    current.current.onChange(next);
    current.current.onDismiss();
  };
  const Picker = kind === 'media' ? CanvasMediaPicker : CanvasRoutePicker;
  return createPortal(<Picker value={value} onChange={apply} onDismiss={onDismiss} />, document.body);
}
