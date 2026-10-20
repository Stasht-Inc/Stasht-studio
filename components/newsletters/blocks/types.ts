/** Props every block editor takes. `onChange` gets only the fields that changed. */
export interface BlockEditorProps<D> {
  blockId: string;
  data: D;
  selected: boolean;
  readOnly: boolean;
  onChange(data: Partial<D>): void;
}
